from __future__ import annotations

from typing import Any, Dict, Optional, Union, SupportsFloat, SupportsIndex
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, aliased

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Allocation, Score, RubricCriterion, User, Reflection
from app.infra.db.models import Grade  # kernmodel

router = APIRouter(prefix="/evaluations", tags=["student-overview"])


def _supports_attr(model: object, attr: str) -> bool:
    return hasattr(model, attr)


def _extract_team_number(team_name: Optional[str]) -> Optional[int]:
    if not team_name:
        return None
    import re

    m = re.search(r"(\d+)$", team_name.strip())
    return int(m.group(1)) if m else None


Floatish = Optional[Union[str, float, int, SupportsFloat, SupportsIndex]]


def _to_float(x: Floatish) -> Optional[float]:
    try:
        return float(x) if x is not None else None
    except (TypeError, ValueError):
        return None


def _round1(x: Optional[float]) -> Optional[float]:
    return None if x is None else round(x, 1)


@router.get("/{evaluation_id}/students/{user_id}/overview")
def student_overview(
    evaluation_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    u: Optional[User] = (
        db.query(User)
        .filter(User.id == user_id, User.school_id == current_user.school_id)
        .first()
    )
    if not u:
        raise HTTPException(status_code=404, detail="Student niet gevonden")

    team_id: Optional[int] = None
    team_name: Optional[str] = None
    course_id: Optional[int] = None
    course_name: Optional[str] = None

    try:
        from app.infra.db.models import Group as Team
        from app.infra.db.models import GroupMember as TeamMember
        from app.infra.db.models import Course
    except Exception:
        Team = None  # type: ignore
        TeamMember = None  # type: ignore
        Course = None  # type: ignore

    if Team is not None and TeamMember is not None:
        tm = (
            db.query(TeamMember)
            .filter(
                TeamMember.user_id == u.id,
                TeamMember.school_id == current_user.school_id,
            )
            .first()
        )
        if tm:
            t = db.get(Team, getattr(tm, "group_id", None))
            if t:
                team_id = getattr(t, "id", None)
                team_name = getattr(t, "name", None) or (
                    f"Team {getattr(t, 'id', '')}".strip()
                )
                if hasattr(t, "course_id"):
                    course_id = getattr(t, "course_id")
                    if Course and course_id is not None:
                        c = db.get(Course, course_id)
                        if c:
                            course_name = (
                                getattr(c, "name", None)
                                or f"Course {getattr(c, 'id', '')}".strip()
                            )

    g: Optional[Grade] = (
        db.query(Grade)
        .filter(
            Grade.school_id == current_user.school_id,
            Grade.evaluation_id == evaluation_id,
            Grade.user_id == user_id,
        )
        .first()
    )

    raw_meta: Dict[str, Any] = (getattr(g, "meta", None) or {}) if g else {}

    grade_val = _to_float(getattr(g, "grade", None))
    group_grade = _to_float(raw_meta.get("group_grade"))
    gcf = _to_float(raw_meta.get("gcf"))
    suggested = _to_float(raw_meta.get("suggested"))

    if grade_val is not None:
        final_val = grade_val
    elif group_grade is not None and gcf is not None:
        final_val = group_grade * gcf
    elif suggested is not None:
        final_val = suggested
    else:
        final_val = None

    grade_obj: Dict[str, Any] = {
        "grade": grade_val,
        "final": _round1(final_val),
        "reason": getattr(g, "override_reason", None) if g else None,
        "meta": raw_meta or None,
        "suggested": _round1(suggested) if suggested is not None else None,
        "group_grade": _round1(group_grade) if group_grade is not None else None,
        "gcf": gcf if gcf is not None else None,
        "spr": raw_meta.get("spr"),
        "avg_score": raw_meta.get("avg_score"),
    }

    U_from = aliased(User)
    rows_recv = (
        db.query(
            Allocation.reviewer_id.label("from_id"),
            U_from.name.label("from_name"),
            Score.score.label("score"),
            Score.comment.label("text"),
            RubricCriterion.id.label("criterion_id"),
            RubricCriterion.name.label("criterion_name"),
        )
        .join(U_from, U_from.id == Allocation.reviewer_id)
        .join(Score, Score.allocation_id == Allocation.id)
        .join(RubricCriterion, RubricCriterion.id == Score.criterion_id)
        .filter(
            Allocation.school_id == current_user.school_id,
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewee_id == user_id,
            Score.comment.isnot(None),
            Score.comment != "",
        )
        .order_by(U_from.name.asc(), RubricCriterion.id.asc(), Allocation.id.asc())
        .all()
    )
    rec_by_from: Dict[int, Dict[str, Any]] = {}
    for r in rows_recv:
        fid = int(r.from_id) if r.from_id is not None else -1
        gdict = rec_by_from.get(fid)
        if not gdict:
            gdict = {
                "reviewer_id": (fid if fid != -1 else None),
                "reviewer_name": r.from_name or "—",
                "score_pct": None,
                "comments": [],
            }
            rec_by_from[fid] = gdict
        gdict["comments"].append(
            {
                "criterion_id": r.criterion_id,
                "criterion_name": r.criterion_name,
                "score": int(r.score) if r.score is not None else None,
                "text": (r.text or "").strip(),
            }
        )
    received = list(rec_by_from.values())

    U_to = aliased(User)
    rows_given = (
        db.query(
            Allocation.reviewee_id.label("to_id"),
            U_to.name.label("to_name"),
            Score.comment.label("text"),
            Score.score.label("score"),
            RubricCriterion.id.label("criterion_id"),
            RubricCriterion.name.label("criterion_name"),
        )
        .join(U_to, U_to.id == Allocation.reviewee_id)
        .join(Score, Score.allocation_id == Allocation.id)
        .join(RubricCriterion, RubricCriterion.id == Score.criterion_id)
        .filter(
            Allocation.school_id == current_user.school_id,
            Allocation.evaluation_id == evaluation_id,
            Allocation.reviewer_id == user_id,
            Score.comment.isnot(None),
            Score.comment != "",
        )
        .order_by(U_to.name.asc(), RubricCriterion.id.asc(), Allocation.id.asc())
        .all()
    )
    giv_by_to: Dict[int, Dict[str, Any]] = {}
    for r in rows_given:
        tid = int(r.to_id) if r.to_id is not None else -1
        gdict = giv_by_to.get(tid)
        if not gdict:
            gdict = {
                "reviewee_id": (tid if tid != -1 else None),
                "reviewee_name": r.to_name or "—",
                "score_pct": None,
                "score": int(r.score) if r.score is not None else None,
                "comments": [],
            }
            giv_by_to[tid] = gdict
        gdict["comments"].append(
            {
                "criterion_id": r.criterion_id,
                "criterion_name": r.criterion_name,
                "text": (r.text or "").strip(),
            }
        )
    given = list(giv_by_to.values())

    # Reflectie
    ref_q: Optional[Reflection] = (
        db.query(Reflection)
        .filter(
            Reflection.school_id == current_user.school_id,
            Reflection.evaluation_id == evaluation_id,
            Reflection.user_id == user_id,
        )
        .first()
    )
    reflection_obj = (
        {
            "submitted_at": getattr(ref_q, "submitted_at", None),
            "text": getattr(ref_q, "text", None),
        }
        if ref_q
        else None
    )

    user_info = {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "class_name": getattr(u, "class_name", None),
        "team_id": team_id,
        "team_name": team_name,
        "team_number": _extract_team_number(team_name),
        # nieuw
        "course_id": course_id,
        "course_name": course_name,
        # compat alias voor bestaande frontend
        "cluster_id": course_id,
        "cluster_name": course_name,
    }

    return {
        "evaluation_id": evaluation_id,
        "user": user_info,
        "grade": grade_obj,
        "feedback_received": received,
        "feedback_given": given,
        "reflection": reflection_obj,
    }

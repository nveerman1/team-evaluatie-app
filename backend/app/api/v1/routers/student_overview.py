from __future__ import annotations
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.v1.deps import get_db, get_current_user

# Kernmodellen (bestaan bij jou):
from app.infra.db.models import User, Grade

# Optionele modellen (bestaan bij jou volgens FKs, maar velden kunnen per project verschillen)
try:
    from app.infra.db.models import (
        Allocation,
    )  # kolommen: reviewer_id, reviewee_id, (evaluation_id?), ...
except Exception:
    Allocation = None  # type: ignore

try:
    from app.infra.db.models import (
        Reflection,
    )  # kolommen: user_id, (evaluation_id), (content/text/...), created_at
except Exception:
    Reflection = None  # type: ignore

# Team/cluster:
try:
    from app.infra.db.models import Group as Team
    from app.infra.db.models import GroupMember as TeamMember
    from app.infra.db.models import Course
except Exception:
    Team = None  # type: ignore
    TeamMember = None  # type: ignore
    Course = None  # type: ignore

router = APIRouter(prefix="/evaluations", tags=["student-overview"])


def _supports_attr(model, attr: str) -> bool:
    return hasattr(model, attr)


def _extract_team_number(team_name: Optional[str]) -> Optional[int]:
    if not team_name:
        return None
    # verwacht "Team 1", "Team 2", of eindigt met getal
    import re

    m = re.search(r"(\d+)$", team_name.strip())
    return int(m.group(1)) if m else None


@router.get("/{evaluation_id}/students/{user_id}/overview")
def student_overview(
    evaluation_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # ---- 1) User ophalen (school-scope) ----
    u: Optional[User] = (
        db.query(User)
        .filter(User.id == user_id, User.school_id == current_user.school_id)
        .first()
    )
    if not u:
        raise HTTPException(status_code=404, detail="Student niet gevonden")

    # ---- 2) Team/cluster bepalen (via membership -> group -> course) ----
    team_id = None
    team_name = None
    cluster_id = None
    cluster_name = None

    if TeamMember and Team:
        tm = (
            db.query(TeamMember)
            .filter(
                TeamMember.user_id == u.id,
                TeamMember.school_id == current_user.school_id,
            )
            .first()
        )
        if tm:
            t = db.get(Team, tm.group_id)
            if t:
                team_id = t.id
                team_name = getattr(t, "name", None) or f"Team {t.id}"
                if hasattr(t, "course_id"):
                    cluster_id = getattr(t, "course_id")
                    if Course and cluster_id is not None:
                        c = db.get(Course, cluster_id)
                        if c:
                            cluster_name = getattr(c, "name", None) or f"Course {c.id}"

    # ---- 3) Grade ophalen (gepubliceerd of concept) ----
    # Bij jou staat het eindcijfer in grades.grade (1–10), met meta jsonb.
    g: Optional[Grade] = (
        db.query(Grade)
        .filter(
            Grade.school_id == current_user.school_id,
            Grade.evaluation_id == evaluation_id,
            Grade.user_id == user_id,
        )
        .first()
    )

    grade_obj: Dict[str, Any] = {
        "grade": getattr(g, "grade", None) if g else None,
        "reason": getattr(g, "reason", None) if g else None,
        "meta": getattr(g, "meta", None) if g else None,
        "suggested": None,
        "group_grade": None,
        "gcf": None,
        "spr": None,
        "avg_score": None,
    }
    m = grade_obj["meta"] or {}
    # uit meta teruggeven als aanwezig
    grade_obj["suggested"] = m.get("suggested")
    grade_obj["group_grade"] = m.get("group_grade")
    grade_obj["gcf"] = m.get("gcf")
    grade_obj["spr"] = m.get("spr")
    grade_obj["avg_score"] = m.get("avg_score")

    # ---- 4) Feedback ONTVANGEN (peers -> deze student) ----
    received: List[Dict[str, Any]] = []
    if Allocation:
        q = db.query(Allocation)
        # school scope indien kolom bestaat
        if _supports_attr(Allocation, "school_id"):
            q = q.filter(Allocation.school_id == current_user.school_id)
        # evaluatie filter indien kolom bestaat
        if _supports_attr(Allocation, "evaluation_id"):
            q = q.filter(getattr(Allocation, "evaluation_id") == evaluation_id)
        # reviewee == deze user
        if _supports_attr(Allocation, "reviewee_id"):
            q = q.filter(getattr(Allocation, "reviewee_id") == user_id)

        allocs = q.all()
        for a in allocs:
            reviewer_id = getattr(a, "reviewer_id", None)
            reviewer = db.get(User, reviewer_id) if reviewer_id else None
            # score/comment velden zijn project-specifiek; probeer een paar gangbare
            score_pct = None
            for field in ("score", "avg_score", "percentage", "final_score"):
                if hasattr(a, field):
                    score_pct = getattr(a, field)
                    break
            recv_comments: List[str] = []
            for field in ("comment", "comments", "feedback", "text", "notes"):
                if hasattr(a, field):
                    val = getattr(a, field)
                    if isinstance(val, str) and val.strip():
                        recv_comments.append(val.strip())
                    elif isinstance(val, list):
                        recv_comments.extend([str(x) for x in val if str(x).strip()])
                    break

            received.append(
                {
                    "reviewer_id": reviewer_id,
                    "reviewer_name": (
                        getattr(reviewer, "name", f"User {reviewer_id}")
                        if reviewer_id
                        else "—"
                    ),
                    "score_pct": score_pct,
                    "comments": recv_comments,
                }
            )

    # ---- 5) Feedback GEGEVEN (deze student -> peers) ----
    given: List[Dict[str, Any]] = []
    if Allocation:
        q = db.query(Allocation)
        if _supports_attr(Allocation, "school_id"):
            q = q.filter(Allocation.school_id == current_user.school_id)
        if _supports_attr(Allocation, "evaluation_id"):
            q = q.filter(getattr(Allocation, "evaluation_id") == evaluation_id)
        if _supports_attr(Allocation, "reviewer_id"):
            q = q.filter(getattr(Allocation, "reviewer_id") == user_id)

        allocs = q.all()
        for a in allocs:
            reviewee_id = getattr(a, "reviewee_id", None)
            reviewee = db.get(User, reviewee_id) if reviewee_id else None
            score_pct = None
            for field in ("score", "avg_score", "percentage", "final_score"):
                if hasattr(a, field):
                    score_pct = getattr(a, field)
                    break
            given_comments: List[str] = []
            for field in ("comment", "comments", "feedback", "text", "notes"):
                if hasattr(a, field):
                    val = getattr(a, field)
                    if isinstance(val, str) and val.strip():
                        given_comments.append(val.strip())
                    elif isinstance(val, list):
                        given_comments.extend([str(x) for x in val if str(x).strip()])
                    break

            given.append(
                {
                    "reviewee_id": reviewee_id,
                    "reviewee_name": (
                        getattr(reviewee, "name", f"User {reviewee_id}")
                        if reviewee_id
                        else "—"
                    ),
                    "score_pct": score_pct,
                    "comments": given_comments,
                }
            )

    # ---- 6) Reflectie ophalen ----
    reflection_obj: Optional[Dict[str, Any]] = None
    if Reflection:
        q = db.query(Reflection).filter(Reflection.user_id == user_id)
        if _supports_attr(Reflection, "school_id"):
            q = q.filter(Reflection.school_id == current_user.school_id)
        if _supports_attr(Reflection, "evaluation_id"):
            q = q.filter(getattr(Reflection, "evaluation_id") == evaluation_id)
        ref = q.first()
        if ref:
            text = None
            for field in ("content", "text", "body", "reflection", "answer"):
                if hasattr(ref, field):
                    text = getattr(ref, field)
                    break
            submitted_at = None
            for field in ("created_at", "submitted_at", "updated_at"):
                if hasattr(ref, field):
                    submitted_at = getattr(ref, field)
                    break
            reflection_obj = {
                "submitted_at": submitted_at,
                "text": text,
            }

    # ---- 7) Response samenstellen ----
    user_info = {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "class_name": getattr(u, "class_name", None),
        "team_id": team_id,
        "team_name": team_name,
        "team_number": _extract_team_number(team_name),
        "cluster_id": cluster_id,
        "cluster_name": cluster_name,
    }

    return {
        "evaluation_id": evaluation_id,
        "user": user_info,
        "grade": grade_obj,
        "feedback_received": received,
        "feedback_given": given,
        "reflection": reflection_obj,
    }

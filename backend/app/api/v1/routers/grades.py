from __future__ import annotations

from typing import Dict, Any, List, Optional, Iterable

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from statistics import mean

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Evaluation, Allocation, Score, User, PublishedGrade
from app.api.v1.schemas.grades import (
    GradePreviewResponse,
    GradePreviewItem,
    GradePublishRequest,
    PublishedGradeOut,
)

router = APIRouter(prefix="/grades", tags=["grades"])


def _safe_mean(values: Iterable[Optional[float]]) -> float:
    """Gemiddelde zonder None-waarden; accepteert ook puur floats."""
    vals = [v for v in values if v is not None]
    return mean(vals) if vals else 0.0


@router.get("/preview", response_model=GradePreviewResponse)
def preview_grades(
    evaluation_id: int,
    group_grade: Optional[float] = Query(
        default=None, description="Groepscijfer in %, bijv. 80.0"
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # ── Allocations ophalen ──────────────────────────────────────────────────────
    allocs = (
        db.query(Allocation)
        .filter(
            Allocation.school_id == user.school_id, Allocation.evaluation_id == ev.id
        )
        .all()
    )
    if not allocs:
        return GradePreviewResponse(evaluation_id=ev.id, items=[])

    # ── Scores verzamelen ────────────────────────────────────────────────────────
    scores_by_reviewee: Dict[int, List[float]] = {}
    self_scores: Dict[int, float] = {}

    # ✅ mapping: user_id → group_id (teamnummer)
    group_by_user: Dict[int, Optional[int]] = {}

    for a in allocs:
        rows = (
            db.query(Score)
            .filter(Score.school_id == user.school_id, Score.allocation_id == a.id)
            .all()
        )
        vals = [r.score for r in rows]
        if not vals:
            continue
        avg_alloc = _safe_mean(vals)
        scores_by_reviewee.setdefault(a.reviewee_id, []).append(avg_alloc)
        if a.is_self:
            self_scores[a.reviewee_id] = avg_alloc

        # ✅ probeer teamnummer te lezen uit Allocation.group_id (indien aanwezig)
        gid = getattr(a, "group_id", None)
        if gid is not None:
            group_by_user[a.reviewee_id] = gid

    # ── Gemiddelden per leerling en per groep ───────────────────────────────────
    per_user_avg: Dict[int, float] = {
        uid: _safe_mean(avgs) for uid, avgs in scores_by_reviewee.items()
    }
    global_avg = _safe_mean(list(per_user_avg.values()))

    def group_avg_for(uid: int) -> float:
        gid = group_by_user.get(uid)
        if gid is None:
            return global_avg
        members = [u for u, g in group_by_user.items() if g == gid]
        return (
            _safe_mean(
                [
                    per_user_avg.get(u)
                    for u in members
                    if per_user_avg.get(u) is not None
                ]
            )
            or global_avg
        )

    # ── Users ophalen (voor naam + klasveld) ─────────────────────────────────────
    users = {
        u.id: u for u in db.query(User).filter(User.school_id == user.school_id).all()
    }

    def team_number_for(uid: int) -> Optional[int]:
        tn = group_by_user.get(uid)
        return int(tn) if isinstance(tn, int) else None

    def class_name_for(uid: int) -> Optional[str]:
        u = users.get(uid)
        # ✅ als je User.class_name veld hebt:
        if u is not None and hasattr(u, "class_name"):
            return getattr(u, "class_name")  # type: ignore
        # Heb je een Class-tabel? Doe hier je lookup, bijv.:
        # cls = db.query(Class).get(u.class_id); return cls.name if cls else None
        return None

    # ── Output vullen ───────────────────────────────────────────────────────────
    items: List[GradePreviewItem] = []
    for uid, avg_score in per_user_avg.items():
        grp_avg = group_avg_for(uid)
        gcf = (avg_score / grp_avg) ** 0.5 if grp_avg > 0 else 1.0
        self_avg = self_scores.get(uid, avg_score)
        spr = self_avg / avg_score if avg_score else 1.0

        if group_grade is not None:
            suggested = round(group_grade * gcf, 1)
        else:
            # fallback 1–10
            suggested = round((avg_score / 5.0) * 9.0 + 1.0, 1)

        items.append(
            GradePreviewItem(
                user_id=uid,
                user_name=users[uid].name if uid in users else f"id:{uid}",
                avg_score=round(avg_score, 2),
                gcf=round(gcf, 2),
                spr=round(spr, 2),
                suggested_grade=suggested,
                # ✅ nieuw:
                team_number=team_number_for(uid),
                class_name=class_name_for(uid),
            )
        )

    return GradePreviewResponse(evaluation_id=ev.id, items=items)


@router.post(
    "/publish", response_model=List[PublishedGradeOut], status_code=status.HTTP_200_OK
)
def publish_grades(
    payload: GradePublishRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Publiceert cijfers.
    - Bouwt eerst een preview mét dezelfde group_grade voor consistente suggested waarden.
    - Past per user overrides toe: overrides[user_id] = {"grade": float | None, "reason": str | None}
    """
    ev = (
        db.query(Evaluation)
        .filter(
            Evaluation.id == payload.evaluation_id,
            Evaluation.school_id == user.school_id,
        )
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # Consistente preview (zelfde group_grade als in de UI)
    preview = preview_grades(
        evaluation_id=ev.id,
        group_grade=payload.group_grade,
        db=db,
        user=user,
    )  # type: ignore

    meta_by_uid: Dict[int, Dict[str, Any]] = {
        item.user_id: {
            "avg_score": item.avg_score,
            "gcf": item.gcf,
            "spr": item.spr,
            "suggested": item.suggested_grade,
            "group_grade": payload.group_grade,
        }
        for item in preview.items
    }

    users: Dict[int, User] = {
        u.id: u for u in db.query(User).filter(User.school_id == user.school_id).all()
    }

    out_rows: List[PublishedGrade] = []
    for uid, override in payload.overrides.items():
        override_grade = override.get("grade")
        suggested = meta_by_uid.get(uid, {}).get("suggested")
        final_grade = float(
            override_grade if override_grade is not None else (suggested or 0.0)
        )
        reason = override.get("reason")

        row = (
            db.query(PublishedGrade)
            .filter(
                PublishedGrade.school_id == user.school_id,
                PublishedGrade.evaluation_id == ev.id,
                PublishedGrade.user_id == uid,
            )
            .first()
        )

        if row is None:
            row = PublishedGrade(
                school_id=user.school_id,
                evaluation_id=ev.id,
                user_id=uid,
                grade=final_grade,
                reason=reason,
                meta=meta_by_uid.get(uid, {}),
            )
            db.add(row)
        else:
            row.grade = final_grade
            row.reason = reason
            row.meta = meta_by_uid.get(uid, {})

        out_rows.append(row)

    db.commit()

    # refresh + output payload
    out_payload: List[PublishedGradeOut] = []
    for row in out_rows:
        db.refresh(row)
        uname = users[row.user_id].name if row.user_id in users else f"id:{row.user_id}"
        out_payload.append(
            PublishedGradeOut(
                id=row.id,
                evaluation_id=row.evaluation_id,
                user_id=row.user_id,
                user_name=uname,
                grade=row.grade,
                reason=row.reason,
                meta=row.meta,
            )
        )
    return out_payload


@router.get("", response_model=List[PublishedGradeOut])
def list_grades(
    evaluation_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    """
    Geeft gepubliceerde cijfers terug (ná publish).
    """
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    users: Dict[int, User] = {
        u.id: u for u in db.query(User).filter(User.school_id == user.school_id).all()
    }

    rows = (
        db.query(PublishedGrade)
        .filter(
            PublishedGrade.school_id == user.school_id,
            PublishedGrade.evaluation_id == ev.id,
        )
        .order_by(PublishedGrade.user_id.asc())
        .all()
    )

    out: List[PublishedGradeOut] = []
    for r in rows:
        uname = users[r.user_id].name if r.user_id in users else f"id:{r.user_id}"
        out.append(
            PublishedGradeOut(
                id=r.id,
                evaluation_id=r.evaluation_id,
                user_id=r.user_id,
                user_name=uname,
                grade=r.grade,
                reason=r.reason,
                meta=r.meta,
            )
        )
    return out

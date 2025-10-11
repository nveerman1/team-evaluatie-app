from __future__ import annotations
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
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


def _safe_mean(values):
    vals = [v for v in values if v is not None]
    return mean(vals) if vals else 0.0


@router.get("/preview", response_model=GradePreviewResponse)
def preview_grades(
    evaluation_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)
):
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # alle allocations + scores
    allocs = (
        db.query(Allocation)
        .filter(
            Allocation.school_id == user.school_id, Allocation.evaluation_id == ev.id
        )
        .all()
    )
    if not allocs:
        return GradePreviewResponse(evaluation_id=ev.id, items=[])

    # scores per reviewee
    scores_by_reviewee: dict[int, list[float]] = {}
    self_scores: dict[int, float] = {}

    for a in allocs:
        rows = (
            db.query(Score)
            .filter(Score.school_id == user.school_id, Score.allocation_id == a.id)
            .all()
        )
        vals = [r.score for r in rows]
        if not vals:
            continue
        avg = _safe_mean(vals)
        scores_by_reviewee.setdefault(a.reviewee_id, []).append(avg)
        if a.is_self:
            self_scores[a.reviewee_id] = avg

    out: list[GradePreviewItem] = []
    users = {
        u.id: u for u in db.query(User).filter(User.school_id == user.school_id).all()
    }

    all_avgs = [mean(v) for v in scores_by_reviewee.values()]
    global_avg = _safe_mean(all_avgs)
    for uid, scores in scores_by_reviewee.items():
        avg_score = _safe_mean(scores)
        self_avg = self_scores.get(uid, avg_score)
        gcf = 1 - abs(avg_score - global_avg) / global_avg if global_avg else 1
        spr = self_avg / avg_score if avg_score else 1
        # simpel voorstel: schaal 1–10
        suggested = round((avg_score / 5) * 9 + 1, 1)
        out.append(
            GradePreviewItem(
                user_id=uid,
                user_name=users[uid].name if uid in users else f"id:{uid}",
                avg_score=round(avg_score, 2),
                gcf=round(gcf, 2),
                spr=round(spr, 2),
                suggested_grade=suggested,
            )
        )

    return GradePreviewResponse(evaluation_id=ev.id, items=out)


@router.post(
    "/publish", response_model=List[PublishedGradeOut], status_code=status.HTTP_200_OK
)
def publish_grades(
    payload: GradePublishRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
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

    # Bereken eerst een actuele preview, zodat we meta kunnen meeleveren
    preview = preview_grades(evaluation_id=ev.id, db=db, user=user)  # type: ignore
    meta_by_uid: Dict[int, Dict[str, Any]] = {
        item.user_id: {
            "avg_score": item.avg_score,
            "gcf": item.gcf,
            "spr": item.spr,
            "suggested": item.suggested_grade,
        }
        for item in preview.items
    }

    users: Dict[int, User] = {
        u.id: u for u in db.query(User).filter(User.school_id == user.school_id).all()
    }

    out: List[PublishedGrade] = []
    for uid, override in payload.overrides.items():
        # grade pick: override.grade of fallback suggested
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

        out.append(row)

    db.commit()
    # refresh + output
    out_payload: List[PublishedGradeOut] = []
    for row in out:
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

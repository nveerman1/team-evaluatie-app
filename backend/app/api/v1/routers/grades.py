from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from statistics import mean
from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Evaluation, Allocation, Score, User
from app.api.v1.schemas.grades import (
    GradePreviewResponse,
    GradePreviewItem,
    GradePublishRequest,
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


@router.post("/publish", status_code=status.HTTP_200_OK)
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

    # hier zou je in een echte app een tabel `PublishedGrade` hebben; we loggen nu gewoon
    published = []
    for uid, data in payload.overrides.items():
        published.append(
            {
                "user_id": uid,
                "grade": data.get("grade"),
                "reason": data.get("reason", ""),
            }
        )
    return {"evaluation_id": ev.id, "published": published, "count": len(published)}

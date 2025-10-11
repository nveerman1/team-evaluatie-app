from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from statistics import mean
from io import StringIO
import csv

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Evaluation,
    Rubric,
    RubricCriterion,
    Allocation,
    Score,
    User,
)
from app.api.v1.schemas.dashboard import (
    DashboardResponse,
    DashboardRow,
    CriterionMeta,
    CriterionBreakdown,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _safe_mean(vals):
    vals = [v for v in vals if v is not None]
    return mean(vals) if vals else 0.0


@router.get("/evaluation/{evaluation_id}", response_model=DashboardResponse)
def dashboard_evaluation(
    evaluation_id: int,
    include_breakdown: bool = Query(
        False, description="Voeg per-criterium gemiddelden toe"
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # === 1) Basis ===
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    rubric = (
        db.query(Rubric)
        .filter(Rubric.id == ev.rubric_id, Rubric.school_id == user.school_id)
        .first()
    )
    if not rubric:
        raise HTTPException(status_code=404, detail="Rubric not found")

    crit_rows = (
        db.query(RubricCriterion)
        .filter(
            RubricCriterion.school_id == user.school_id,
            RubricCriterion.rubric_id == rubric.id,
        )
        .order_by(RubricCriterion.id.asc())
        .all()
    )
    criteria = [CriterionMeta(id=c.id, name=c.name, weight=c.weight) for c in crit_rows]
    crit_ids = {c.id for c in crit_rows}

    # === 2) Alle allocations & scores voor deze evaluatie ===
    allocations = (
        db.query(Allocation)
        .filter(
            Allocation.school_id == user.school_id, Allocation.evaluation_id == ev.id
        )
        .all()
    )
    if not allocations:
        return DashboardResponse(
            evaluation_id=ev.id,
            rubric_id=rubric.id,
            rubric_scale_min=rubric.scale_min,
            rubric_scale_max=rubric.scale_max,
            criteria=criteria,
            items=[],
        )

    # Map voor user-info
    users = {
        u.id: u for u in db.query(User).filter(User.school_id == user.school_id).all()
    }

    # Aggregatie-bakken
    # - per reviewee: lijst van alloc_avg (alle scores op die allocatie gemiddeld)
    # - per reviewee: self_avg indien self-alloc
    # - per reviewee, per criterion: lijst met peer-scores en een optionele self-score
    per_reviewee_alloc_avgs: dict[int, list[float]] = {}
    per_reviewee_self_avg: dict[int, float] = {}
    per_reviewee_crit_peers: dict[int, dict[int, list[float]]] = {}
    per_reviewee_crit_self: dict[int, dict[int, float]] = {}

    for alloc in allocations:
        rows = (
            db.query(Score)
            .filter(Score.school_id == user.school_id, Score.allocation_id == alloc.id)
            .all()
        )

        # Pak alleen scores met geldige criteria
        valid_scores = [r for r in rows if r.criterion_id in crit_ids]
        if not valid_scores:
            continue

        # 2a) overall alloc average (gemiddelde over criteria)
        alloc_avg = _safe_mean([r.score for r in valid_scores])
        per_reviewee_alloc_avgs.setdefault(alloc.reviewee_id, []).append(alloc_avg)

        # 2b) per-criterium verdeling
        for r in valid_scores:
            if alloc.is_self:
                per_reviewee_crit_self.setdefault(alloc.reviewee_id, {})[
                    r.criterion_id
                ] = float(r.score)
            else:
                per_reviewee_crit_peers.setdefault(alloc.reviewee_id, {}).setdefault(
                    r.criterion_id, []
                ).append(float(r.score))

        # 2c) self-avg
        if alloc.is_self:
            per_reviewee_self_avg[alloc.reviewee_id] = alloc_avg

    # === 3) Globale gemiddelde voor GCF-berekening ===
    all_avgs = [_safe_mean(v) for v in per_reviewee_alloc_avgs.values() if v]
    global_avg = _safe_mean(all_avgs)

    # === 4) Opbouw rows ===
    items: list[DashboardRow] = []
    for reviewee_id, alloc_avgs in per_reviewee_alloc_avgs.items():
        # splits peers vs self
        self_avg = per_reviewee_self_avg.get(reviewee_id)
        if self_avg is None:
            peer_avgs_only = alloc_avgs  # geen zelf-score, alles peers
        else:
            # neem alle allocs en filter self er uit voor peer-avg
            peer_avgs_only = (
                [a for a in alloc_avgs if a != self_avg] if len(alloc_avgs) > 1 else []
            )

        peer_avg_overall = _safe_mean(peer_avgs_only)

        # reviewers count = aantal peer-allocaties die punten bevatten
        reviewers_count = len(peer_avgs_only)

        # GCF: 1 - |avg - global| / global (fallback 1 als global==0)
        gcf = 1 - abs(peer_avg_overall - global_avg) / global_avg if global_avg else 1.0

        # SPR: self_avg / peer_avg (fallback 1 als peer_avg==0 of self ontbreekt)
        spr = (
            (self_avg / peer_avg_overall)
            if (self_avg is not None and peer_avg_overall)
            else 1.0
        )

        # Suggested grade: schaal 1–10 vanaf rubric scale
        suggested = (
            round((peer_avg_overall / rubric.scale_max) * 9 + 1, 1)
            if rubric.scale_max
            else 0.0
        )

        # Per-criterium breakdown (optioneel)
        breakdown: list[CriterionBreakdown] = []
        if include_breakdown:
            crit_peers = per_reviewee_crit_peers.get(reviewee_id, {})
            crit_selfs = per_reviewee_crit_self.get(reviewee_id, {})
            for c in crit_rows:
                peers = crit_peers.get(c.id, [])
                breakdown.append(
                    CriterionBreakdown(
                        criterion_id=c.id,
                        peer_avg=round(_safe_mean(peers), 2) if peers else 0.0,
                        peer_count=len(peers),
                        self_score=crit_selfs.get(c.id),
                    )
                )

        items.append(
            DashboardRow(
                user_id=reviewee_id,
                user_name=(
                    users[reviewee_id].name
                    if reviewee_id in users
                    else f"id:{reviewee_id}"
                ),
                peer_avg_overall=round(peer_avg_overall, 2),
                self_avg_overall=round(self_avg, 2) if self_avg is not None else None,
                reviewers_count=reviewers_count,
                gcf=round(gcf, 2),
                spr=round(spr, 2),
                suggested_grade=suggested,
                breakdown=breakdown,
            )
        )

    # sorteer op naam
    items.sort(key=lambda r: r.user_name.lower())

    return DashboardResponse(
        evaluation_id=ev.id,
        rubric_id=rubric.id,
        rubric_scale_min=rubric.scale_min,
        rubric_scale_max=rubric.scale_max,
        criteria=criteria,
        items=items,
    )


@router.get("/evaluation/{evaluation_id}/export.csv")
def dashboard_export_csv(
    evaluation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # Reuse JSON endpoint om dubbele logica te voorkomen
    data: DashboardResponse = dashboard_evaluation(
        evaluation_id, include_breakdown=False, db=db, user=user  # type: ignore
    )

    # CSV bouwen
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["evaluation_id", data.evaluation_id])
    w.writerow(["rubric_id", data.rubric_id])
    w.writerow([])
    w.writerow(
        [
            "user_id",
            "user_name",
            "peer_avg_overall",
            "self_avg_overall",
            "reviewers_count",
            "gcf",
            "spr",
            "suggested_grade",
        ]
    )

    for it in data.items:
        w.writerow(
            [
                it.user_id,
                it.user_name,
                f"{it.peer_avg_overall:.2f}",
                "" if it.self_avg_overall is None else f"{it.self_avg_overall:.2f}",
                it.reviewers_count,
                f"{it.gcf:.2f}",
                f"{it.spr:.2f}",
                f"{it.suggested_grade:.1f}",
            ]
        )

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="evaluation_{evaluation_id}_dashboard.csv"'
        },
    )

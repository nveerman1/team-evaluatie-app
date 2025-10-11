from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from statistics import mean, pstdev
from io import StringIO
import csv
from typing import Dict, List

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Evaluation, Allocation, Score, User, Rubric
from app.api.v1.schemas.flags import FlagsResponse, FlagRow, Flag

router = APIRouter(prefix="/flags", tags=["flags"])


def _safe_mean(vals: List[float]) -> float:
    return mean(vals) if vals else 0.0


def _user_name(users: Dict[int, User], uid: int) -> str:
    u = users.get(uid)
    return u.name if u is not None else f"id:{uid}"


@router.get("/evaluation/{evaluation_id}", response_model=FlagsResponse)
def flags_evaluation(
    evaluation_id: int,
    spr_high: float = Query(1.30, description="SPR drempel voor HIGH_SPR"),
    spr_low: float = Query(0.70, description="SPR drempel voor LOW_SPR"),
    gcf_low: float = Query(0.70, description="GCF drempel voor LOW_GCF"),
    min_reviewers: int = Query(2, description="Minimum aantal peer-reviewers"),
    zscore_abs: float = Query(2.0, description="|z|-drempel voor OUTLIER_ZSCORE"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # === 1) Basis: evaluatie + rubric ophalen
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

    # === 2) Data vergaren: allocations + scores
    allocations = (
        db.query(Allocation)
        .filter(
            Allocation.school_id == user.school_id, Allocation.evaluation_id == ev.id
        )
        .all()
    )
    if not allocations:
        return FlagsResponse(evaluation_id=ev.id, items=[])

    users: Dict[int, User] = {
        u.id: u for u in db.query(User).filter(User.school_id == user.school_id).all()
    }

    # per reviewee alles aggregeren
    per_reviewee_peer_alloc_avgs: Dict[int, List[float]] = {}
    per_reviewee_self_avg: Dict[int, float] = {}
    per_reviewee_reviewers_count: Dict[int, int] = {}

    for alloc in allocations:
        rows = (
            db.query(Score)
            .filter(Score.school_id == user.school_id, Score.allocation_id == alloc.id)
            .all()
        )
        if not rows:
            continue
        alloc_avg = _safe_mean([float(r.score) for r in rows])
        if alloc.is_self:
            per_reviewee_self_avg[alloc.reviewee_id] = alloc_avg
        else:
            per_reviewee_peer_alloc_avgs.setdefault(alloc.reviewee_id, []).append(
                alloc_avg
            )

    # reviewers count (alleen peers)
    for uid, peer_avgs in per_reviewee_peer_alloc_avgs.items():
        per_reviewee_reviewers_count[uid] = len(peer_avgs)

    # globale statistiek voor z-score
    cohort_peer_means = [
        _safe_mean(v) for v in per_reviewee_peer_alloc_avgs.values() if v
    ]
    cohort_mean = _safe_mean(cohort_peer_means)
    cohort_std = pstdev(cohort_peer_means) if len(cohort_peer_means) > 1 else 0.0

    items: List[FlagRow] = []

    for uid, peer_avgs in per_reviewee_peer_alloc_avgs.items():
        peer_avg = _safe_mean(peer_avgs)
        self_avg = per_reviewee_self_avg.get(uid)
        reviewers_count = per_reviewee_reviewers_count.get(uid, 0)

        # GCF: 1 - |peer_avg - cohort_mean| / cohort_mean
        gcf = 1.0
        if cohort_mean:
            gcf = 1 - abs(peer_avg - cohort_mean) / cohort_mean

        # SPR
        spr = 1.0
        if self_avg is not None and peer_avg:
            spr = self_avg / peer_avg

        # Z-score (alleen als std > 0)
        z = 0.0
        if cohort_std > 0:
            z = (peer_avg - cohort_mean) / cohort_std

        flags: List[Flag] = []

        # --- Rules ---
        if reviewers_count < min_reviewers:
            flags.append(
                Flag(
                    code="FEW_REVIEWERS",
                    severity="medium",
                    message=f"Te weinig reviewers ({reviewers_count} < {min_reviewers})",
                    meta={"count": float(reviewers_count)},
                )
            )

        if self_avg is None:
            flags.append(
                Flag(
                    code="MISSING_SELF",
                    severity="low",
                    message="Geen zelfbeoordeling",
                    meta={},
                )
            )
        else:
            if spr > spr_high:
                flags.append(
                    Flag(
                        code="HIGH_SPR",
                        severity="high",
                        message=f"Self/peer ratio hoog ({spr:.2f} > {spr_high})",
                        meta={"spr": round(spr, 2)},
                    )
                )
            elif spr < spr_low:
                flags.append(
                    Flag(
                        code="LOW_SPR",
                        severity="medium",
                        message=f"Self/peer ratio laag ({spr:.2f} < {spr_low})",
                        meta={"spr": round(spr, 2)},
                    )
                )

        if gcf < gcf_low:
            flags.append(
                Flag(
                    code="LOW_GCF",
                    severity="medium",
                    message=f"Afwijkend t.o.v. cohort (GCF {gcf:.2f} < {gcf_low})",
                    meta={"gcf": round(gcf, 2)},
                )
            )

        if abs(z) >= zscore_abs and cohort_std > 0:
            sev = "high" if abs(z) >= (zscore_abs + 0.5) else "medium"
            flags.append(
                Flag(
                    code="OUTLIER_ZSCORE",
                    severity=sev,
                    message=f"Outlier (z={z:.2f}, |z|≥{zscore_abs})",
                    meta={"z": round(z, 2)},
                )
            )

        items.append(
            FlagRow(
                user_id=uid,
                user_name=_user_name(users, uid),
                peer_avg_overall=round(peer_avg, 2),
                self_avg_overall=round(self_avg, 2) if self_avg is not None else None,
                reviewers_count=reviewers_count,
                gcf=round(gcf, 2),
                spr=round(spr, 2),
                flags=flags,
            )
        )

    # sorteer op ernst (aantal high/medium) en dan naam
    def _severity_key(fr: FlagRow) -> tuple[int, int, str]:
        highs = sum(1 for f in fr.flags if f.severity == "high")
        meds = sum(1 for f in fr.flags if f.severity == "medium")
        return (-highs, -meds, fr.user_name.lower())

    items.sort(key=_severity_key)
    return FlagsResponse(evaluation_id=ev.id, items=items)


@router.get("/evaluation/{evaluation_id}/export.csv")
def flags_export_csv(
    evaluation_id: int,
    spr_high: float = Query(1.30),
    spr_low: float = Query(0.70),
    gcf_low: float = Query(0.70),
    min_reviewers: int = Query(2),
    zscore_abs: float = Query(2.0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    data: FlagsResponse = flags_evaluation(  # type: ignore
        evaluation_id=evaluation_id,
        spr_high=spr_high,
        spr_low=spr_low,
        gcf_low=gcf_low,
        min_reviewers=min_reviewers,
        zscore_abs=zscore_abs,
        db=db,
        user=user,
    )

    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["evaluation_id", data.evaluation_id])
    w.writerow(["spr_high", spr_high])
    w.writerow(["spr_low", spr_low])
    w.writerow(["gcf_low", gcf_low])
    w.writerow(["min_reviewers", min_reviewers])
    w.writerow(["zscore_abs", zscore_abs])
    w.writerow([])

    # header
    w.writerow(
        [
            "user_id",
            "user_name",
            "peer_avg_overall",
            "self_avg_overall",
            "reviewers_count",
            "gcf",
            "spr",
            "flags",  # flags gejoined
        ]
    )

    for it in data.items:
        flags_joined = (
            "; ".join([f"{f.code}:{f.severity}" for f in it.flags]) if it.flags else ""
        )
        w.writerow(
            [
                it.user_id,
                it.user_name,
                f"{it.peer_avg_overall:.2f}",
                "" if it.self_avg_overall is None else f"{it.self_avg_overall:.2f}",
                it.reviewers_count,
                f"{it.gcf:.2f}",
                f"{it.spr:.2f}",
                flags_joined,
            ]
        )

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="evaluation_%d_flags.csv"'
            % evaluation_id
        },
    )

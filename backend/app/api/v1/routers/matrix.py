from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from statistics import mean
from io import StringIO
import csv
from typing import Dict, List, Tuple

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import Evaluation, Allocation, Score, User, RubricCriterion
from app.api.v1.schemas.matrix import MatrixResponse, MatrixUser, MatrixCell

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _user_name(users: Dict[int, User], uid: int) -> str:
    u = users.get(uid)
    return u.name if u is not None else f"id:{uid}"


def _safe_mean(vals: List[float]) -> float:
    return mean(vals) if vals else 0.0


@router.get("/evaluation/{evaluation_id}/matrix", response_model=MatrixResponse)
def matrix_evaluation(
    evaluation_id: int,
    criterion_id: int | None = Query(
        default=None, description="Beperk naar één rubric-criterium"
    ),
    include_self: bool = Query(default=True, description="Neem self-reviews mee"),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # 1) eval check
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # 2) optioneel criterium valideren (behoort tot rubric van eval)
    valid_crit_id: int | None = None
    if criterion_id is not None:
        ok = (
            db.query(RubricCriterion.id)
            .filter(
                RubricCriterion.id == criterion_id,
                RubricCriterion.school_id == user.school_id,
                RubricCriterion.rubric_id == ev.rubric_id,
            )
            .first()
        )
        if not ok:
            raise HTTPException(
                status_code=400, detail="Invalid criterion_id for this evaluation"
            )
        valid_crit_id = criterion_id

    # 3) alle allocations voor deze evaluatie (optioneel zonder self)
    alloc_q = db.query(Allocation).filter(
        Allocation.school_id == user.school_id, Allocation.evaluation_id == ev.id
    )
    if not include_self:
        alloc_q = alloc_q.filter(Allocation.is_self.is_(False))
    allocations = alloc_q.all()
    if not allocations:
        return MatrixResponse(
            evaluation_id=ev.id,
            criterion_id=valid_crit_id,
            reviewers=[],
            reviewees=[],
            cells=[],
        )

    # 4) users map (mypy-veilig)
    users: Dict[int, User] = {
        u.id: u for u in db.query(User).filter(User.school_id == user.school_id).all()
    }

    # 5) per koppel (reviewer, reviewee) verzamel scores
    #    - als criterion_id is gezet: lijst met die ene score per allocation (0..n)
    #    - anders: lijst met alloc-avg over alle criteria
    pair_scores: Dict[Tuple[int, int], List[float]] = {}

    for alloc in allocations:
        rows = (
            db.query(Score)
            .filter(Score.school_id == user.school_id, Score.allocation_id == alloc.id)
            .all()
        )
        if not rows:
            continue

        if valid_crit_id is not None:
            vals = [float(r.score) for r in rows if r.criterion_id == valid_crit_id]
            if not vals:
                continue
            # op 1 allocation kan je meerdere ingevulde scores voor hetzelfde criterium hebben
            # (bijv. updates). We nemen de laatste of het gemiddelde; hier gemiddelde:
            value = _safe_mean(vals)
            pair_scores.setdefault((alloc.reviewer_id, alloc.reviewee_id), []).append(
                value
            )
        else:
            # gemiddeld over alle criteria in deze allocation
            crit_vals = [float(r.score) for r in rows]
            if not crit_vals:
                continue
            value = _safe_mean(crit_vals)
            pair_scores.setdefault((alloc.reviewer_id, alloc.reviewee_id), []).append(
                value
            )

    # 6) bepaal rijen/kolommen (gesorteerd op naam)
    reviewer_ids = sorted(
        {rv for (rv, _rvw) in pair_scores.keys()},
        key=lambda i: _user_name(users, i).lower(),
    )
    reviewee_ids = sorted(
        {rw for (_rv, rw) in pair_scores.keys()},
        key=lambda i: _user_name(users, i).lower(),
    )

    reviewers = [MatrixUser(id=i, name=_user_name(users, i)) for i in reviewer_ids]
    reviewees = [MatrixUser(id=i, name=_user_name(users, i)) for i in reviewee_ids]

    # 7) cellen bouwen (None als geen data voor dat koppel)
    cells: List[MatrixCell] = []
    for rid in reviewer_ids:
        for wid in reviewee_ids:
            values = pair_scores.get((rid, wid), [])
            if values:
                avg = round(_safe_mean(values), 2)
                cnt = len(values)
                cells.append(
                    MatrixCell(reviewer_id=rid, reviewee_id=wid, value=avg, count=cnt)
                )
            else:
                cells.append(
                    MatrixCell(reviewer_id=rid, reviewee_id=wid, value=None, count=0)
                )

    return MatrixResponse(
        evaluation_id=ev.id,
        criterion_id=valid_crit_id,
        reviewers=reviewers,
        reviewees=reviewees,
        cells=cells,
    )


@router.get("/evaluation/{evaluation_id}/matrix.csv")
def matrix_evaluation_csv(
    evaluation_id: int,
    criterion_id: int | None = Query(default=None),
    include_self: bool = Query(default=True),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # hergebruik JSON-endpoint om logica te delen
    data: MatrixResponse = matrix_evaluation(
        evaluation_id=evaluation_id,
        criterion_id=criterion_id,
        include_self=include_self,
        db=db,
        user=user,  # type: ignore
    )

    buf = StringIO()
    w = csv.writer(buf)

    # kop
    w.writerow(["evaluation_id", data.evaluation_id])
    w.writerow(
        ["criterion_id", data.criterion_id if data.criterion_id is not None else "ALL"]
    )
    w.writerow([])

    # header: eerste kolom "Reviewer \ Reviewee", dan alle reviewee-namen
    header = ["Reviewer \\ Reviewee"] + [u.name for u in data.reviewees]
    w.writerow(header)

    # matrixregels
    # maak snelle lookup: (rid, wid) -> value
    cell_map: Dict[tuple[int, int], MatrixCell] = {
        (c.reviewer_id, c.reviewee_id): c for c in data.cells
    }

    for rv in data.reviewers:
        row: List[str | float] = [rv.name]
        for rw in data.reviewees:
            cell = cell_map.get((rv.id, rw.id))
            row.append(
                "" if cell is None or cell.value is None else f"{cell.value:.2f}"
            )
        w.writerow(row)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="evaluation_{evaluation_id}_matrix.csv"'
        },
    )

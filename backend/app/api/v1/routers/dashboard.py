from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from statistics import mean
from io import StringIO
import csv
from datetime import datetime

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Evaluation,
    Rubric,
    RubricCriterion,
    Allocation,
    Score,
    User,
    Reflection,
    GroupMember,
    Group,
)
from app.api.v1.schemas.dashboard import (
    DashboardResponse,
    DashboardRow,
    CriterionMeta,
    CriterionBreakdown,
    CategoryAverage,
    StudentProgressResponse,
    StudentProgressRow,
    StudentProgressKPIs,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _safe_mean(vals):
    vals = [v for v in vals if v is not None]
    return mean(vals) if vals else 0.0


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


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
    criteria = [CriterionMeta(id=c.id, name=c.name, weight=c.weight, category=getattr(c, "category", None)) for c in crit_rows]
    crit_ids = {c.id for c in crit_rows}
    # Build category to criteria mapping
    category_to_criteria = {}
    for c in crit_rows:
        cat = getattr(c, "category", None)
        if cat:
            if cat not in category_to_criteria:
                category_to_criteria[cat] = []
            category_to_criteria[cat].append(c.id)

    # === 2) Get valid student IDs from the evaluation's course ===
    valid_student_ids = set()
    if ev.course_id:
        # Get all active students in groups for this course
        course_students = (
            db.query(User.id)
            .join(GroupMember, GroupMember.user_id == User.id)
            .join(Group, Group.id == GroupMember.group_id)
            .filter(
                User.school_id == user.school_id,
                User.role == "student",
                User.archived.is_(False),
                Group.course_id == ev.course_id,
                GroupMember.active.is_(True),
            )
            .distinct()
            .all()
        )
        valid_student_ids = {s[0] for s in course_students}

    # === 3) Filter allocations to only include students from the course ===
    if ev.course_id and not valid_student_ids:
        # No students in the course, return empty dashboard
        allocations = []
    else:
        query = db.query(Allocation).filter(
            Allocation.school_id == user.school_id, Allocation.evaluation_id == ev.id
        )

        # Filter allocations at SQL level to only include valid students
        if valid_student_ids:
            query = query.filter(
                Allocation.reviewee_id.in_(valid_student_ids),
                Allocation.reviewer_id.in_(valid_student_ids),
            )

        allocations = query.all()

    if not allocations:
        return DashboardResponse(
            evaluation_id=ev.id,
            rubric_id=rubric.id,
            rubric_scale_min=rubric.scale_min,
            rubric_scale_max=rubric.scale_max,
            criteria=criteria,
            items=[],
        )

    # Map voor user-info - only load valid students
    if valid_student_ids:
        users = {
            u.id: u
            for u in db.query(User)
            .filter(User.school_id == user.school_id, User.id.in_(valid_student_ids))
            .all()
        }
    else:
        users = {}

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

    # === 4) Calculate peer averages per reviewee for GCF calculation ===
    peer_avg_by_reviewee: dict[int, float] = {}
    for reviewee_id, alloc_avgs in per_reviewee_alloc_avgs.items():
        self_avg = per_reviewee_self_avg.get(reviewee_id)
        if self_avg is None:
            peer_avgs_only = alloc_avgs  # geen zelf-score, alles peers
        else:
            # neem alle allocs en filter self er uit voor peer-avg
            peer_avgs_only = (
                [a for a in alloc_avgs if a != self_avg] if len(alloc_avgs) > 1 else []
            )
        peer_avg_by_reviewee[reviewee_id] = _safe_mean(peer_avgs_only)

    # === 5) GCF: Calculate per-team means and ratios (matching grades.py logic) ===
    # Load GCF range from evaluation settings
    settings = getattr(ev, "settings", {}) or {}
    min_cf = 0.6
    max_cf = 1.4
    if isinstance(settings, dict):
        min_cf = float(settings.get("min_cf", 0.6))
        max_cf = float(settings.get("max_cf", 1.4))

    # Group peer averages by team_number
    peer_avg_by_team: dict[int | None, list[float]] = {}
    team_by_reviewee: dict[int, int | None] = {}
    for reviewee_id in peer_avg_by_reviewee:
        u = users.get(reviewee_id)
        team_num = getattr(u, "team_number", None) if u else None
        team_by_reviewee[reviewee_id] = team_num
        peer_avg_by_team.setdefault(team_num, []).append(peer_avg_by_reviewee[reviewee_id])

    # Calculate team means
    team_means: dict[int | None, float] = {
        team: _safe_mean(avgs) for team, avgs in peer_avg_by_team.items() if avgs
    }

    # Calculate GCF for each reviewee
    gcf_by_reviewee: dict[int, float] = {}
    for reviewee_id, peer_avg in peer_avg_by_reviewee.items():
        team_num = team_by_reviewee.get(reviewee_id)
        team_mean = team_means.get(team_num, 0.0)
        if team_mean > 0:
            raw_gcf = peer_avg / team_mean
            gcf_by_reviewee[reviewee_id] = _clamp(raw_gcf, min_cf, max_cf)
        else:
            gcf_by_reviewee[reviewee_id] = 1.0

    # === 6) Opbouw rows ===
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

        # GCF: from pre-calculated gcf_by_reviewee
        gcf = gcf_by_reviewee.get(reviewee_id, 1.0)

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

        # Calculate category averages
        category_averages: list[CategoryAverage] = []
        if category_to_criteria:
            crit_peers = per_reviewee_crit_peers.get(reviewee_id, {})
            crit_selfs = per_reviewee_crit_self.get(reviewee_id, {})
            for cat, crit_ids_in_cat in category_to_criteria.items():
                # Collect all peer scores for criteria in this category
                cat_peer_scores = []
                for cid in crit_ids_in_cat:
                    cat_peer_scores.extend(crit_peers.get(cid, []))
                
                # Collect all self scores for criteria in this category
                cat_self_scores = [crit_selfs.get(cid) for cid in crit_ids_in_cat if cid in crit_selfs]
                
                category_averages.append(
                    CategoryAverage(
                        category=cat,
                        peer_avg=round(_safe_mean(cat_peer_scores), 2) if cat_peer_scores else 0.0,
                        self_avg=round(_safe_mean(cat_self_scores), 2) if cat_self_scores else None,
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
                category_averages=category_averages,
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


@router.get(
    "/evaluation/{evaluation_id}/progress", response_model=StudentProgressResponse
)
def get_student_progress(
    evaluation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get detailed progress for all students in an evaluation.
    Shows self-assessment, peer reviews, reflection status, and overall progress.
    """
    # Get evaluation
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # Get all students from the course
    allocations = (
        db.query(Allocation)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.evaluation_id == ev.id,
        )
        .all()
    )

    # Get ALL students from the course (not just those with allocations)
    student_ids = set()
    if ev.course_id:
        # Get all active students in groups for this course
        course_students = (
            db.query(User.id)
            .join(GroupMember, GroupMember.user_id == User.id)
            .join(Group, Group.id == GroupMember.group_id)
            .filter(
                User.school_id == user.school_id,
                User.role == "student",
                User.archived.is_(False),
                Group.course_id == ev.course_id,
                GroupMember.active.is_(True),
            )
            .distinct()
            .all()
        )
        student_ids = {s[0] for s in course_students}

    # Also include any students who have allocations (in case they're not in groups)
    for alloc in allocations:
        student_ids.add(alloc.reviewee_id)
        student_ids.add(alloc.reviewer_id)

    # Get user information
    if student_ids:
        users = {
            u.id: u
            for u in db.query(User)
            .filter(User.school_id == user.school_id, User.id.in_(student_ids))
            .all()
        }
    else:
        users = {}

    # Calculate progress for each student
    items = []
    for student_id in student_ids:
        student = users.get(student_id)
        if not student:
            continue

        # Self-assessment status
        self_allocations = [
            a for a in allocations if a.reviewee_id == student_id and a.is_self
        ]
        self_scores = []
        for alloc in self_allocations:
            scores = (
                db.query(Score)
                .filter(
                    Score.school_id == user.school_id, Score.allocation_id == alloc.id
                )
                .all()
            )
            self_scores.extend(scores)

        if len(self_scores) > 0:
            self_assessment_status = "completed"
        elif len(self_allocations) > 0:
            self_assessment_status = "partial"
        else:
            self_assessment_status = "not_started"

        # Find valid teammates for this student (same course AND team_number)
        # This matches the logic used in my_allocations endpoint
        valid_teammate_ids = set()
        if student.team_number is not None:
            from app.api.v1.routers.allocations import _select_members_for_course

            teammates = _select_members_for_course(
                db,
                school_id=user.school_id,
                course_id=ev.course_id,
                team_number=student.team_number,
            )
            valid_teammate_ids = set(teammates)
            # Remove self from teammates
            valid_teammate_ids.discard(student_id)

        # Peer reviews given (as reviewer) - only count allocations for valid teammates
        peer_allocations_given = [
            a
            for a in allocations
            if a.reviewer_id == student_id
            and not a.is_self
            and a.reviewee_id in valid_teammate_ids
        ]
        peer_reviews_given = 0
        peer_reviews_given_expected = len(
            valid_teammate_ids
        )  # Expected is number of valid teammates
        for alloc in peer_allocations_given:
            scores = (
                db.query(Score)
                .filter(
                    Score.school_id == user.school_id, Score.allocation_id == alloc.id
                )
                .count()
            )
            if scores > 0:
                peer_reviews_given += 1

        # Peer reviews received (as reviewee) - only count allocations from valid teammates
        peer_allocations_received = [
            a
            for a in allocations
            if a.reviewee_id == student_id
            and not a.is_self
            and a.reviewer_id in valid_teammate_ids
        ]
        peer_reviews_received = 0
        peer_reviews_expected = len(
            valid_teammate_ids
        )  # Expected is number of valid teammates
        for alloc in peer_allocations_received:
            scores = (
                db.query(Score)
                .filter(
                    Score.school_id == user.school_id, Score.allocation_id == alloc.id
                )
                .count()
            )
            if scores > 0:
                peer_reviews_received += 1

        # Reflection status
        reflection = (
            db.query(Reflection)
            .filter(
                Reflection.school_id == user.school_id,
                Reflection.evaluation_id == ev.id,
                Reflection.user_id == student_id,
            )
            .first()
        )
        reflection_status = "completed" if reflection else "not_started"
        reflection_word_count = reflection.word_count if reflection else None

        # Total progress calculation
        progress_parts = []
        if self_assessment_status == "completed":
            progress_parts.append(1.0)
        elif self_assessment_status == "partial":
            progress_parts.append(0.5)
        else:
            progress_parts.append(0.0)

        if peer_reviews_expected > 0:
            progress_parts.append(peer_reviews_received / peer_reviews_expected)
        else:
            progress_parts.append(0.0)

        if reflection_status == "completed":
            progress_parts.append(1.0)
        else:
            progress_parts.append(0.0)

        total_progress_percent = round(
            (sum(progress_parts) / len(progress_parts)) * 100, 1
        )

        # Last activity (most recent score or reflection submission)
        last_activity = None
        if reflection and reflection.submitted_at:
            last_activity = reflection.submitted_at

        # Get last score timestamp
        student_allocations = [
            a
            for a in allocations
            if a.reviewer_id == student_id or a.reviewee_id == student_id
        ]
        for alloc in student_allocations:
            scores = (
                db.query(Score)
                .filter(
                    Score.school_id == user.school_id, Score.allocation_id == alloc.id
                )
                .all()
            )
            for score in scores:
                if hasattr(score, "created_at") and score.created_at:
                    if not last_activity or score.created_at > last_activity:
                        last_activity = score.created_at

        # Enhanced flags system
        flags = []

        # Flag 1: Low progress
        if total_progress_percent < 30:
            flags.append("low_progress")

        # Flag 2: No activity (no last_activity or > 7 days old)
        if not last_activity:
            flags.append("no_activity")
        else:
            # Handle timezone-aware or naive datetime comparison
            current_time = datetime.now()
            if hasattr(last_activity, "replace"):
                # Make both timezone-naive for safe comparison
                last_activity_naive = (
                    last_activity.replace(tzinfo=None)
                    if last_activity.tzinfo
                    else last_activity
                )
                days_since_activity = (current_time - last_activity_naive).days
            else:
                days_since_activity = (current_time - last_activity).days

            if days_since_activity > 7:
                flags.append("inactive_7days")

        # Flag 3: Missing peer reviews (less than 50% received)
        if peer_reviews_expected > 0:
            peer_review_percentage = (
                peer_reviews_received / peer_reviews_expected
            ) * 100
            if peer_review_percentage < 50:
                flags.append("missing_peer_reviews")

        # Flag 4: Self-assessment not started
        if self_assessment_status == "not_started":
            flags.append("no_self_assessment")

        # Flag 5: No reflection submitted
        if reflection_status == "not_started":
            flags.append("no_reflection")

        items.append(
            StudentProgressRow(
                user_id=student_id,
                user_name=student.name,
                class_name=getattr(student, "class_name", None),
                team_number=getattr(student, "team_number", None),
                self_assessment_status=self_assessment_status,
                peer_reviews_given=peer_reviews_given,
                peer_reviews_given_expected=peer_reviews_given_expected,
                peer_reviews_received=peer_reviews_received,
                peer_reviews_expected=peer_reviews_expected,
                reflection_status=reflection_status,
                reflection_word_count=reflection_word_count,
                total_progress_percent=total_progress_percent,
                last_activity=last_activity,
                flags=flags,
            )
        )

    # Sort by name
    items.sort(key=lambda x: x.user_name.lower())

    return StudentProgressResponse(
        evaluation_id=ev.id, total_students=len(items), items=items
    )


@router.get("/evaluation/{evaluation_id}/kpis", response_model=StudentProgressKPIs)
def get_dashboard_kpis(
    evaluation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Get KPI summary for dashboard cards.
    """
    # Get evaluation
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # Get all allocations
    allocations = (
        db.query(Allocation)
        .filter(
            Allocation.school_id == user.school_id,
            Allocation.evaluation_id == ev.id,
        )
        .all()
    )

    # Get ALL student IDs from the course (same logic as progress endpoint)
    student_ids = set()
    if ev.course_id:
        # Get all active students in groups for this course
        course_students = (
            db.query(User.id)
            .join(GroupMember, GroupMember.user_id == User.id)
            .join(Group, Group.id == GroupMember.group_id)
            .filter(
                User.school_id == user.school_id,
                User.role == "student",
                User.archived.is_(False),
                Group.course_id == ev.course_id,
                GroupMember.active.is_(True),
            )
            .distinct()
            .all()
        )
        student_ids = {s[0] for s in course_students}

    # Also include any students who have allocations (in case they're not in groups)
    for alloc in allocations:
        student_ids.add(alloc.reviewee_id)
        student_ids.add(alloc.reviewer_id)

    total_students = len(student_ids)

    # Count self-reviews completed
    self_reviews_completed = 0
    for student_id in student_ids:
        self_allocations = [
            a for a in allocations if a.reviewee_id == student_id and a.is_self
        ]
        for alloc in self_allocations:
            scores = (
                db.query(Score)
                .filter(
                    Score.school_id == user.school_id, Score.allocation_id == alloc.id
                )
                .count()
            )
            if scores > 0:
                self_reviews_completed += 1
                break

    # Count total peer reviews
    peer_reviews_total = 0
    for alloc in allocations:
        if not alloc.is_self:
            scores = (
                db.query(Score)
                .filter(
                    Score.school_id == user.school_id, Score.allocation_id == alloc.id
                )
                .count()
            )
            if scores > 0:
                peer_reviews_total += 1

    # Count reflections completed
    reflections_completed = (
        db.query(Reflection)
        .filter(
            Reflection.school_id == user.school_id,
            Reflection.evaluation_id == ev.id,
        )
        .count()
    )

    return StudentProgressKPIs(
        evaluation_id=ev.id,
        total_students=total_students,
        self_reviews_completed=self_reviews_completed,
        peer_reviews_total=peer_reviews_total,
        reflections_completed=reflections_completed,
    )


@router.get("/evaluation/{evaluation_id}/progress/export.csv")
def export_student_progress_csv(
    evaluation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Export student progress as CSV.
    """
    # Reuse the progress endpoint
    data: StudentProgressResponse = get_student_progress(
        evaluation_id, db=db, user=user  # type: ignore
    )

    # CSV bouwen
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(["evaluation_id", data.evaluation_id])
    w.writerow(["total_students", data.total_students])
    w.writerow([])
    w.writerow(
        [
            "user_id",
            "user_name",
            "class_name",
            "team_number",
            "self_assessment_status",
            "peer_reviews_given",
            "peer_reviews_given_expected",
            "peer_reviews_received",
            "peer_reviews_expected",
            "reflection_status",
            "reflection_word_count",
            "total_progress_percent",
            "last_activity",
            "flags",
        ]
    )

    for item in data.items:
        w.writerow(
            [
                item.user_id,
                item.user_name,
                item.class_name or "",
                item.team_number or "",
                item.self_assessment_status,
                item.peer_reviews_given,
                item.peer_reviews_given_expected,
                item.peer_reviews_received,
                item.peer_reviews_expected,
                item.reflection_status,
                item.reflection_word_count or "",
                f"{item.total_progress_percent:.1f}",
                item.last_activity or "",
                ";".join(item.flags),
            ]
        )

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="evaluation_{evaluation_id}_progress.csv"'
        },
    )


@router.post("/evaluation/{evaluation_id}/send-reminders")
def send_evaluation_reminders(
    evaluation_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Send reminder emails to students with incomplete tasks.
    Returns the list of students who were sent reminders.
    """
    # Get evaluation
    ev = (
        db.query(Evaluation)
        .filter(Evaluation.id == evaluation_id, Evaluation.school_id == user.school_id)
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    # Get student progress to identify who needs reminders
    progress_data = get_student_progress(evaluation_id, db=db, user=user)  # type: ignore

    # Filter students who need reminders (progress < 100%)
    students_needing_reminders = [
        s for s in progress_data.items if s.total_progress_percent < 100
    ]

    # TODO: Implement actual email sending here
    # For now, we'll just return the list of students who would receive reminders

    # Prepare reminder details
    reminders_sent = []
    for student in students_needing_reminders:
        student_user = db.get(User, student.user_id)
        if not student_user:
            continue

        # Determine what's incomplete
        tasks_incomplete = []
        if student.self_assessment_status != "completed":
            tasks_incomplete.append("Zelfbeoordeling")
        if student.peer_reviews_received < student.peer_reviews_expected:
            tasks_incomplete.append(
                f"Peer reviews ({student.peer_reviews_received}/{student.peer_reviews_expected})"
            )
        if student.reflection_status != "completed":
            tasks_incomplete.append("Reflectie")

        # TODO: Send actual email using SMTP
        # Example: send_email(
        #     to=student_user.email,
        #     subject=f"Herinnering: Evaluatie '{ev.title}' nog niet afgerond",
        #     body=f"Beste {student.user_name},\n\n"
        #          f"Je hebt je evaluatie nog niet afgerond. De volgende onderdelen ontbreken:\n"
        #          f"- {chr(10).join(tasks_incomplete)}\n\n"
        #          f"Klik hier om verder te gaan: [link]\n\n"
        #          f"Met vriendelijke groet,\nTeam Evaluatie App"
        # )

        reminders_sent.append(
            {
                "user_id": student.user_id,
                "user_name": student.user_name,
                "email": student_user.email,
                "tasks_incomplete": tasks_incomplete,
                "progress_percent": student.total_progress_percent,
            }
        )

    return {
        "evaluation_id": evaluation_id,
        "reminders_sent": len(reminders_sent),
        "students": reminders_sent,
        "message": f"{len(reminders_sent)} herinnering(en) verzonden (simulatie - email functionaliteit nog niet geïmplementeerd)",
    }

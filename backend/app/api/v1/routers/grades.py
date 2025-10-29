from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.infra.db.models import User, Grade
from app.api.v1.schemas.grades import (
    GradePreviewItem,
    GradePreviewResponse,
    GradeDraftRequest,
    GradePublishRequest,
    PublishedGradeOut,
)

router = APIRouter()


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


# Probeer group/evaluation te importeren; val veilig terug als de modellen anders heten/ontbreken
try:
    from app.infra.db.models import GroupMember, Group, Evaluation

    HAS_GROUP_MODELS = True
except Exception:
    GroupMember = Group = Evaluation = None  # type: ignore
    HAS_GROUP_MODELS = False


# ------------------------------------------------------------
# Hulpfunctie: bepaal course_id (cluster) voor deze evaluatie
# ------------------------------------------------------------
def resolve_course_id(
    db: Session, evaluation_id: int, explicit_course_id: Optional[int]
) -> Optional[int]:
    if explicit_course_id is not None:
        return explicit_course_id
    if HAS_GROUP_MODELS:
        try:
            ev = db.get(Evaluation, evaluation_id)
            if ev is not None and hasattr(ev, "course_id"):
                return getattr(ev, "course_id")
        except Exception:
            pass
    return None


# ------------------------------------------------------------
# PREVIEW: alle studenten in de cluster (course) + team 1..N
# ------------------------------------------------------------
@router.get("/grades/preview", response_model=GradePreviewResponse)
def preview_grades(
    evaluation_id: int,
    group_grade: Optional[float] = None,
    course_id: Optional[int] = Query(default=None),  # optionele override
    db: Session = Depends(get_db),
):
    """
    Voor de gegeven evaluatie (of expliciete course_id):
    - Neem ALLE studenten die in deze cluster (course) een ACTIEVE membership hebben
      (group_members.active = true) en zelf niet gearchiveerd zijn (users.archived = false).
    - Nummer teams 1..N binnen de cluster (course) op basis van alle groups(course_id).
    - Géén fallback die inactieven terugbrengt.
    """
    course = resolve_course_id(db, evaluation_id, course_id)

    # 1) Bouw team-index 1..N binnen de course
    team_index_by_gid: Dict[int, int] = {}
    if HAS_GROUP_MODELS and course is not None:
        try:
            groups_for_course = (
                db.query(Group.id, Group.name)
                .filter(Group.course_id == course)
                .order_by(
                    Group.name.asc(), Group.id.asc()
                )  # pas volgorde aan naar wens
                .all()
            )
            for idx, (gid, _name) in enumerate(groups_for_course, start=1):
                team_index_by_gid[gid] = idx
        except Exception as e:
            print(f"[grades.preview] groups for course failed: {e!r}")
            team_index_by_gid = {}

    # 2) Haal ALLE studenten in deze cluster met actieve membership (en niet-archived)
    students: List[User] = []
    team_gid_by_uid: Dict[int, Optional[int]] = {}
    if HAS_GROUP_MODELS and course is not None:
        try:
            gm_rows = (
                db.query(GroupMember.user_id, GroupMember.group_id, GroupMember.active)
                .join(Group, GroupMember.group_id == Group.id)
                .filter(Group.course_id == course)
                .all()
            )
            active_uid_set = {uid for uid, _gid, gm_active in gm_rows if gm_active}
            for uid, gid, gm_active in gm_rows:
                if gm_active:
                    team_gid_by_uid[uid] = gid

            if active_uid_set:
                students = (
                    db.query(User)
                    .filter(
                        User.role == "student",
                        User.archived.is_(False),  # uitsluitend niet-gearchiveerd
                        User.id.in_(active_uid_set),
                    )
                    .order_by(User.name.asc())
                    .all()
                )
        except Exception as e:
            print(f"[grades.preview] course-membership join failed: {e!r}")

    # 3) Laatste fallback (geen course of geen actieve memberships): leeg of alle niet-archived studenten
    if not students:
        # We kiezen hier voor: géén willekeurige fallback die inactieven of buiten-cluster terugbrengt.
        # Wil je hier wél "alle niet-archived studenten" tonen, haal dan het comment-blok hieronder weg.
        #
        # students = (
        #     db.query(User)
        #     .filter(User.role == "student", User.archived == False)
        #     .order_by(User.name.asc())
        #     .all()
        # )
        students = []

    # 4) Defaults (tot je echte berekeningen zijn aangesloten)
    DEFAULT_GROUP = group_grade if group_grade is not None else 7.0

    # ---- Scores ophalen per student ----
    from statistics import mean

    try:
        from app.infra.db.models import Allocation, Score, Rubric, RubricCriterion
    except Exception:
        Allocation = Score = Rubric = RubricCriterion = None  # type: ignore

    # rubricschaal
    scale_min = 1
    scale_max = 5
    crit_weights: dict[int, float] = {}
    if Evaluation and Rubric and RubricCriterion:
        ev = db.get(Evaluation, evaluation_id)
        if ev:
            rub = db.get(Rubric, getattr(ev, "rubric_id", None))
            if rub:
                if hasattr(rub, "scale_min"):
                    scale_min = getattr(rub, "scale_min") or 1
                if hasattr(rub, "scale_max"):
                    scale_max = getattr(rub, "scale_max") or 5
            # criteria + gewichten
            if getattr(ev, "rubric_id", None) is not None:
                rows = (
                    db.query(RubricCriterion)
                    .filter(
                        RubricCriterion.school_id == getattr(ev, "school_id", None),
                        RubricCriterion.rubric_id == ev.rubric_id,
                    )
                    .all()
                )
                for rc in rows:
                    crit_weights[getattr(rc, "id")] = float(getattr(rc, "weight", 1.0))

    def alloc_percent(alloc_id: int) -> float | None:
        if not Score:
            return None
        rows = db.query(Score).filter(Score.allocation_id == alloc_id).all()
        if not rows:
            return None
        num = 0.0
        den = 0.0
        rng = max(1, (scale_max - scale_min))
        for r in rows:
            w = crit_weights.get(getattr(r, "criterion_id"), 1.0)
            s = float(getattr(r, "score", 0))
            norm = (s - scale_min) / rng
            num += w * norm
            den += w
        if den <= 0:
            return None
        return 100.0 * (num / den)

    # Bereken per student: peer_avg_pct, self_pct en team_id
    peer_pct_by_uid: dict[int, float] = {}
    self_pct_by_uid: dict[int, float] = {}
    teamid_by_uid: dict[int, int | None] = {}

    if Allocation:
        for u in students:
            raw_gid = team_gid_by_uid.get(u.id)
            neat_team = team_index_by_gid.get(raw_gid) if raw_gid is not None else None
            teamid_by_uid[u.id] = raw_gid

            allocs = (
                db.query(Allocation)
                .filter(
                    Allocation.reviewee_id == u.id,
                    # als je een evaluation_id veld hebt op Allocation, filter:
                    *(
                        [getattr(Allocation, "evaluation_id") == evaluation_id]
                        if hasattr(Allocation, "evaluation_id")
                        else []
                    ),
                )
                .all()
            )
            if not allocs:
                continue
            peer_vals = []
            self_vals = []
            for a in allocs:
                pct = alloc_percent(getattr(a, "id"))
                if pct is None:
                    continue
                is_self = False
                if hasattr(a, "is_self"):
                    is_self = bool(getattr(a, "is_self"))
                elif hasattr(a, "reviewer_id"):
                    is_self = getattr(a, "reviewer_id") == u.id
                if is_self:
                    self_vals.append(pct)
                else:
                    peer_vals.append(pct)
            if peer_vals:
                peer_pct_by_uid[u.id] = mean(peer_vals)
            if self_vals:
                self_pct_by_uid[u.id] = mean(self_vals)

    # GCF: normaliseer peer_avg binnen team naar mean==1.0
    gcf_by_uid: dict[int, float] = {}
    # verzamel per raw group id
    by_team: dict[int | None, list[float]] = {}
    for uid, pct in peer_pct_by_uid.items():
        by_team.setdefault(teamid_by_uid.get(uid), []).append(pct)
    team_mean: dict[int | None, float] = {
        tid: mean(vals) for tid, vals in by_team.items() if vals
    }
    for uid, pct in peer_pct_by_uid.items():
        t = teamid_by_uid.get(uid)
        m = team_mean.get(t)
        gcf_by_uid[uid] = (pct / m) if (m and m > 0) else 1.0

    items: List[GradePreviewItem] = []
    for u in students:
        raw_gid = team_gid_by_uid.get(u.id)
        neat_team = team_index_by_gid.get(raw_gid) if raw_gid is not None else None
        avg_score = float(peer_pct_by_uid.get(u.id, 0.0))  # 0..100
        gcf = float(gcf_by_uid.get(u.id, 1.0))
        # SPR = self% / peer%
        self_pct = self_pct_by_uid.get(u.id)
        spr = (
            float(self_pct / avg_score)
            if (self_pct is not None and avg_score > 0)
            else 0.0
        )

        # --- Suggestie op basis van Peer en Self (1–10 schaal) ---
        P = (avg_score / 10.0) if avg_score > 0 else None
        S = (self_pct / 10.0) if (self_pct is not None and self_pct > 0) else None

        if P is not None and S is not None:
            # 75% peer, 25% self: gebalanceerd en robuust
            suggested_val = 0.75 * P + 0.25 * S

            # Optioneel: lichte SPR-correctie (max ±10% effect)
            spr_val = (S / P) if P > 0 else 1.0
            spr_val = max(0.90, min(1.10, spr_val))
            suggested_val *= spr_val

        elif P is not None:
            suggested_val = P
        elif S is not None:
            suggested_val = S
        else:
            # Geen peer en geen self evaluaties: geen voorstel
            suggested_val = None

        # afronden en begrenzen (alleen als er een waarde is)
        suggested = clamp(round(suggested_val, 1), 1.0, 10.0) if suggested_val is not None else None

        raw_gid = team_gid_by_uid.get(u.id)
        neat_team = team_index_by_gid.get(raw_gid) if raw_gid is not None else None

        items.append(
            GradePreviewItem(
                user_id=u.id,
                user_name=u.name,
                avg_score=avg_score,  # 0..100 (placeholder)
                gcf=gcf,  # placeholder
                spr=spr,  # placeholder
                suggested_grade=suggested,  # 1–10
                team_number=neat_team,  # 1..N binnen cluster of None -> "–"
                class_name=getattr(u, "class_name", None),
            )
        )

    return GradePreviewResponse(evaluation_id=evaluation_id, items=items)


# ------------------------------------------------------------
# CONCEPT OPSLAAN: upsert in Grade (grade kan None zijn)
# ------------------------------------------------------------
@router.post("/grades/draft")
def save_draft(payload: GradeDraftRequest, db: Session = Depends(get_db)):
    preview = preview_grades(
        evaluation_id=payload.evaluation_id,
        group_grade=payload.group_grade,
        course_id=None,  # evaluatie bepaalt course; je mag hier ook een course_id doorgeven
        db=db,
    )
    preview_by_uid: Dict[int, GradePreviewItem] = {i.user_id: i for i in preview.items}

    for uid, ov in payload.overrides.items():
        item = preview_by_uid.get(uid)
        if not item:
            # uid zit niet in de (actieve) clusterlijst -> sla over
            continue

        u = db.get(User, uid)
        if not u:
            continue

        meta = {
            "avg_score": item.avg_score,
            "gcf": item.gcf,
            "spr": item.spr,
            "suggested": item.suggested_grade,
            "group_grade": ov.rowGroupGrade or payload.group_grade,
            "team_number": item.team_number,  # nette 1..N
            "class_name": item.class_name,
        }

        row: Optional[Grade] = (
            db.query(Grade)
            .filter(Grade.evaluation_id == payload.evaluation_id, Grade.user_id == uid)
            .one_or_none()
        )
        if row is None:
            row = Grade(
                school_id=u.school_id,
                evaluation_id=payload.evaluation_id,
                user_id=uid,
            )

        row.grade = ov.grade  # mag None zijn (concept)
        row.override_reason = ov.reason
        row.meta = meta
        db.add(row)

    db.commit()
    return {"status": "ok"}


# ------------------------------------------------------------
# PUBLICEREN: upsert met definitieve grade (1–10)
# ------------------------------------------------------------
@router.post("/grades/publish")
def publish_grades(payload: GradePublishRequest, db: Session = Depends(get_db)):
    preview = preview_grades(
        evaluation_id=payload.evaluation_id,
        group_grade=payload.group_grade,
        course_id=None,
        db=db,
    )
    preview_by_uid: Dict[int, GradePreviewItem] = {i.user_id: i for i in preview.items}

    for uid, ov in payload.overrides.items():
        item = preview_by_uid.get(uid)
        if not item:
            continue

        u = db.get(User, uid)
        if not u:
            continue

        meta = {
            "avg_score": item.avg_score,
            "gcf": item.gcf,
            "spr": item.spr,
            "suggested": item.suggested_grade,
            "group_grade": ov.rowGroupGrade or payload.group_grade,
            "team_number": item.team_number,  # nette 1..N
            "class_name": item.class_name,
        }

        row: Optional[Grade] = (
            db.query(Grade)
            .filter(Grade.evaluation_id == payload.evaluation_id, Grade.user_id == uid)
            .one_or_none()
        )
        if row is None:
            row = Grade(
                school_id=u.school_id,
                evaluation_id=payload.evaluation_id,
                user_id=uid,
            )

        row.grade = ov.grade  # definitief 1–10
        row.override_reason = ov.reason
        row.meta = meta
        db.add(row)

    db.commit()
    return {"status": "ok"}


# ------------------------------------------------------------
# LIST: merge preview (actieve cluster) + opgeslagen gegevens
# ------------------------------------------------------------
@router.get("/grades", response_model=List[PublishedGradeOut])
def list_grades(
    evaluation_id: int,
    course_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    # Altijd leidend: preview (actieve leerlingen in de cluster)
    preview = preview_grades(
        evaluation_id=evaluation_id, group_grade=None, course_id=course_id, db=db
    )
    by_uid = {i.user_id: i for i in preview.items}

    # ✅ Belangrijk: als de preview leeg is, voorkom een SQL 'IN ()' en geef meteen leeg terug.
    # Dit voorkomt een 500 (Postgres vindt 'IN ()' ongeldig).
    if not by_uid:
        return []

    # Alleen grade-rows voor deze evaluatie, maar we nemen uitsluitend uids die in de preview zitten
    # (Door de early return hierboven is de lijst keys hier gegarandeerd niet leeg.)
    rows: List[Grade] = (
        db.query(Grade)
        .filter(
            Grade.evaluation_id == evaluation_id,
            Grade.user_id.in_(list(by_uid.keys())),
        )
        .all()
    )
    rows_by_uid = {g.user_id: g for g in rows}

    out: List[PublishedGradeOut] = []
    for uid, item in by_uid.items():
        g: Optional[Grade] = rows_by_uid.get(uid)
        u: Optional[User] = db.get(User, uid)

        raw_meta = (g.meta if (g and getattr(g, "meta", None)) else {}) or {}
        has_saved = g is not None and (g.grade is not None or g.override_reason)

        meta = {
            "avg_score": item.avg_score,
            "gcf": item.gcf,
            "spr": item.spr,
            "suggested": item.suggested_grade,
            "group_grade": raw_meta.get("group_grade"),
            "team_number": item.team_number,  # al 1..N binnen cluster
            "class_name": (
                item.class_name
                if item.class_name is not None
                else getattr(u, "class_name", None)
            ),
            **raw_meta,
            "has_saved": has_saved,
            "status": "saved" if has_saved else "preview_only",
        }

        out.append(
            PublishedGradeOut(
                evaluation_id=evaluation_id,
                user_id=uid,
                user_name=item.user_name,
                grade=(g.grade if g else None),
                reason=(g.override_reason if g else None),
                meta=meta,
            )
        )

    # Belangrijk: géén extra DB-rows toevoegen die niet in preview zitten (voorkomt inactief/andere course)
    out.sort(key=lambda x: x.user_name.lower())
    return out

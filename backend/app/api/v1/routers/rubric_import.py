from __future__ import annotations

import csv
import io
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db, get_current_user
from app.infra.db.models import (
    Rubric,
    RubricCriterion,
    LearningObjective,
    RubricCriterionLearningObjective,
)
from app.api.v1.schemas.rubric_import import (
    CsvCriterionRow,
    CsvRubricGroup,
    CsvImportResult,
    CsvPreviewResult,
    PreviewRubric,
    PreviewCriterion,
    ResolvedLearningObjective,
)

router = APIRouter(prefix="/rubrics", tags=["rubric-import"])

REQUIRED_COLUMNS = {"rubric_title", "criterion_name", "scope"}
VALID_SCOPES = {"peer", "project"}
VALID_TARGET_LEVELS = {"onderbouw", "bovenbouw"}
ALLOWED_CONTENT_TYPES = {"text/csv", "text/plain", "application/vnd.ms-excel"}

# DoS protection – same limits as teachers.py / admin_students.py
MAX_CSV_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_CSV_ROWS = 10_000  # maximum number of data rows


def _decode_file(content: bytes) -> str:
    """Decodeer met utf-8-sig (Excel BOM), fallback naar latin-1."""
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return content.decode("latin-1")


def _parse_learning_objective_orders(raw: str) -> List[int]:
    """Parse puntkomma-gescheiden nummers naar een lijst integers."""
    if not raw or not raw.strip():
        return []
    result = []
    for part in raw.split(";"):
        part = part.strip()
        if part:
            try:
                result.append(int(part))
            except ValueError:
                pass
    return result


def _check_row_limit(text: str) -> None:
    """
    Gooi HTTPException als het CSV meer dan MAX_CSV_ROWS gegevensrijen heeft.
    Consistent met de check in teachers.py / admin_students.py.
    """
    # Snelle telbenadering: tel newlines, trek de kopregel af
    data_lines = text.count("\n") - 1
    if data_lines > MAX_CSV_ROWS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Te veel rijen in CSV. Maximum is {MAX_CSV_ROWS} rijen.",
        )


def _parse_csv(
    text: str,
) -> Tuple[List[CsvRubricGroup], List[str], List[str]]:
    """
    Parseer CSV-tekst naar CsvRubricGroup objecten.
    Retourneert (rubric_groups, errors, warnings).
    """
    errors: List[str] = []
    warnings: List[str] = []

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        errors.append("CSV-bestand is leeg of heeft geen kopregel.")
        return [], errors, warnings

    fieldnames = {f.strip().lower() for f in reader.fieldnames}

    # Controleer verplichte kolommen
    missing = REQUIRED_COLUMNS - fieldnames
    if missing:
        errors.append(f"Verplichte kolommen ontbreken: {', '.join(sorted(missing))}")
        return [], errors, warnings

    # Waarschuw voor onbekende kolommen
    known_columns = {
        "rubric_title",
        "rubric_description",
        "scope",
        "target_level",
        "scale_min",
        "scale_max",
        "criterion_name",
        "category",
        "weight",
        "level1",
        "level2",
        "level3",
        "level4",
        "level5",
        "learning_objectives",
    }
    unknown = fieldnames - known_columns
    if unknown:
        warnings.append(
            f"Onbekende kolommen worden genegeerd: {', '.join(sorted(unknown))}"
        )

    # Groepeer rijen per rubric_title
    rubric_map: Dict[str, CsvRubricGroup] = {}
    rubric_order: List[str] = []
    row_count = 0

    for row_num, raw_row in enumerate(reader, start=2):
        row_count += 1

        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items() if k}

        rubric_title = row.get("rubric_title", "").strip()
        criterion_name = row.get("criterion_name", "").strip()
        scope = row.get("scope", "").strip().lower()

        if not rubric_title:
            errors.append(f"Rij {row_num}: rubric_title is leeg.")
            continue
        if not criterion_name:
            errors.append(f"Rij {row_num}: criterion_name is leeg.")
            continue
        if scope not in VALID_SCOPES:
            errors.append(
                f"Rij {row_num}: ongeldige scope '{scope}'. "
                f"Moet 'peer' of 'project' zijn."
            )
            continue

        # Groep aanmaken als nog niet bestaat; anders conflicten controleren
        if rubric_title in rubric_map:
            existing = rubric_map[rubric_title]
            if existing.scope != scope:
                warnings.append(
                    f"Rij {row_num}: rubric '{rubric_title}' heeft scope "
                    f"'{scope}', maar eerder was '{existing.scope}' opgegeven. "
                    f"De eerste waarde wordt gebruikt."
                )
        else:
            target_level_raw = row.get("target_level", "").strip().lower() or None
            if target_level_raw and target_level_raw not in VALID_TARGET_LEVELS:
                warnings.append(
                    f"Rij {row_num}: ongeldig target_level '{target_level_raw}'. "
                    f"Wordt genegeerd."
                )
                target_level_raw = None

            try:
                scale_min = int(row.get("scale_min", "1") or "1")
            except ValueError:
                scale_min = 1
            try:
                scale_max = int(row.get("scale_max", "5") or "5")
            except ValueError:
                scale_max = 5

            rubric_map[rubric_title] = CsvRubricGroup(
                rubric_title=rubric_title,
                rubric_description=row.get("rubric_description") or None,
                scope=scope,
                target_level=target_level_raw,
                scale_min=scale_min,
                scale_max=scale_max,
                criteria=[],
            )
            rubric_order.append(rubric_title)

        # Gewicht parsen
        weight_raw = row.get("weight", "").strip()
        try:
            weight = float(weight_raw) if weight_raw else 1.0
        except ValueError:
            warnings.append(
                f"Rij {row_num}: ongeldig gewicht '{weight_raw}'. "
                f"Standaard 1.0 wordt gebruikt."
            )
            weight = 1.0

        # Leerdoelen parsen
        lo_orders = _parse_learning_objective_orders(row.get("learning_objectives", ""))

        criterion = CsvCriterionRow(
            criterion_name=criterion_name,
            category=row.get("category") or None,
            weight=weight,
            level1=row.get("level1", ""),
            level2=row.get("level2", ""),
            level3=row.get("level3", ""),
            level4=row.get("level4", ""),
            level5=row.get("level5", ""),
            learning_objective_orders=lo_orders,
        )
        rubric_map[rubric_title].criteria.append(criterion)

    rubric_groups = [rubric_map[title] for title in rubric_order]

    if row_count == 0:
        warnings.append("CSV-bestand bevat geen gegevensrijen.")

    # Valideer en normaliseer gewichten per rubric
    for group in rubric_groups:
        if not group.criteria:
            continue
        total_weight = sum(c.weight for c in group.criteria)
        if abs(total_weight - 1.0) > 0.01 and total_weight > 0:
            warnings.append(
                f"Rubric '{group.rubric_title}': totaal gewicht is "
                f"{total_weight:.4f}, wordt genormaliseerd naar 1.0."
            )
            for c in group.criteria:
                c.weight = c.weight / total_weight

    return rubric_groups, errors, warnings


def _batch_fetch_learning_objectives(
    db: Session,
    orders: List[int],
    school_id: int,
    subject_id: Optional[int] = None,
) -> Dict[int, List[LearningObjective]]:
    """
    Haal alle gevraagde leerdoelen op in één query (batch).
    Retourneert een dict: order → list[LearningObjective].
    Alleen is_template=True objecten worden meegenomen.
    Wanneer subject_id opgegeven is, worden alleen leerdoelen van dat vak opgehaald.
    """
    if not orders:
        return {}
    query = select(LearningObjective).where(
        LearningObjective.school_id == school_id,
        LearningObjective.is_template.is_(True),
        LearningObjective.order.in_(orders),
    )
    if subject_id is not None:
        query = query.where(LearningObjective.subject_id == subject_id)
    results = db.execute(query).scalars().all()
    lookup: Dict[int, List[LearningObjective]] = {}
    for lo in results:
        lookup.setdefault(lo.order, []).append(lo)
    return lookup


def _lookup_lo_ids_from_cache(
    cache: Dict[int, List[LearningObjective]],
    orders: List[int],
    rubric_title: str,
    criterion_name: str,
    warnings: List[str],
    phase: Optional[str] = None,
) -> List[int]:
    """
    Zet order-nummers om naar LearningObjective IDs via de batch-cache.
    Geeft waarschuwingen als een nummer niet gevonden is of meerdere matches heeft.
    Wanneer phase opgegeven is, worden alleen leerdoelen van die fase meegenomen.
    """
    lo_ids: List[int] = []
    for order in orders:
        matches = cache.get(order, [])
        if phase:
            matches = [lo for lo in matches if lo.phase == phase]
        if not matches:
            warnings.append(
                f"Rubric '{rubric_title}', criterium '{criterion_name}': "
                f"leerdoel met nummer {order} niet gevonden."
            )
        elif len(matches) > 1:
            warnings.append(
                f"Rubric '{rubric_title}', criterium '{criterion_name}': "
                f"meerdere leerdoelen met nummer {order} gevonden. "
                f"Eerste match wordt gebruikt."
            )
            lo_ids.append(matches[0].id)
        else:
            lo_ids.append(matches[0].id)
    return lo_ids


def _resolve_lo_for_preview_from_cache(
    cache: Dict[int, List[LearningObjective]],
    orders: List[int],
    phase: Optional[str] = None,
) -> List[ResolvedLearningObjective]:
    """
    Zet order-nummers om naar ResolvedLearningObjective objecten via de batch-cache.
    Wanneer phase opgegeven is, worden alleen leerdoelen van die fase meegenomen.
    """
    resolved: List[ResolvedLearningObjective] = []
    for order in orders:
        matches = cache.get(order, [])
        if phase:
            matches = [lo for lo in matches if lo.phase == phase]
        if matches:
            lo = matches[0]
            resolved.append(
                ResolvedLearningObjective(
                    order=order,
                    found=True,
                    title=lo.title,
                    domain=lo.domain,
                )
            )
        else:
            resolved.append(ResolvedLearningObjective(order=order, found=False))
    return resolved


def _check_existing_rubric_titles(
    db: Session,
    rubric_groups: List[CsvRubricGroup],
    school_id: int,
    warnings: List[str],
) -> None:
    """
    Voeg een waarschuwing toe voor elke rubric-titel die al bestaat voor deze school.
    De import gaat door – er wordt een tweede rubric met dezelfde naam aangemaakt.
    """
    titles = [g.rubric_title for g in rubric_groups]
    if not titles:
        return
    existing = (
        db.execute(
            select(Rubric.title).where(
                Rubric.school_id == school_id,
                Rubric.title.in_(titles),
            )
        )
        .scalars()
        .all()
    )
    for title in existing:
        warnings.append(
            f"Rubric '{title}' bestaat al voor deze school. "
            f"Er wordt een tweede rubric met dezelfde naam aangemaakt."
        )


def _collect_all_lo_orders(rubric_groups: List[CsvRubricGroup]) -> List[int]:
    """Verzamel alle unieke leerdoel-order-nummers uit alle criteria."""
    orders: List[int] = []
    seen: set = set()
    for group in rubric_groups:
        for c in group.criteria:
            for o in c.learning_objective_orders:
                if o not in seen:
                    seen.add(o)
                    orders.append(o)
    return orders


@router.post(
    "/import-csv/preview",
    response_model=CsvPreviewResult,
    status_code=status.HTTP_200_OK,
)
async def preview_csv_import(
    file: UploadFile = File(...),
    subject_id: Optional[int] = Query(
        None, description="Filter leerdoelen op vak (voorkomt dubbele nummers)"
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Preview de CSV import: parseert en valideert maar slaat NIET op in de database.
    Retourneert per rubric een overzicht met criteria en resolved leerdoelen.
    """
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES and not (file.filename or "").endswith(
        ".csv"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alleen CSV-bestanden zijn toegestaan.",
        )

    content = await file.read()

    if len(content) > MAX_CSV_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Bestand te groot. Maximum is "
                f"{MAX_CSV_FILE_SIZE // (1024 * 1024)} MB."
            ),
        )

    text = _decode_file(content)
    _check_row_limit(text)

    rubric_groups, errors, warnings = _parse_csv(text)

    if errors:
        return CsvPreviewResult(errors=errors, warnings=warnings, valid=False)

    # Batch-fetch alle benodigde leerdoelen in één query
    all_orders = _collect_all_lo_orders(rubric_groups)
    lo_cache = _batch_fetch_learning_objectives(
        db, all_orders, user.school_id, subject_id
    )
    _check_existing_rubric_titles(db, rubric_groups, user.school_id, warnings)

    preview_rubrics: List[PreviewRubric] = []

    for group in rubric_groups:
        preview_criteria: List[PreviewCriterion] = []
        for c in group.criteria:
            resolved_los = _resolve_lo_for_preview_from_cache(
                lo_cache, c.learning_objective_orders, group.target_level
            )
            has_descriptors = any([c.level1, c.level2, c.level3, c.level4, c.level5])
            preview_criteria.append(
                PreviewCriterion(
                    name=c.criterion_name,
                    category=c.category,
                    weight=round(c.weight, 4),
                    has_descriptors=has_descriptors,
                    learning_objectives=resolved_los,
                )
            )
        preview_rubrics.append(
            PreviewRubric(
                title=group.rubric_title,
                scope=group.scope,
                criteria_count=len(group.criteria),
                criteria=preview_criteria,
            )
        )

    return CsvPreviewResult(
        rubrics=preview_rubrics,
        errors=errors,
        warnings=warnings,
        valid=len(errors) == 0,
    )


@router.post(
    "/import-csv",
    response_model=CsvImportResult,
    status_code=status.HTTP_200_OK,
)
async def import_csv(
    file: UploadFile = File(...),
    subject_id: Optional[int] = Query(
        None, description="Filter leerdoelen op vak (voorkomt dubbele nummers)"
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Importeer rubrics uit een CSV-bestand.
    Maakt Rubric, RubricCriterion en RubricCriterionLearningObjective records aan.
    """
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES and not (file.filename or "").endswith(
        ".csv"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alleen CSV-bestanden zijn toegestaan.",
        )

    content = await file.read()

    if len(content) > MAX_CSV_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Bestand te groot. Maximum is "
                f"{MAX_CSV_FILE_SIZE // (1024 * 1024)} MB."
            ),
        )

    text = _decode_file(content)
    _check_row_limit(text)

    rubric_groups, errors, warnings = _parse_csv(text)

    if errors:
        return CsvImportResult(errors=errors, warnings=warnings)

    # Batch-fetch alle benodigde leerdoelen in één query
    all_orders = _collect_all_lo_orders(rubric_groups)
    lo_cache = _batch_fetch_learning_objectives(
        db, all_orders, user.school_id, subject_id
    )
    _check_existing_rubric_titles(db, rubric_groups, user.school_id, warnings)

    created_rubrics = 0
    created_criteria = 0
    linked_objectives = 0
    rubric_ids: List[int] = []

    for group in rubric_groups:
        # Rubric aanmaken
        rubric = Rubric(
            school_id=user.school_id,
            title=group.rubric_title,
            description=group.rubric_description,
            scale_min=group.scale_min,
            scale_max=group.scale_max,
            scope=group.scope,
            target_level=group.target_level,
            metadata_json={"imported_from": "csv"},
        )
        db.add(rubric)
        db.flush()
        rubric_ids.append(rubric.id)
        created_rubrics += 1

        for c in group.criteria:
            descriptors = {
                "level1": c.level1,
                "level2": c.level2,
                "level3": c.level3,
                "level4": c.level4,
                "level5": c.level5,
            }
            criterion = RubricCriterion(
                school_id=user.school_id,
                rubric_id=rubric.id,
                name=c.criterion_name,
                weight=c.weight,
                descriptors=descriptors,
                category=c.category,
            )
            db.add(criterion)
            db.flush()
            created_criteria += 1

            # Leerdoelen koppelen via batch-cache
            lo_ids = _lookup_lo_ids_from_cache(
                lo_cache,
                c.learning_objective_orders,
                group.rubric_title,
                c.criterion_name,
                warnings,
                group.target_level,
            )
            for lo_id in lo_ids:
                assoc = RubricCriterionLearningObjective(
                    school_id=user.school_id,
                    criterion_id=criterion.id,
                    learning_objective_id=lo_id,
                )
                db.add(assoc)
                linked_objectives += 1

    db.commit()

    return CsvImportResult(
        created_rubrics=created_rubrics,
        created_criteria=created_criteria,
        linked_objectives=linked_objectives,
        errors=errors,
        warnings=warnings,
        rubric_ids=rubric_ids,
    )

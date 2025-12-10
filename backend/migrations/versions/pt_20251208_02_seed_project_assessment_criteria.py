"""Seed project assessment criterion templates (VWO bovenbouw) from JSON.

- Leest project_assessment_criteria_vwo_bovenbouw.json
- Koppelt criteria aan bovenbouw-eindtermen op basis van code + domein:
    "A1"  -> domain="A", code="1"
    "E24" -> domain="E", code="24"
- Maakt records in project_assessment_criterion_templates voor alle scholen (subject_id = 1, target_level = 'bovenbouw').

Revision ID: pt_20251208_02
Revises: 20251207_peer_criteria
Create Date: 2025-12-08
"""

from alembic import op
import sqlalchemy as sa
import json
from pathlib import Path

# Alembic identifiers
revision = "pt_20251208_02"
down_revision = "20251207_peer_criteria"
branch_labels = None
depends_on = None


def _load_json(name: str):
    """
    Laadt JSON uit backend/data/templates/<name>.

    Vanuit dit bestand:
      migrations/versions/ -> migrations/ -> backend/
    """
    base_dir = Path(__file__).resolve().parents[2]
    path = base_dir / "data" / "templates" / name
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _resolve_learning_objective_ids(
    conn, school_id: int, subject_id: int, lo_codes: list[str]
) -> list[int]:
    """
    Zet een lijst codes zoals ["A1", "E24", "24"] om naar learning_objective-IDs.

    - Bovenbouw: "A1" -> domain="A", metadata_json->>'code'="1"
    - Alleen nummer: "24" -> alleen match op metadata_json->>'code'="24"
    - Onherkenbare codes worden genegeerd.
    """
    ids: list[int] = []

    for raw in lo_codes:
        lo_code_str = str(raw)

        domain = None
        code_value = None

        # Patroon: A1, B4, C16, E24, F35, ...
        if (
            len(lo_code_str) >= 2
            and lo_code_str[0] in ["A", "B", "C", "D", "E", "F"]
            and lo_code_str[1:].isdigit()
        ):
            domain = lo_code_str[0]
            code_value = lo_code_str[1:]
        elif lo_code_str.isdigit():
            # Alleen een nummer ("24") -> geen domeinfilter
            code_value = lo_code_str
        else:
            # Onbekend formaat (bijv. typefout); sla stilletjes over
            continue

        if code_value is None:
            continue

        if domain:
            sql = sa.text(
                """
                SELECT id
                FROM learning_objectives
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND is_template = TRUE
                  AND metadata_json->>'code' = :code
                  AND domain = :domain
                """
            )
            params = {
                "school_id": school_id,
                "subject_id": subject_id,
                "code": code_value,
                "domain": domain,
            }
        else:
            sql = sa.text(
                """
                SELECT id
                FROM learning_objectives
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND is_template = TRUE
                  AND metadata_json->>'code' = :code
                """
            )
            params = {
                "school_id": school_id,
                "subject_id": subject_id,
                "code": code_value,
            }

        result = conn.execute(sql, params)
        row = result.fetchone()
        if row:
            ids.append(row[0])

    return ids


def upgrade():
    conn = op.get_bind()

    # 1. JSON-bestand met projectbeoordelingscriteria laden
    data = _load_json("project_assessment_criteria_vwo_bovenbouw.json")
    criteria = data.get("project_assessment_criteria", [])

    # 2. Alle scholen ophalen
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()

    SUBJECT_ID = 1  # O&O
    TARGET_LEVEL = "bovenbouw"

    for (school_id,) in schools:
        # 2a. Bestaande bovenbouw-projectcriteria voor dit vak opruimen
        conn.execute(
            sa.text(
                """
                DELETE FROM project_assessment_criterion_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND target_level = :target_level
                """
            ),
            {
                "school_id": school_id,
                "subject_id": SUBJECT_ID,
                "target_level": TARGET_LEVEL,
            },
        )

        # 3. Criteria inserten
        for crit in criteria:
            category = crit[
                "category"
            ]  # "projectproces", "eindresultaat", "communicatie"
            title = crit["title"]
            description = crit.get("description", "") or ""
            target_level = crit.get("target_level", TARGET_LEVEL)
            level_descriptors = crit.get("level_descriptors", {})
            lo_codes = crit.get("learning_objectives", [])

            learning_objective_ids = _resolve_learning_objective_ids(
                conn=conn,
                school_id=school_id,
                subject_id=SUBJECT_ID,
                lo_codes=lo_codes,
            )

            conn.execute(
                sa.text(
                    """
                    INSERT INTO project_assessment_criterion_templates (
                        school_id,
                        subject_id,
                        category,
                        title,
                        description,
                        target_level,
                        level_descriptors,
                        learning_objective_ids,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :school_id,
                        :subject_id,
                        :category,
                        :title,
                        :description,
                        :target_level,
                        CAST(:level_descriptors AS jsonb),
                        CAST(:learning_objective_ids AS jsonb),
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    """
                ),
                {
                    "school_id": school_id,
                    "subject_id": SUBJECT_ID,
                    "category": category,
                    "title": title,
                    "description": description,
                    "target_level": target_level,
                    "level_descriptors": json.dumps(
                        level_descriptors, ensure_ascii=False
                    ),
                    "learning_objective_ids": json.dumps(learning_objective_ids),
                },
            )


def downgrade():
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            DELETE FROM project_assessment_criterion_templates
            WHERE subject_id = :subject_id
              AND target_level = :target_level
            """
        ),
        {"subject_id": 1, "target_level": "bovenbouw"},
    )

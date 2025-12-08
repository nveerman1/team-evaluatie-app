"""Seed peer evaluation criterion templates from JSON.

- Leegt peer_evaluation_criterion_templates per school.
- Laadt peer_criteria.json en koppelt criteria aan learning objectives op basis van code.

Revision ID: 20251207_peer_criteria
Revises: 20251207_competencies
Create Date: 2025-12-07
"""

from alembic import op
import sqlalchemy as sa
import json
from pathlib import Path

# Alembic identifiers
revision = "20251207_peer_criteria"
down_revision = "20251207_competencies"
branch_labels = None
depends_on = None


def _load_json(name: str):
    """
    Laadt JSON uit backend/data/templates/<name>.

    Gaat vanuit dit bestand:
    migrations/versions/ -> migrations/ -> backend/
    """
    base_dir = Path(__file__).resolve().parents[2]
    path = base_dir / "data" / "templates" / name
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def upgrade():
    conn = op.get_bind()

    # 1. JSON-bestand met alle OMZA-peercriteria laden
    data = _load_json("peer_criteria.json")
    criteria = data.get("criteria", [])

    # 2. Alle scholen ophalen
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()

    for (school_id,) in schools:
        # 2a. Bestande peer-criteria voor deze school weggooien
        conn.execute(
            sa.text(
                """
                DELETE FROM peer_evaluation_criterion_templates
                WHERE school_id = :school_id
                """
            ),
            {"school_id": school_id},
        )

        # 2b. Per criterium invoegen
        for crit in criteria:
            subject_id = crit.get("subject_id", 1)
            omza_category = crit["omza_category"]
            title = crit["title"]
            description = crit.get("description", "") or ""
            target_level = crit.get("target_level")  # None / "onderbouw" / "bovenbouw"
            level_descriptors = crit.get("level_descriptors", {})
            lo_codes = crit.get("learning_objective_codes", [])

            # 2c. Learning objective IDs opzoeken op basis van code
            # We gebruiken metadata_json->>'code' = :code en is_template = TRUE
            learning_objective_ids: list[int] = []

            for code in lo_codes:
                result = conn.execute(
                    sa.text(
                        """
                        SELECT id
                        FROM learning_objectives
                        WHERE school_id = :school_id
                          AND subject_id = :subject_id
                          AND is_template = TRUE
                          AND metadata_json->>'code' = :code
                        """
                    ),
                    {
                        "school_id": school_id,
                        "subject_id": subject_id,
                        "code": str(code),
                    },
                )
                row = result.fetchone()
                if row:
                    learning_objective_ids.append(row[0])

            # 2d. Peer-criterium invoegen
            conn.execute(
                sa.text(
                    """
                    INSERT INTO peer_evaluation_criterion_templates (
                        school_id,
                        subject_id,
                        omza_category,
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
                        :omza_category,
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
                    "subject_id": subject_id,
                    "omza_category": omza_category,
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
    conn.execute(sa.text("DELETE FROM peer_evaluation_criterion_templates"))

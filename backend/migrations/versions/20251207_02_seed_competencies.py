"""Seed competency categories, competencies and rubric levels from JSON.

- Leegt de competency-tabellen voor elke school.
- Voegt competency_categories, competencies en competency_rubric_levels in
  op basis van backend/data/templates/competencies.json.

Revision ID: 20251207_competencies
Revises: 20251207
Create Date: 2025-12-07
"""

from alembic import op
import sqlalchemy as sa
import json
from pathlib import Path

revision = "20251207_competencies"
down_revision = "20251207"  # pas aan als jouw vorige revision anders heet
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

    data = _load_json("competencies.json")
    categories = data.get("categories", [])
    competencies = data.get("competencies", [])

    # Alle scholen
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()

    # Default labels voor schaal
    default_scale_labels = {
        "1": "Beginner",
        "2": "Ontwikkelend",
        "3": "Competent",
        "4": "Gevorderd",
        "5": "Expert",
    }

    for (school_id,) in schools:
        # 1. Bestaande rubric-levels, competencies en categories weg
        conn.execute(
            sa.text(
                """
                DELETE FROM competency_rubric_levels
                WHERE school_id = :school_id
                """
            ),
            {"school_id": school_id},
        )
        conn.execute(
            sa.text(
                """
                DELETE FROM competencies
                WHERE school_id = :school_id
                """
            ),
            {"school_id": school_id},
        )
        conn.execute(
            sa.text(
                """
                DELETE FROM competency_categories
                WHERE school_id = :school_id
                """
            ),
            {"school_id": school_id},
        )

        # 2. Categories invoegen
        category_ids: dict[str, int] = {}

        for cat in categories:
            # verwacht keys: key, name, description, color, icon, order_index
            result = conn.execute(
                sa.text(
                    """
                    INSERT INTO competency_categories (
                        school_id,
                        name,
                        description,
                        color,
                        icon,
                        order_index
                    )
                    VALUES (
                        :school_id,
                        :name,
                        :description,
                        :color,
                        :icon,
                        :order_index
                    )
                    RETURNING id
                    """
                ),
                {
                    "school_id": school_id,
                    "name": cat["name"],
                    "description": cat.get("description", "") or "",
                    "color": cat.get("color"),
                    "icon": cat.get("icon"),
                    "order_index": cat.get("order_index", 0),
                },
            )
            category_id = result.scalar_one()
            category_ids[cat["key"]] = category_id

        # 3. Competenties + rubric levels invoegen
        for comp in competencies:
            # verwacht: category_key, name, description, order, phase?, subject_id?, code?, levels{}
            category_key = comp["category_key"]
            category_id = category_ids.get(category_key)

            # Insert competency zelf
            result = conn.execute(
                sa.text(
                    """
                    INSERT INTO competencies (
                        school_id,
                        category_id,
                        subject_id,
                        teacher_id,
                        course_id,
                        is_template,
                        phase,
                        name,
                        description,
                        "order",
                        active,
                        scale_min,
                        scale_max,
                        scale_labels,
                        metadata_json,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :school_id,
                        :category_id,
                        :subject_id,
                        NULL,
                        NULL,
                        TRUE,
                        :phase,
                        :name,
                        :description,
                        :order,
                        TRUE,
                        1,
                        5,
                        CAST(:scale_labels AS jsonb),
                        CAST(:metadata_json AS jsonb),
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    RETURNING id
                    """
                ),
                {
                    "school_id": school_id,
                    "category_id": category_id,
                    "subject_id": comp.get("subject_id", 1),
                    "phase": comp.get("phase"),  # bv. "onderbouw", "bovenbouw" of None
                    "name": comp["name"],
                    "description": comp.get("description", "") or "",
                    "order": comp.get("order", 0),
                    "scale_labels": json.dumps(default_scale_labels),
                    "metadata_json": json.dumps(
                        {
                            "code": comp.get("code"),
                        }
                    ),
                },
            )
            competency_id = result.scalar_one()

            # Rubric levels
            levels = comp.get("levels", {})
            for level_str, desc in levels.items():
                level = int(level_str)
                label = default_scale_labels.get(level_str, f"Level {level}")

                conn.execute(
                    sa.text(
                        """
                        INSERT INTO competency_rubric_levels (
                            school_id,
                            competency_id,
                            level,
                            label,
                            description
                        )
                        VALUES (
                            :school_id,
                            :competency_id,
                            :level,
                            :label,
                            :description
                        )
                        """
                    ),
                    {
                        "school_id": school_id,
                        "competency_id": competency_id,
                        "level": level,
                        "label": label,
                        "description": desc,
                    },
                )


def downgrade():
    conn = op.get_bind()

    # Alles weer leeg (je vertrouwt op DB-backup voor oude inhoud)
    conn.execute(sa.text("DELETE FROM competency_rubric_levels"))
    conn.execute(sa.text("DELETE FROM competencies"))
    conn.execute(sa.text("DELETE FROM competency_categories"))

"""Seed learning objectives (onderbouw + bovenbouw) from JSON.

- Leegt de tabel learning_objectives.
- Voegt voor elke school alle onderbouw- en bovenbouwleerdoelen in
  als templates voor subject_id = 1 (Onderzoek & Ontwerpen).

Revision ID: 20251207
Revises: subp_20251203_01
Create Date: 2025-12-07
"""

from alembic import op
import sqlalchemy as sa
import json
from pathlib import Path

# Alembic identifiers
revision = "20251207"
down_revision = "subp_20251203_01"
branch_labels = None
depends_on = None


def _load_json(name: str):
    """
    Laadt JSON uit backend/data/templates/<name>.

    Gaat vanuit dit bestand:
    alembic/versions/ -> alembic/ -> backend/
    """
    base_dir = Path(__file__).resolve().parents[2]
    path = base_dir / "data" / "templates" / name
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def upgrade():
    conn = op.get_bind()

    # 1. Alles mag weg: we beginnen met een lege tabel
    #    (je gaf aan: 1a alles mag weg)
    conn.execute(sa.text("DELETE FROM learning_objectives"))

    # 2. JSON-bestanden laden
    onderbouw = _load_json("learning_objectives_onderbouw.json")
    bovenbouw = _load_json("learning_objectives_bovenbouw.json")

    objectives = onderbouw + bovenbouw

    # 3. Alle scholen ophalen
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()

    # 4. Per school alle leerdoelen invoegen
    for (school_id,) in schools:
        for obj in objectives:
            # JSON-items bevatten al: subject_id, code, domain, phase, title, description, order
            metadata = {"code": obj.get("code")}

            conn.execute(
                sa.text(
                    """
                    INSERT INTO learning_objectives (
                        school_id,
                        subject_id,
                        teacher_id,
                        course_id,
                        is_template,
                        domain,
                        title,
                        description,
                        "order",
                        phase,
                        metadata_json,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :school_id,
                        :subject_id,
                        NULL,
                        NULL,
                        TRUE,
                        :domain,
                        :title,
                        :description,
                        :order,
                        :phase,
                        CAST(:metadata_json AS jsonb),
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    """
                ),
                {
                    "school_id": school_id,
                    "subject_id": obj.get("subject_id", 1),
                    "domain": obj["domain"],
                    "title": obj["title"],
                    "description": obj.get("description", "") or "",
                    "order": obj.get("order", 0),
                    "phase": obj["phase"],
                    "metadata_json": json.dumps(metadata),
                },
            )


def downgrade():
    conn = op.get_bind()

    # In jouw situatie: rollback = leerdoelen weer leegmaken.
    # (Als je oude data terug wilt, gebruik je een DB-backup.)
    conn.execute(sa.text("DELETE FROM learning_objectives"))

"""Seed competencies and learning objectives with proper subject_id

This migration addresses the issue where competencies and learning objectives
were not seeded in the seed_20260111_01 migration.

CONTEXT:
- The app is multi-tenant: everything is scoped by school_id.
- Templates are organized per Subject (subject_id).
- Competencies and Learning Objectives need to be seeded as templates.
- The seed_20260111_01 migration handled peer criteria, project assessment, rubrics, and mail templates.
- This migration completes the work by seeding competencies and learning objectives.

REQUIREMENTS:
1. The migration MUST be idempotent (safe to run multiple times).
2. Do NOT create new School records.
3. For EACH existing school:
   - Ensure a Subject with code = "O&O", name = "Onderzoek & Ontwerpen" exists
   - Use this Subject as the subject for all competencies and learning objectives
4. Seed both onderbouw and bovenbouw learning objectives.
5. Seed competencies with their categories and rubric levels.

TEMPLATES SEEDED:
- LearningObjective (from learning_objectives_onderbouw.json and learning_objectives_bovenbouw.json)
- CompetencyCategory (from competencies.json)
- Competency (from competencies.json) with is_template=True
- CompetencyRubricLevel (from competencies.json)

SAFETY:
- Checks for existing data before inserting
- Explicitly queries IDs inside the migration
- Never assumes IDs like subject_id=1
- Idempotent: safe to run multiple times

Revision ID: seed_20260112_01
Revises: seed_20260111_01
Create Date: 2026-01-12
"""

from alembic import op
import sqlalchemy as sa
import json
from pathlib import Path

# revision identifiers, used by Alembic.
revision = "seed_20260112_01"
down_revision = "seed_20260111_01"
branch_labels = None
depends_on = None


def _load_json(name: str):
    """
    Load JSON from backend/data/templates/<name>.
    
    Navigate from: migrations/versions/ -> migrations/ -> backend/
    """
    base_dir = Path(__file__).resolve().parents[2]
    path = base_dir / "data" / "templates" / name
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_or_create_subject(conn, school_id: int) -> int:
    """
    Get or create the default "O&O" subject for a school.
    
    Returns the subject_id for the O&O subject.
    
    This function is idempotent - it will either find an existing subject
    or create a new one, but never create duplicates.
    """
    # Try to find existing O&O subject
    result = conn.execute(
        sa.text("""
            SELECT id FROM subjects
            WHERE school_id = :school_id
            AND code = :code
        """),
        {"school_id": school_id, "code": "O&O"}
    )
    row = result.fetchone()
    
    if row:
        return row[0]
    
    # Create new O&O subject
    result = conn.execute(
        sa.text("""
            INSERT INTO subjects (school_id, code, name, is_active, created_at, updated_at)
            VALUES (:school_id, :code, :name, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (school_id, code) DO NOTHING
            RETURNING id
        """),
        {
            "school_id": school_id,
            "code": "O&O",
            "name": "Onderzoek & Ontwerpen"
        }
    )
    row = result.fetchone()
    
    if row:
        return row[0]
    
    # If ON CONFLICT prevented insertion, query again
    result = conn.execute(
        sa.text("""
            SELECT id FROM subjects
            WHERE school_id = :school_id
            AND code = :code
        """),
        {"school_id": school_id, "code": "O&O"}
    )
    return result.scalar_one()


def seed_learning_objectives(conn, school_id: int, subject_id: int):
    """
    Seed learning objectives from both onderbouw and bovenbouw JSON files.
    
    Checks for existing learning objectives before inserting to ensure idempotency
    based on (school_id, subject_id, is_template, phase, code in metadata_json).
    """
    # Load both onderbouw and bovenbouw learning objectives
    onderbouw = _load_json("learning_objectives_onderbouw.json")
    bovenbouw = _load_json("learning_objectives_bovenbouw.json")
    
    all_objectives = onderbouw + bovenbouw
    
    for obj in all_objectives:
        code = obj.get("code", "")
        phase = obj.get("phase", "")
        domain = obj.get("domain", "")
        title = obj.get("title", "")
        
        # Check if this learning objective already exists
        result = conn.execute(
            sa.text("""
                SELECT id FROM learning_objectives
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND is_template = TRUE
                  AND phase = :phase
                  AND metadata_json->>'code' = :code
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "phase": phase,
                "code": code
            }
        )
        existing = result.fetchone()
        
        if existing:
            # Learning objective already exists, skip
            continue
        
        # Insert new learning objective
        metadata = {"code": code}
        
        conn.execute(
            sa.text("""
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
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "domain": domain,
                "title": title,
                "description": obj.get("description", "") or "",
                "order": obj.get("order", 0),
                "phase": phase,
                "metadata_json": json.dumps(metadata)
            }
        )


def seed_competencies(conn, school_id: int, subject_id: int):
    """
    Seed competencies with categories and rubric levels from competencies.json.
    
    Checks for existing data before inserting to ensure idempotency.
    """
    data = _load_json("competencies.json")
    categories = data.get("categories", [])
    competencies = data.get("competencies", [])
    
    # Default scale labels
    default_scale_labels = {
        "1": "Beginner",
        "2": "Ontwikkelend",
        "3": "Competent",
        "4": "Gevorderd",
        "5": "Expert",
    }
    
    # Track category_key -> category_id mapping
    category_ids = {}
    
    # 1. Seed categories
    for cat in categories:
        key = cat["key"]
        name = cat["name"]
        
        # Check if category already exists
        result = conn.execute(
            sa.text("""
                SELECT id FROM competency_categories
                WHERE school_id = :school_id
                  AND name = :name
            """),
            {
                "school_id": school_id,
                "name": name
            }
        )
        existing = result.fetchone()
        
        if existing:
            category_ids[key] = existing[0]
            continue
        
        # Insert new category
        result = conn.execute(
            sa.text("""
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
            """),
            {
                "school_id": school_id,
                "name": name,
                "description": cat.get("description", "") or "",
                "color": cat.get("color"),
                "icon": cat.get("icon"),
                "order_index": cat.get("order_index", 0)
            }
        )
        category_ids[key] = result.scalar_one()
    
    # 2. Seed competencies and their rubric levels
    for comp in competencies:
        category_key = comp["category_key"]
        category_id = category_ids.get(category_key)
        
        # Skip if category doesn't exist (should not happen with valid data)
        if category_id is None:
            continue
        
        name = comp["name"]
        code = comp.get("code", "")
        phase = comp.get("phase")
        
        # Check if competency already exists
        result = conn.execute(
            sa.text("""
                SELECT id FROM competencies
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND is_template = TRUE
                  AND name = :name
                  AND teacher_id IS NULL
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "name": name
            }
        )
        existing = result.fetchone()
        
        if existing:
            # Competency already exists, skip
            continue
        
        # Insert competency
        result = conn.execute(
            sa.text("""
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
            """),
            {
                "school_id": school_id,
                "category_id": category_id,
                "subject_id": subject_id,
                "phase": phase,
                "name": name,
                "description": comp.get("description", "") or "",
                "order": comp.get("order", 0),
                "scale_labels": json.dumps(default_scale_labels),
                "metadata_json": json.dumps({"code": code})
            }
        )
        competency_id = result.scalar_one()
        
        # Insert rubric levels for this competency
        levels = comp.get("levels", {})
        for level_str, desc in levels.items():
            level = int(level_str)
            label = default_scale_labels.get(level_str, f"Level {level}")
            
            conn.execute(
                sa.text("""
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
                """),
                {
                    "school_id": school_id,
                    "competency_id": competency_id,
                    "level": level,
                    "label": label,
                    "description": desc
                }
            )


def upgrade():
    """
    Main upgrade function - seeds competencies and learning objectives for all schools.
    
    For each school:
    1. Ensure O&O subject exists (get or create)
    2. Seed learning objectives with this subject
    3. Seed competencies with this subject
    
    This migration is idempotent and safe to run multiple times.
    """
    conn = op.get_bind()
    
    # Get all schools
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()
    
    for (school_id,) in schools:
        # 1. Ensure O&O subject exists
        subject_id = get_or_create_subject(conn, school_id)
        
        # 2. Seed learning objectives
        seed_learning_objectives(conn, school_id, subject_id)
        
        # 3. Seed competencies
        seed_competencies(conn, school_id, subject_id)


def downgrade():
    """
    Downgrade does nothing.
    
    Seeding is considered irreversible - we don't want to delete
    data that might have been customized or is in use.
    """
    pass

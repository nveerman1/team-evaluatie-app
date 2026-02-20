#!/usr/bin/env python3
"""
Template Seeding Script

This script seeds all template data into the database. It replaces the need for
Alembic migrations to seed template data.

Templates seeded:
- Peer Evaluation Criteria (from peer_criteria.json)
- Project Assessment Criteria (from project_assessment_criteria_vwo_bovenbouw.json)
- Project Rubric Templates with criteria
- Competency Templates with categories and levels
- Learning Objectives (onderbouw + bovenbouw)
- Mail Templates
- Standard Remarks (Standaardopmerkingen)

Usage:
    python backend/scripts/seed_templates.py --school-id 1 --subject-id 1
    python backend/scripts/seed_templates.py --school-id 1 --create-subject
    python backend/scripts/seed_templates.py --all-schools --create-subject

Options:
    --school-id ID        Seed templates for specific school (required unless --all-schools)
    --subject-id ID       Use specific subject ID (default: create or use O&O subject)
    --create-subject      Create "O&O" (Onderzoek & Ontwerpen) subject if it doesn't exist
    --all-schools         Seed templates for all schools in database
    --dry-run             Show what would be done without making changes
    --help                Show this help message

Environment Variables:
    DATABASE_URL          PostgreSQL connection string (required)

Examples:
    # Seed templates for school 1, create O&O subject if needed
    python backend/scripts/seed_templates.py --school-id 1 --create-subject

    # Seed templates for school 1 with existing subject 2
    python backend/scripts/seed_templates.py --school-id 1 --subject-id 2

    # Seed templates for all schools, create O&O subject for each
    python backend/scripts/seed_templates.py --all-schools --create-subject

    # Dry run to see what would be seeded
    python backend/scripts/seed_templates.py --school-id 1 --create-subject --dry-run
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import create_engine, text


def load_json(name: str) -> dict:
    """
    Load JSON from backend/data/templates/<name>.

    Args:
        name: Name of the JSON file to load

    Returns:
        Parsed JSON data as dictionary
    """
    # Navigate from: scripts/ -> backend/ -> data/templates/
    base_dir = Path(__file__).resolve().parent.parent
    path = base_dir / "data" / "templates" / name

    if not path.exists():
        raise FileNotFoundError(f"Template file not found: {path}")

    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_or_create_subject(
    conn, school_id: int, create_if_missing: bool = False
) -> Optional[int]:
    """
    Get or create the default "O&O" (Onderzoek & Ontwerpen) subject for a school.

    Args:
        conn: Database connection
        school_id: School ID to get/create subject for
        create_if_missing: If True, create the subject if it doesn't exist

    Returns:
        The subject_id for the O&O subject, or None if not found and not created

    Raises:
        ValueError: If subject doesn't exist and create_if_missing is False
    """
    # Try to find existing O&O subject
    result = conn.execute(
        text("""
            SELECT id FROM subjects
            WHERE school_id = :school_id
            AND code = :code
        """),
        {"school_id": school_id, "code": "O&O"},
    )
    row = result.fetchone()

    if row:
        print(f"  ✓ Found existing O&O subject (ID: {row[0]})")
        return row[0]

    if not create_if_missing:
        raise ValueError(
            f"No O&O subject found for school {school_id}. "
            "Use --create-subject flag to create it."
        )

    # Create new O&O subject
    print(f"  ℹ Creating new O&O subject for school {school_id}...")
    result = conn.execute(
        text("""
            INSERT INTO subjects (school_id, code, name, is_active, created_at, updated_at)
            VALUES (:school_id, :code, :name, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (school_id, code) DO NOTHING
            RETURNING id
        """),
        {"school_id": school_id, "code": "O&O", "name": "Onderzoek & Ontwerpen"},
    )
    row = result.fetchone()

    if row:
        print(f"  ✓ Created O&O subject (ID: {row[0]})")
        return row[0]

    # If ON CONFLICT prevented insertion, query again
    result = conn.execute(
        text("""
            SELECT id FROM subjects
            WHERE school_id = :school_id
            AND code = :code
        """),
        {"school_id": school_id, "code": "O&O"},
    )
    return result.scalar_one()


def resolve_learning_objective_ids(
    conn, school_id: int, subject_id: int, lo_codes: list
) -> list[int]:
    """
    Resolve learning objective codes to IDs.

    Handles various formats:
    - "OB2.1" -> metadata_json->>'code' = 'OB2.1'
    - "A1" -> domain="A", metadata_json->>'code'="1"
    - "24" -> metadata_json->>'code'="24"

    Args:
        conn: Database connection
        school_id: School ID
        subject_id: Subject ID
        lo_codes: List of learning objective codes to resolve

    Returns:
        List of resolved learning objective IDs
    """
    ids = []

    for raw in lo_codes:
        lo_code_str = str(raw)

        # Try exact match first (for codes like "OB2.1")
        result = conn.execute(
            text("""
                SELECT id FROM learning_objectives
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND is_template = TRUE
                  AND metadata_json->>'code' = :code
            """),
            {"school_id": school_id, "subject_id": subject_id, "code": lo_code_str},
        )
        row = result.fetchone()
        if row:
            ids.append(row[0])
            continue

        # Try domain-based match (for codes like "A1", "E24")
        if (
            len(lo_code_str) >= 2
            and lo_code_str[0] in ["A", "B", "C", "D", "E", "F"]
            and lo_code_str[1:].isdigit()
        ):
            domain = lo_code_str[0]
            code_value = lo_code_str[1:]

            result = conn.execute(
                text("""
                    SELECT id FROM learning_objectives
                    WHERE school_id = :school_id
                      AND subject_id = :subject_id
                      AND is_template = TRUE
                      AND metadata_json->>'code' = :code
                      AND domain = :domain
                """),
                {
                    "school_id": school_id,
                    "subject_id": subject_id,
                    "code": code_value,
                    "domain": domain,
                },
            )
            row = result.fetchone()
            if row:
                ids.append(row[0])

    return ids


def seed_learning_objectives(
    conn, school_id: int, subject_id: int, dry_run: bool = False
):
    """
    Seed learning objectives from JSON files.

    Loads both onderbouw and bovenbouw learning objectives and inserts them
    as templates for the specified school and subject.

    Args:
        conn: Database connection
        school_id: School ID to seed for
        subject_id: Subject ID to seed for
        dry_run: If True, only print what would be done
    """
    print("\n📚 Seeding Learning Objectives...")

    # Load JSON files
    onderbouw = load_json("learning_objectives_onderbouw.json")
    bovenbouw = load_json("learning_objectives_bovenbouw.json")
    objectives = onderbouw + bovenbouw

    inserted_count = 0
    skipped_count = 0

    for obj in objectives:
        # Check if objective already exists
        result = conn.execute(
            text("""
                SELECT id FROM learning_objectives
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND is_template = TRUE
                  AND domain = :domain
                  AND title = :title
                  AND phase = :phase
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "domain": obj["domain"],
                "title": obj["title"],
                "phase": obj["phase"],
            },
        )

        if result.fetchone():
            skipped_count += 1
            continue

        metadata = {"code": obj.get("code")}

        if not dry_run:
            conn.execute(
                text("""
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
                    "domain": obj["domain"],
                    "title": obj["title"],
                    "description": obj.get("description", "") or "",
                    "order": obj.get("order", 0),
                    "phase": obj["phase"],
                    "metadata_json": json.dumps(metadata),
                },
            )

        inserted_count += 1

    print(f"  ✓ Inserted {inserted_count} learning objectives")
    if skipped_count > 0:
        print(f"  ℹ Skipped {skipped_count} existing learning objectives")


def seed_competency_templates(
    conn, school_id: int, subject_id: int, dry_run: bool = False
):
    """
    Seed competency templates, categories, and rubric levels from JSON.

    Args:
        conn: Database connection
        school_id: School ID to seed for
        subject_id: Subject ID to seed for
        dry_run: If True, only print what would be done
    """
    print("\n🎯 Seeding Competency Templates...")

    data = load_json("competencies.json")
    categories = data.get("categories", [])
    competencies = data.get("competencies", [])

    # Default labels for scale
    default_scale_labels = {
        "1": "Beginner",
        "2": "Ontwikkelend",
        "3": "Competent",
        "4": "Gevorderd",
        "5": "Expert",
    }

    # Track category mappings
    category_ids: dict[str, int] = {}

    # Seed categories
    inserted_categories = 0
    skipped_categories = 0

    for cat in categories:
        # Check if category already exists
        result = conn.execute(
            text("""
                SELECT id FROM competency_categories
                WHERE school_id = :school_id
                  AND name = :name
            """),
            {"school_id": school_id, "name": cat["name"]},
        )
        row = result.fetchone()

        if row:
            category_ids[cat["key"]] = row[0]
            skipped_categories += 1
            continue

        if not dry_run:
            result = conn.execute(
                text("""
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
                    "name": cat["name"],
                    "description": cat.get("description", "") or "",
                    "color": cat.get("color"),
                    "icon": cat.get("icon"),
                    "order_index": cat.get("order_index", 0),
                },
            )
            category_id = result.scalar_one()
            category_ids[cat["key"]] = category_id
        else:
            category_ids[cat["key"]] = -1  # Placeholder for dry run

        inserted_categories += 1

    print(f"  ✓ Inserted {inserted_categories} competency categories")
    if skipped_categories > 0:
        print(f"  ℹ Skipped {skipped_categories} existing categories")

    # Seed competencies
    inserted_competencies = 0
    skipped_competencies = 0

    for comp in competencies:
        category_key = comp["category_key"]
        category_id = category_ids.get(category_key)

        # Check if competency already exists
        result = conn.execute(
            text("""
                SELECT id FROM competencies
                WHERE school_id = :school_id
                  AND category_id = :category_id
                  AND name = :name
                  AND is_template = TRUE
            """),
            {
                "school_id": school_id,
                "category_id": category_id,
                "name": comp["name"],
            },
        )
        row = result.fetchone()

        if row:
            skipped_competencies += 1
            continue

        if not dry_run:
            # Insert competency
            result = conn.execute(
                text("""
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
                    "phase": comp.get("phase"),
                    "name": comp["name"],
                    "description": comp.get("description", "") or "",
                    "order": comp.get("order", 0),
                    "scale_labels": json.dumps(default_scale_labels),
                    "metadata_json": json.dumps({"code": comp.get("code")}),
                },
            )
            competency_id = result.scalar_one()

            # Insert rubric levels
            levels = comp.get("levels", {})
            for level_str, desc in levels.items():
                level = int(level_str)
                label = default_scale_labels.get(level_str, f"Level {level}")

                conn.execute(
                    text("""
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
                        "description": desc,
                    },
                )

        inserted_competencies += 1

    print(f"  ✓ Inserted {inserted_competencies} competency templates")
    if skipped_competencies > 0:
        print(f"  ℹ Skipped {skipped_competencies} existing competencies")


def seed_peer_evaluation_templates(
    conn, school_id: int, subject_id: int, dry_run: bool = False
):
    """
    Seed peer evaluation criterion templates from peer_criteria.json.

    Args:
        conn: Database connection
        school_id: School ID to seed for
        subject_id: Subject ID to seed for
        dry_run: If True, only print what would be done
    """
    print("\n👥 Seeding Peer Evaluation Criteria Templates...")

    data = load_json("peer_criteria.json")
    criteria = data.get("criteria", [])

    inserted_count = 0
    skipped_count = 0

    for crit in criteria:
        omza_category = crit["omza_category"]
        title = crit["title"]
        description = crit.get("description", "") or ""
        target_level = crit.get("target_level")
        level_descriptors = crit.get("level_descriptors", {})
        lo_codes = crit.get("learning_objective_codes", [])

        # Check if template already exists
        result = conn.execute(
            text("""
                SELECT id FROM peer_evaluation_criterion_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND omza_category = :omza_category
                  AND title = :title
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "omza_category": omza_category,
                "title": title,
            },
        )

        if result.fetchone():
            skipped_count += 1
            continue

        # Resolve learning objective IDs
        learning_objective_ids = resolve_learning_objective_ids(
            conn, school_id, subject_id, lo_codes
        )

        if not dry_run:
            conn.execute(
                text("""
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
                """),
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

        inserted_count += 1

    print(f"  ✓ Inserted {inserted_count} peer evaluation criterion templates")
    if skipped_count > 0:
        print(f"  ℹ Skipped {skipped_count} existing templates")


def seed_project_assessment_templates(
    conn, school_id: int, subject_id: int, dry_run: bool = False
):
    """
    Seed project assessment criterion templates from
    project_assessment_criteria_vwo_bovenbouw.json.

    Args:
        conn: Database connection
        school_id: School ID to seed for
        subject_id: Subject ID to seed for
        dry_run: If True, only print what would be done
    """
    print("\n📋 Seeding Project Assessment Criteria Templates...")

    data = load_json("project_assessment_criteria_vwo_bovenbouw.json")
    criteria = data.get("project_assessment_criteria", [])

    inserted_count = 0
    skipped_count = 0

    for crit in criteria:
        category = crit["category"]
        title = crit["title"]
        description = crit.get("description", "") or ""
        target_level = crit.get("target_level", "bovenbouw")
        level_descriptors = crit.get("level_descriptors", {})
        lo_codes = crit.get("learning_objectives", [])

        # Check if template already exists
        result = conn.execute(
            text("""
                SELECT id FROM project_assessment_criterion_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND category = :category
                  AND title = :title
                  AND target_level = :target_level
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "category": category,
                "title": title,
                "target_level": target_level,
            },
        )

        if result.fetchone():
            skipped_count += 1
            continue

        # Resolve learning objective IDs
        learning_objective_ids = resolve_learning_objective_ids(
            conn, school_id, subject_id, lo_codes
        )

        if not dry_run:
            conn.execute(
                text("""
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
                """),
                {
                    "school_id": school_id,
                    "subject_id": subject_id,
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

        inserted_count += 1

    print(f"  ✓ Inserted {inserted_count} project assessment criterion templates")
    if skipped_count > 0:
        print(f"  ℹ Skipped {skipped_count} existing templates")


def seed_project_rubric_templates(
    conn, school_id: int, subject_id: int, dry_run: bool = False
):
    """
    Seed default project rubric templates.

    Creates basic rubrics for different levels (onderbouw, havo_bovenbouw, vwo_bovenbouw).

    Args:
        conn: Database connection
        school_id: School ID to seed for
        subject_id: Subject ID to seed for
        dry_run: If True, only print what would be done
    """
    print("\n📊 Seeding Project Rubric Templates...")

    rubrics = [
        {
            "name": "Standaard Projectrubric Onderbouw",
            "level": "onderbouw",
            "criteria": [
                {
                    "category": "projectproces",
                    "title": "Planning en organisatie",
                    "description": "De leerling plant en organiseert het projectwerk effectief",
                    "weight": 1.0,
                    "level_descriptors": {
                        "1": "Geen planning of structuur zichtbaar",
                        "2": "Beperkte planning, vaak onvolledig",
                        "3": "Adequate planning met duidelijke stappen",
                        "4": "Goede planning met realistische tijdsindeling",
                        "5": "Excellente planning met proactief bijsturen",
                    },
                },
                {
                    "category": "eindresultaat",
                    "title": "Kwaliteit eindproduct",
                    "description": "De kwaliteit en volledigheid van het eindresultaat",
                    "weight": 1.5,
                    "level_descriptors": {
                        "1": "Eindproduct voldoet niet aan minimale eisen",
                        "2": "Eindproduct is onvolledig of van matige kwaliteit",
                        "3": "Eindproduct voldoet aan gestelde eisen",
                        "4": "Goed eindproduct met aandacht voor detail",
                        "5": "Excellent eindproduct dat verwachtingen overtreft",
                    },
                },
                {
                    "category": "communicatie",
                    "title": "Presentatie en communicatie",
                    "description": "De mate waarin de leerling helder communiceert over het project",
                    "weight": 1.0,
                    "level_descriptors": {
                        "1": "Communicatie onduidelijk of afwezig",
                        "2": "Communicatie aanwezig maar weinig gestructureerd",
                        "3": "Heldere communicatie over het project",
                        "4": "Goede communicatie, goed gestructureerd",
                        "5": "Excellente communicatie, overtuigend en helder",
                    },
                },
            ],
        },
        {
            "name": "Standaard Projectrubric HAVO Bovenbouw",
            "level": "havo_bovenbouw",
            "criteria": [
                {
                    "category": "projectproces",
                    "title": "Onderzoeksaanpak",
                    "description": "De systematiek en diepgang van de onderzoeksaanpak",
                    "weight": 1.0,
                    "level_descriptors": {
                        "1": "Geen systematische aanpak",
                        "2": "Beperkte onderzoeksaanpak",
                        "3": "Adequate onderzoeksaanpak met duidelijke methode",
                        "4": "Goede onderzoeksaanpak met onderbouwing",
                        "5": "Excellente, wetenschappelijke onderzoeksaanpak",
                    },
                },
                {
                    "category": "eindresultaat",
                    "title": "Technische uitwerking",
                    "description": "De technische kwaliteit en vakmanschap van het eindresultaat",
                    "weight": 1.5,
                    "level_descriptors": {
                        "1": "Technisch onvoldoende uitgewerkt",
                        "2": "Technisch matig uitgewerkt",
                        "3": "Technisch voldoende uitgewerkt",
                        "4": "Goede technische uitwerking met vakmanschap",
                        "5": "Excellente technische uitwerking op hoog niveau",
                    },
                },
            ],
        },
        {
            "name": "Standaard Projectrubric VWO Bovenbouw",
            "level": "vwo_bovenbouw",
            "criteria": [
                {
                    "category": "projectproces",
                    "title": "Onderzoeksmethodologie",
                    "description": "De wetenschappelijke onderbouwing en methodologie",
                    "weight": 1.0,
                    "level_descriptors": {
                        "1": "Geen wetenschappelijke methodologie",
                        "2": "Beperkte wetenschappelijke onderbouwing",
                        "3": "Adequate wetenschappelijke methodologie",
                        "4": "Goede wetenschappelijke aanpak met bronvermelding",
                        "5": "Excellente, hoogwaardige wetenschappelijke aanpak",
                    },
                },
                {
                    "category": "eindresultaat",
                    "title": "Academisch niveau",
                    "description": "Het academische niveau en de diepgang van het werk",
                    "weight": 1.5,
                    "level_descriptors": {
                        "1": "Niveau onvoldoende voor VWO",
                        "2": "Niveau matig voor VWO",
                        "3": "Voldoende academisch niveau",
                        "4": "Goed academisch niveau met diepgang",
                        "5": "Excellent academisch niveau, pre-universitair",
                    },
                },
            ],
        },
    ]

    inserted_rubrics = 0
    skipped_rubrics = 0

    for rubric in rubrics:
        # Check if rubric already exists
        result = conn.execute(
            text("""
                SELECT id FROM project_rubric_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND name = :name
                  AND level = :level
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "name": rubric["name"],
                "level": rubric["level"],
            },
        )
        existing = result.fetchone()

        if existing:
            skipped_rubrics += 1
            continue

        if not dry_run:
            # Insert rubric
            result = conn.execute(
                text("""
                    INSERT INTO project_rubric_templates (
                        school_id,
                        subject_id,
                        name,
                        level,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :school_id,
                        :subject_id,
                        :name,
                        :level,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                    RETURNING id
                """),
                {
                    "school_id": school_id,
                    "subject_id": subject_id,
                    "name": rubric["name"],
                    "level": rubric["level"],
                },
            )
            rubric_id = result.scalar_one()

            # Insert criteria for this rubric
            for criterion in rubric["criteria"]:
                conn.execute(
                    text("""
                        INSERT INTO project_rubric_criterion_templates (
                            school_id,
                            rubric_template_id,
                            category,
                            title,
                            description,
                            weight,
                            level_descriptors,
                            created_at,
                            updated_at
                        )
                        VALUES (
                            :school_id,
                            :rubric_template_id,
                            :category,
                            :title,
                            :description,
                            :weight,
                            CAST(:level_descriptors AS jsonb),
                            CURRENT_TIMESTAMP,
                            CURRENT_TIMESTAMP
                        )
                    """),
                    {
                        "school_id": school_id,
                        "rubric_template_id": rubric_id,
                        "category": criterion["category"],
                        "title": criterion["title"],
                        "description": criterion.get("description", ""),
                        "weight": criterion.get("weight", 1.0),
                        "level_descriptors": json.dumps(
                            criterion["level_descriptors"], ensure_ascii=False
                        ),
                    },
                )

        inserted_rubrics += 1

    print(f"  ✓ Inserted {inserted_rubrics} project rubric templates")
    if skipped_rubrics > 0:
        print(f"  ℹ Skipped {skipped_rubrics} existing rubrics")


def seed_mail_templates(conn, school_id: int, subject_id: int, dry_run: bool = False):
    """
    Seed default mail templates.

    Creates basic email templates for common scenarios.

    Args:
        conn: Database connection
        school_id: School ID to seed for
        subject_id: Subject ID to seed for
        dry_run: If True, only print what would be done
    """
    print("\n📧 Seeding Mail Templates...")

    templates = [
        {
            "name": "Start Opdrachtgever",
            "type": "start_opdrachtgever",
            "subject": "Projectstart: {project_name}",
            "body": """Beste {contactpersoon},

Graag stellen wij ons voor als het projectteam dat aan de slag gaat met {project_name}.

Ons team bestaat uit:
{team_members}

We kijken ernaar uit om met u samen te werken aan dit project.

Met vriendelijke groet,
Het projectteam""",
        },
        {
            "name": "Tussenpresentatie",
            "type": "tussenpresentatie",
            "subject": "Uitnodiging tussenpresentatie: {project_name}",
            "body": """Beste {contactpersoon},

Hierbij nodigen wij u uit voor de tussenpresentatie van ons project {project_name}.

Datum: {datum}
Tijd: {tijd}
Locatie: {locatie}

Tijdens deze presentatie delen we onze tussenresultaten en voortgang met u.

Met vriendelijke groet,
Het projectteam""",
        },
        {
            "name": "Eindpresentatie",
            "type": "eindpresentatie",
            "subject": "Uitnodiging eindpresentatie: {project_name}",
            "body": """Beste {contactpersoon},

Graag nodigen wij u uit voor de eindpresentatie van ons project {project_name}.

Datum: {datum}
Tijd: {tijd}
Locatie: {locatie}

We presenteren de eindresultaten en leveren het definitieve product op.

Met vriendelijke groet,
Het projectteam""",
        },
        {
            "name": "Bedankmail",
            "type": "bedankmail",
            "subject": "Bedankt voor uw medewerking: {project_name}",
            "body": """Beste {contactpersoon},

Graag willen wij u hartelijk bedanken voor uw medewerking aan ons project {project_name}.

Uw bijdrage was van grote waarde voor het slagen van dit project.

Met vriendelijke groet,
Het projectteam""",
        },
    ]

    inserted_count = 0
    skipped_count = 0

    for template in templates:
        # Check if template already exists
        result = conn.execute(
            text("""
                SELECT id FROM mail_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND type = :type
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "type": template["type"],
            },
        )

        if result.fetchone():
            skipped_count += 1
            continue

        if not dry_run:
            conn.execute(
                text("""
                    INSERT INTO mail_templates (
                        school_id,
                        subject_id,
                        name,
                        type,
                        subject,
                        body,
                        variables_allowed,
                        is_active,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :school_id,
                        :subject_id,
                        :name,
                        :type,
                        :subject,
                        :body,
                        CAST(:variables_allowed AS jsonb),
                        TRUE,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                """),
                {
                    "school_id": school_id,
                    "subject_id": subject_id,
                    "name": template["name"],
                    "type": template["type"],
                    "subject": template["subject"],
                    "body": template["body"],
                    "variables_allowed": json.dumps({}),
                },
            )

        inserted_count += 1

    print(f"  ✓ Inserted {inserted_count} mail templates")
    if skipped_count > 0:
        print(f"  ℹ Skipped {skipped_count} existing templates")


def seed_standard_remarks(conn, school_id: int, subject_id: int, dry_run: bool = False):
    """
    Seed default standard remarks (Standaardopmerkingen).

    Creates basic feedback remarks for quick use.

    Args:
        conn: Database connection
        school_id: School ID to seed for
        subject_id: Subject ID to seed for
        dry_run: If True, only print what would be done
    """
    print("\n💬 Seeding Standard Remarks (Standaardopmerkingen)...")

    remarks = [
        # Peer evaluation remarks
        {
            "type": "peer",
            "category": "positief",
            "text": "Neemt actief deel aan teamoverleg",
        },
        {"type": "peer", "category": "positief", "text": "Levert werk op tijd aan"},
        {"type": "peer", "category": "positief", "text": "Helpt anderen wanneer nodig"},
        {
            "type": "peer",
            "category": "aandachtspunt",
            "text": "Kan beter communiceren met het team",
        },
        {"type": "peer", "category": "aandachtspunt", "text": "Mist soms deadlines"},
        # Project feedback remarks
        {
            "type": "project",
            "category": "positief",
            "text": "Goed uitgevoerd onderzoek",
        },
        {"type": "project", "category": "positief", "text": "Duidelijke presentatie"},
        {"type": "project", "category": "positief", "text": "Creatieve oplossing"},
        {
            "type": "project",
            "category": "aandachtspunt",
            "text": "Onderbouwing kan beter",
        },
        {
            "type": "project",
            "category": "aandachtspunt",
            "text": "Meer bronvermelding nodig",
        },
        # OMZA remarks
        {"type": "omza", "category": "positief", "text": "Goede planning gemaakt"},
        {"type": "omza", "category": "positief", "text": "Zelfstandig werk verricht"},
        {
            "type": "omza",
            "category": "aandachtspunt",
            "text": "Meer structuur aanbrengen",
        },
    ]

    inserted_count = 0
    skipped_count = 0

    for idx, remark in enumerate(remarks):
        # Check if remark already exists
        result = conn.execute(
            text("""
                SELECT id FROM standard_remarks
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND type = :type
                  AND text = :text
            """),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "type": remark["type"],
                "text": remark["text"],
            },
        )

        if result.fetchone():
            skipped_count += 1
            continue

        if not dry_run:
            conn.execute(
                text("""
                    INSERT INTO standard_remarks (
                        school_id,
                        subject_id,
                        type,
                        category,
                        text,
                        "order",
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :school_id,
                        :subject_id,
                        :type,
                        :category,
                        :text,
                        :order,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                """),
                {
                    "school_id": school_id,
                    "subject_id": subject_id,
                    "type": remark["type"],
                    "category": remark["category"],
                    "text": remark["text"],
                    "order": idx,
                },
            )

        inserted_count += 1

    print(f"  ✓ Inserted {inserted_count} standard remarks")
    if skipped_count > 0:
        print(f"  ℹ Skipped {skipped_count} existing remarks")


def seed_all_templates(conn, school_id: int, subject_id: int, dry_run: bool = False):
    """
    Seed all template types for a specific school and subject.

    Args:
        conn: Database connection
        school_id: School ID to seed for
        subject_id: Subject ID to seed for
        dry_run: If True, only print what would be done
    """
    print(f"\n{'='*60}")
    print(f"Seeding templates for school_id={school_id}, subject_id={subject_id}")
    print(f"{'='*60}")

    # Seed in dependency order: learning objectives first, then everything else
    seed_learning_objectives(conn, school_id, subject_id, dry_run)
    seed_competency_templates(conn, school_id, subject_id, dry_run)
    seed_peer_evaluation_templates(conn, school_id, subject_id, dry_run)
    seed_project_assessment_templates(conn, school_id, subject_id, dry_run)
    seed_project_rubric_templates(conn, school_id, subject_id, dry_run)
    seed_mail_templates(conn, school_id, subject_id, dry_run)
    seed_standard_remarks(conn, school_id, subject_id, dry_run)

    print(f"\n{'='*60}")
    print("✅ Template seeding complete!")
    print(f"{'='*60}\n")


def main():
    """Main entry point for the seeding script."""
    parser = argparse.ArgumentParser(
        description="Seed template data into the database",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--school-id",
        type=int,
        help="School ID to seed templates for (required unless --all-schools)",
    )
    parser.add_argument(
        "--subject-id",
        type=int,
        help="Subject ID to use (default: use or create O&O subject)",
    )
    parser.add_argument(
        "--create-subject",
        action="store_true",
        help='Create "O&O" (Onderzoek & Ontwerpen) subject if it doesn\'t exist',
    )
    parser.add_argument(
        "--all-schools",
        action="store_true",
        help="Seed templates for all schools in database",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.all_schools and not args.school_id:
        parser.error("Either --school-id or --all-schools is required")

    if args.school_id and args.all_schools:
        parser.error("Cannot specify both --school-id and --all-schools")

    # Load environment variables from .env file
    load_dotenv()

    # Get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ Error: DATABASE_URL environment variable not set", file=sys.stderr)
        sys.exit(1)

    # Connect to database
    try:
        engine = create_engine(database_url)
        conn = engine.connect()
        print("✓ Connected to database")
    except Exception as e:
        print(f"❌ Error connecting to database: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        if args.dry_run:
            print("\n⚠️  DRY RUN MODE - No changes will be made\n")

        # Get list of schools to process
        if args.all_schools:
            result = conn.execute(text("SELECT id FROM schools ORDER BY id"))
            school_ids = [row[0] for row in result.fetchall()]

            if not school_ids:
                print("❌ No schools found in database", file=sys.stderr)
                sys.exit(1)

            print(f"Found {len(school_ids)} school(s) to process: {school_ids}")
        else:
            school_ids = [args.school_id]

        # Process each school
        for school_id in school_ids:
            # Determine subject_id to use
            if args.subject_id:
                subject_id = args.subject_id
                print(f"\nUsing specified subject_id={subject_id}")
            else:
                # Get or create O&O subject
                try:
                    subject_id = get_or_create_subject(
                        conn, school_id, create_if_missing=args.create_subject
                    )
                except ValueError as e:
                    print(f"❌ Error: {e}", file=sys.stderr)
                    sys.exit(1)

            # Seed all templates
            seed_all_templates(conn, school_id, subject_id, args.dry_run)

        # Commit changes if not dry run
        if not args.dry_run:
            conn.commit()
            print("✓ Changes committed to database")
        else:
            print("\n⚠️  DRY RUN COMPLETE - No changes were made")

    except Exception as e:
        print(f"\n❌ Error during seeding: {e}", file=sys.stderr)
        if not args.dry_run:
            conn.rollback()
            print("✓ Changes rolled back")
        sys.exit(1)

    finally:
        conn.close()


if __name__ == "__main__":
    main()

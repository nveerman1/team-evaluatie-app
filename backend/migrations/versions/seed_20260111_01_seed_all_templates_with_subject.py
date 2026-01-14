"""Seed ALL template data with robust subject handling

This migration addresses production failures where template seeding failed due to missing subjects.

CONTEXT:
- The app is multi-tenant: everything is scoped by school_id.
- Templates are organized per Subject (subject_id).
- In production, template seed migrations failed because no Subject existed yet.
- We now want a robust, deploy-safe seed migration.

REQUIREMENTS:
1. The migration MUST be idempotent (safe to run multiple times).
2. Do NOT create new School records.
3. For EACH existing school:
   - Ensure a Subject with code = "O&O", name = "Onderzoek & Ontwerpen" exists
   - If it exists → reuse it
   - If it does not exist → create it
4. Use this Subject as the fallback/default subject for all templates.

TEMPLATES SEEDED:
- PeerEvaluationCriterionTemplate (from peer_criteria.json)
- ProjectAssessmentCriterionTemplate (from project_assessment_criteria_vwo_bovenbouw.json)
- ProjectRubricTemplate + ProjectRubricCriterionTemplate (hardcoded rubrics)
- CompetencyTemplate (set subject_id even though optional)
- MailTemplate (set subject_id even though optional)
- StandardRemark (set subject_id even though optional)

SAFETY:
- Uses INSERT ... ON CONFLICT DO NOTHING where possible
- Explicitly queries IDs inside the migration
- Never assumes IDs like subject_id=1
- Idempotent: safe to run multiple times

Revision ID: seed_20260111_01
Revises: refl_20260107_01
Create Date: 2026-01-11
"""

from alembic import op
import sqlalchemy as sa
import json
from pathlib import Path

# revision identifiers, used by Alembic.
revision = "seed_20260111_01"
down_revision = "refl_20260107_01"
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
        sa.text(
            """
            SELECT id FROM subjects
            WHERE school_id = :school_id
            AND code = :code
        """
        ),
        {"school_id": school_id, "code": "O&O"},
    )
    row = result.fetchone()

    if row:
        return row[0]

    # Create new O&O subject
    result = conn.execute(
        sa.text(
            """
            INSERT INTO subjects (school_id, code, name, is_active, created_at, updated_at)
            VALUES (:school_id, :code, :name, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (school_id, code) DO NOTHING
            RETURNING id
        """
        ),
        {"school_id": school_id, "code": "O&O", "name": "Onderzoek & Ontwerpen"},
    )
    row = result.fetchone()

    if row:
        return row[0]

    # If ON CONFLICT prevented insertion, query again
    result = conn.execute(
        sa.text(
            """
            SELECT id FROM subjects
            WHERE school_id = :school_id
            AND code = :code
        """
        ),
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
    """
    ids = []

    for raw in lo_codes:
        lo_code_str = str(raw)

        # Try exact match first (for codes like "OB2.1")
        result = conn.execute(
            sa.text(
                """
                SELECT id FROM learning_objectives
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND is_template = TRUE
                  AND metadata_json->>'code' = :code
            """
            ),
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
                sa.text(
                    """
                    SELECT id FROM learning_objectives
                    WHERE school_id = :school_id
                      AND subject_id = :subject_id
                      AND is_template = TRUE
                      AND metadata_json->>'code' = :code
                      AND domain = :domain
                """
                ),
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


def seed_peer_evaluation_templates(conn, school_id: int, subject_id: int):
    """
    Seed peer evaluation criterion templates from peer_criteria.json.

    Checks for existing templates before inserting to ensure idempotency
    based on (school_id, subject_id, omza_category, title).
    """
    data = _load_json("peer_criteria.json")
    criteria = data.get("criteria", [])

    for crit in criteria:
        omza_category = crit["omza_category"]
        title = crit["title"]
        description = crit.get("description", "") or ""
        target_level = crit.get("target_level")
        level_descriptors = crit.get("level_descriptors", {})
        lo_codes = crit.get("learning_objective_codes", [])

        # Check if template already exists
        result = conn.execute(
            sa.text(
                """
                SELECT id FROM peer_evaluation_criterion_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND omza_category = :omza_category
                  AND title = :title
            """
            ),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "omza_category": omza_category,
                "title": title,
            },
        )
        existing = result.fetchone()

        if existing:
            # Template already exists, skip
            continue

        # Resolve learning objective IDs
        learning_objective_ids = resolve_learning_objective_ids(
            conn, school_id, subject_id, lo_codes
        )

        # Insert new template
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
                "level_descriptors": json.dumps(level_descriptors, ensure_ascii=False),
                "learning_objective_ids": json.dumps(learning_objective_ids),
            },
        )


def seed_project_assessment_templates(conn, school_id: int, subject_id: int):
    """
    Seed project assessment criterion templates from
    project_assessment_criteria_vwo_bovenbouw.json.

    Checks for existing templates before inserting to ensure idempotency
    based on (school_id, subject_id, category, title, target_level).
    """
    data = _load_json("project_assessment_criteria_vwo_bovenbouw.json")
    criteria = data.get("project_assessment_criteria", [])

    for crit in criteria:
        category = crit["category"]
        title = crit["title"]
        description = crit.get("description", "") or ""
        target_level = crit.get("target_level", "bovenbouw")
        level_descriptors = crit.get("level_descriptors", {})
        lo_codes = crit.get("learning_objectives", [])

        # Check if template already exists
        result = conn.execute(
            sa.text(
                """
                SELECT id FROM project_assessment_criterion_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND category = :category
                  AND title = :title
                  AND target_level = :target_level
            """
            ),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "category": category,
                "title": title,
                "target_level": target_level,
            },
        )
        existing = result.fetchone()

        if existing:
            # Template already exists, skip
            continue

        # Resolve learning objective IDs
        learning_objective_ids = resolve_learning_objective_ids(
            conn, school_id, subject_id, lo_codes
        )

        # Insert new template
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
                "subject_id": subject_id,
                "category": category,
                "title": title,
                "description": description,
                "target_level": target_level,
                "level_descriptors": json.dumps(level_descriptors, ensure_ascii=False),
                "learning_objective_ids": json.dumps(learning_objective_ids),
            },
        )


def seed_project_rubric_templates(conn, school_id: int, subject_id: int):
    """
    Seed default project rubric templates.

    Creates basic rubrics for different levels (onderbouw, havo_bovenbouw, vwo_bovenbouw).
    Uses a check to ensure idempotency based on (school_id, subject_id, name, level).
    """
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

    for rubric in rubrics:
        # Check if rubric already exists
        result = conn.execute(
            sa.text(
                """
                SELECT id FROM project_rubric_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND name = :name
                  AND level = :level
            """
            ),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "name": rubric["name"],
                "level": rubric["level"],
            },
        )
        existing = result.fetchone()

        if existing:
            # Rubric already exists, skip
            continue

        # Insert rubric
        result = conn.execute(
            sa.text(
                """
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
            """
            ),
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
                sa.text(
                    """
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
                """
                ),
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


def seed_mail_templates(conn, school_id: int, subject_id: int):
    """
    Seed default mail templates.

    Creates basic email templates for common scenarios.
    Uses a check to ensure idempotency based on (school_id, subject_id, type).
    """
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

    for template in templates:
        # Check if template already exists
        result = conn.execute(
            sa.text(
                """
                SELECT id FROM mail_templates
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND type = :type
            """
            ),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "type": template["type"],
            },
        )
        existing = result.fetchone()

        if not existing:
            # Insert template
            conn.execute(
                sa.text(
                    """
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
                """
                ),
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


def seed_standard_remarks(conn, school_id: int, subject_id: int):
    """
    Seed default standard remarks.

    Creates basic feedback remarks for quick use.
    Uses a check to ensure idempotency based on (school_id, subject_id, type, text).
    """
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

    for idx, remark in enumerate(remarks):
        # Check if remark already exists
        result = conn.execute(
            sa.text(
                """
                SELECT id FROM standard_remarks
                WHERE school_id = :school_id
                  AND subject_id = :subject_id
                  AND type = :type
                  AND text = :text
            """
            ),
            {
                "school_id": school_id,
                "subject_id": subject_id,
                "type": remark["type"],
                "text": remark["text"],
            },
        )
        existing = result.fetchone()

        if not existing:
            # Insert remark
            conn.execute(
                sa.text(
                    """
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
                """
                ),
                {
                    "school_id": school_id,
                    "subject_id": subject_id,
                    "type": remark["type"],
                    "category": remark["category"],
                    "text": remark["text"],
                    "order": idx,
                },
            )


def seed_competency_templates_with_subject(conn, school_id: int, subject_id: int):
    """
    Update existing competency templates to link them to the O&O subject.

    CompetencyTemplate.subject_id is optional (nullable), but we want to set it
    for better organization. This only updates templates that don't have a subject_id yet.

    Note: competency_templates table does not have an is_template column as the table
    itself is inherently for templates.
    """
    conn.execute(
        sa.text(
            """
            UPDATE competency_templates
            SET subject_id = :subject_id,
                updated_at = CURRENT_TIMESTAMP
            WHERE school_id = :school_id
              AND subject_id IS NULL
        """
        ),
        {"school_id": school_id, "subject_id": subject_id},
    )


def upgrade():
    """
    Main upgrade function - seeds all templates for all schools.

    For each school:
    1. Ensure O&O subject exists (get or create)
    2. Seed all template types with this subject

    This migration is idempotent and safe to run multiple times.
    """
    conn = op.get_bind()

    # Get all schools
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()

    for (school_id,) in schools:
        # 1. Ensure O&O subject exists
        subject_id = get_or_create_subject(conn, school_id)

        # 2. Seed all template types
        seed_peer_evaluation_templates(conn, school_id, subject_id)
        seed_project_assessment_templates(conn, school_id, subject_id)
        seed_project_rubric_templates(conn, school_id, subject_id)
        seed_mail_templates(conn, school_id, subject_id)
        seed_standard_remarks(conn, school_id, subject_id)
        seed_competency_templates_with_subject(conn, school_id, subject_id)


def downgrade():
    """
    Downgrade does nothing.

    Template seeding is considered irreversible - we don't want to delete
    templates that might have been customized or are in use.
    """
    pass

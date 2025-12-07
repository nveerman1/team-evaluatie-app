# Template Data Architecture for Alembic Migrations

This document provides comprehensive information about all template tables and their structure for populating data via Alembic migrations.

## Table of Contents

1. [Overview](#overview)
2. [Peer Evaluation Criterion Templates](#peer-evaluation-criterion-templates)
3. [Project Assessment Criterion Templates](#project-assessment-criterion-templates)
4. [Competency Templates](#competency-templates)
5. [Learning Objectives](#learning-objectives)
6. [Email Templates](#email-templates)
7. [Standard Remarks](#standard-remarks)
8. [Template Tags](#template-tags)
9. [Migration Best Practices](#migration-best-practices)
10. [Example Migration Code](#example-migration-code)

---

## Overview

All template data in the system is multi-tenant, meaning each record must have a `school_id`. Most templates are also linked to a `subject_id` (section/sectie) for organizational purposes.

### Common Fields

All template tables share these common fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Integer | Yes | Primary key, auto-increment |
| `school_id` | Integer (FK) | Yes | Foreign key to `schools.id`, ON DELETE CASCADE |
| `created_at` | DateTime | Yes | Timestamp when created (default: now()) |
| `updated_at` | DateTime | Yes | Timestamp when last updated (default: now(), auto-update) |

### Subject Linkage

Most template tables include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject_id` | Integer (FK) | Varies | Foreign key to `subjects.id`, ON DELETE CASCADE or SET NULL |

---

## Peer Evaluation Criterion Templates

**Table Name:** `peer_evaluation_criterion_templates`

Template criteria for peer evaluations based on OMZA framework (Organiseren, Meedoen, Zelfvertrouwen, Autonomie).

### Schema

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | FK → schools.id (CASCADE) | School tenant |
| `subject_id` | Integer | No | - | FK → subjects.id (CASCADE) | Subject/section |
| `omza_category` | String(50) | No | - | - | One of: "Organiseren", "Meedoen", "Zelfvertrouwen", "Autonomie" |
| `title` | String(200) | No | - | - | Criterion title |
| `description` | Text | Yes | NULL | - | Detailed description |
| `target_level` | String(20) | Yes | NULL | - | One of: "onderbouw", "bovenbouw", NULL (for both) |
| `level_descriptors` | JSON | No | {} | - | Object with keys "1" to "5", values are descriptions |
| `learning_objective_ids` | JSON | No | [] | - | Array of learning objective IDs |
| `created_at` | DateTime | No | now() | - | Creation timestamp |
| `updated_at` | DateTime | No | now() | - | Update timestamp |

### Indexes

- `ix_peer_criterion_template_school` on `school_id`
- `ix_peer_criterion_template_subject` on `subject_id`
- `ix_peer_criterion_template_category` on `omza_category`
- `ix_peer_criterion_template_target_level` on `target_level`

### OMZA Categories

The OMZA framework has 4 main categories:

1. **Organiseren** (Organizing)
   - Planning and time management
   - Meeting deadlines
   - Structured work approach

2. **Meedoen** (Participation)
   - Active contribution
   - Engagement with team
   - Taking initiative

3. **Zelfvertrouwen** (Self-confidence)
   - Expressing opinions
   - Standing up for ideas
   - Accepting feedback

4. **Autonomie** (Autonomy)
   - Independent work
   - Self-directed learning
   - Taking responsibility

### Level Descriptors Structure

```json
{
  "1": "Description for level 1 (lowest)",
  "2": "Description for level 2",
  "3": "Description for level 3 (competent)",
  "4": "Description for level 4",
  "5": "Description for level 5 (expert)"
}
```

### Example Record

```python
{
    "school_id": 1,
    "subject_id": 1,
    "omza_category": "Organiseren",
    "title": "Maakt en bewaakt een realistische planning",
    "description": "Een haalbare planning opstellen en deze monitoren",
    "target_level": "onderbouw",
    "level_descriptors": {
        "1": "Maakt geen planning of plant onrealistisch",
        "2": "Maakt een planning maar houdt deze niet bij",
        "3": "Maakt een realistische planning en houdt deze grotendeels bij",
        "4": "Maakt een realistische planning en bewaakt deze consequent",
        "5": "Maakt een excellente planning en past deze proactief aan"
    },
    "learning_objective_ids": [9, 11]
}
```

---

## Project Assessment Criterion Templates

**Table Name:** `project_assessment_criterion_templates`

Template criteria for project assessments (Projectbeoordeling).

### Schema

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | FK → schools.id (CASCADE) | School tenant |
| `subject_id` | Integer | No | - | FK → subjects.id (CASCADE) | Subject/section |
| `category` | String(50) | No | - | - | One of: "projectproces", "eindresultaat", "communicatie" |
| `title` | String(200) | No | - | - | Criterion title |
| `description` | Text | Yes | NULL | - | Detailed description |
| `target_level` | String(20) | Yes | NULL | - | One of: "onderbouw", "bovenbouw", NULL (for both) |
| `level_descriptors` | JSON | No | {} | - | Object with keys "1" to "5", values are descriptions |
| `learning_objective_ids` | JSON | No | [] | - | Array of learning objective IDs |
| `created_at` | DateTime | No | now() | - | Creation timestamp |
| `updated_at` | DateTime | No | now() | - | Update timestamp |

### Indexes

- `ix_project_assessment_criterion_template_school` on `school_id`
- `ix_project_assessment_criterion_template_subject` on `subject_id`
- `ix_project_assessment_criterion_template_category` on `category`
- `ix_project_assessment_criterion_template_target_level` on `target_level`

### Project Assessment Categories

1. **projectproces** (Project Process)
   - Planning and organization
   - Research methods
   - Design iterations
   - Testing and prototyping

2. **eindresultaat** (Final Product)
   - Quality of deliverable
   - Technical execution
   - Innovation and creativity
   - Completeness

3. **communicatie** (Communication)
   - Presentation skills
   - Documentation
   - Stakeholder communication
   - Visual communication

### Example Record

```python
{
    "school_id": 1,
    "subject_id": 1,
    "category": "projectproces",
    "title": "Onderzoekt en verkent oplossingen doelgericht",
    "description": "Systematisch onderzoek doen naar mogelijke oplossingen",
    "target_level": "bovenbouw",
    "level_descriptors": {
        "1": "Doet minimaal onderzoek",
        "2": "Doet oppervlakkig onderzoek",
        "3": "Doet adequaat onderzoek met enkele bronnen",
        "4": "Doet grondig onderzoek met diverse bronnen",
        "5": "Doet uitgebreid en systematisch onderzoek"
    },
    "learning_objective_ids": [13, 14]
}
```

---

## Competency Templates

Competencies use the existing `competencies` table with specific configurations for template mode.

**Table Name:** `competencies`

### Schema (Template-relevant Fields)

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | Index | School tenant |
| `category_id` | Integer | Yes | NULL | FK → competency_categories.id (SET NULL) | Competency category |
| `subject_id` | Integer | Yes | NULL | FK → subjects.id (SET NULL) | Subject (for central competencies) |
| `teacher_id` | Integer | Yes | NULL | FK → users.id (CASCADE) | Teacher (for teacher-specific competencies) |
| `course_id` | Integer | Yes | NULL | FK → courses.id (SET NULL) | Course (optional, for sharing) |
| `is_template` | Boolean | No | False | - | **True for central/template competencies** |
| `phase` | String(20) | Yes | NULL | - | One of: "onderbouw", "bovenbouw", NULL |
| `name` | String(200) | No | - | - | Competency name |
| `description` | Text | Yes | NULL | - | Detailed description |
| `order` | Integer | No | 0 | - | Display order within category |
| `active` | Boolean | No | True | - | Whether competency is active |
| `scale_min` | SmallInteger | No | 1 | - | Minimum scale value |
| `scale_max` | SmallInteger | No | 5 | - | Maximum scale value |
| `scale_labels` | JSON | No | {} | - | Labels for scale levels |
| `metadata_json` | JSON | No | {} | - | Additional metadata |
| `created_at` | DateTime | No | now() | - | Creation timestamp |
| `updated_at` | DateTime | No | now() | - | Update timestamp |

### Constraints

- **Unique constraint**: `uq_competency_name_per_school_teacher` on (`school_id`, `name`, `teacher_id`)

### Indexes

- `ix_competency_school` on `school_id`
- `ix_competency_category_id` on `category_id`
- `ix_competency_subject` on `subject_id`
- `ix_competency_teacher` on `teacher_id`
- `ix_competency_course` on `course_id`
- `ix_competency_is_template` on (`school_id`, `is_template`)

### Competency Categories

**Table Name:** `competency_categories`

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | Index | School tenant |
| `name` | String(200) | No | - | Unique per school | Category name |
| `description` | Text | Yes | NULL | - | Category description |
| `color` | String(20) | Yes | NULL | - | Hex color for UI (e.g., "#3B82F6") |
| `icon` | String(100) | Yes | NULL | - | Icon identifier |
| `order_index` | Integer | No | 0 | - | Display order |

**Default Categories:**

1. **Samenwerken** (Teamwork) - Blue #3B82F6
2. **Plannen & Organiseren** (Planning & Organization) - Green #22C55E
3. **Creatief Denken & Probleemoplossen** (Creative Thinking & Problem Solving) - Purple #A855F7
4. **Technische Vaardigheden** (Technical Skills) - Orange #F97316
5. **Communicatie & Presenteren** (Communication & Presentation) - Yellow #EAB308
6. **Reflectie & Professionele houding** (Reflection & Professional Attitude) - Pink #EC4899

### Competency Rubric Levels

**Table Name:** `competency_rubric_levels`

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | Index | School tenant |
| `competency_id` | Integer | No | - | FK → competencies.id (CASCADE) | Parent competency |
| `level` | SmallInteger | No | - | 1-5 | Scale level |
| `label` | String(100) | Yes | NULL | - | Level label (e.g., "Beginner", "Expert") |
| `description` | Text | No | - | - | Behavior description for this level |

**Constraint:** Unique on (`competency_id`, `level`)

**Default Level Labels:**

1. **Beginner** (Level 1) - Starting level
2. **Ontwikkelend** (Level 2) - Developing
3. **Competent** (Level 3) - Competent
4. **Gevorderd** (Level 4) - Advanced
5. **Expert** (Level 5) - Expert level

### Example Template Competency Record

```python
{
    "school_id": 1,
    "category_id": 1,  # Samenwerken
    "subject_id": 1,
    "teacher_id": None,  # NULL for central competencies
    "course_id": None,
    "is_template": True,  # IMPORTANT: Must be True
    "phase": "onderbouw",
    "name": "Draagt actief bij aan het team",
    "description": "Actief bijdragen aan het bereiken van gemeenschappelijke doelen",
    "order": 1,
    "active": True,
    "scale_min": 1,
    "scale_max": 5,
    "scale_labels": {
        "1": "Beginner",
        "2": "Ontwikkelend",
        "3": "Competent",
        "4": "Gevorderd",
        "5": "Expert"
    },
    "metadata_json": {}
}
```

---

## Learning Objectives

Learning objectives (Leerdoelen/Eindtermen) use the `learning_objectives` table with template configuration.

**Table Name:** `learning_objectives`

### Schema

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | Index | School tenant |
| `subject_id` | Integer | Yes | NULL | FK → subjects.id (SET NULL) | Subject (for central objectives) |
| `teacher_id` | Integer | Yes | NULL | FK → users.id (CASCADE) | Teacher (for teacher-specific) |
| `course_id` | Integer | Yes | NULL | FK → courses.id (SET NULL) | Course (optional) |
| `is_template` | Boolean | No | False | - | **True for central/template objectives** |
| `domain` | String(50) | Yes | NULL | - | Domain code (e.g., "A", "B", "D - Ontwerpen") |
| `title` | String(200) | No | - | - | Learning objective title |
| `description` | Text | Yes | NULL | - | Detailed description |
| `order` | Integer | No | 0 | - | Display order within domain |
| `phase` | String(20) | Yes | NULL | - | One of: "onderbouw", "bovenbouw" |
| `metadata_json` | JSON | No | {} | - | Additional metadata |
| `created_at` | DateTime | No | now() | - | Creation timestamp |
| `updated_at` | DateTime | No | now() | - | Update timestamp |

### Indexes

- `ix_learning_objective_school` on `school_id`
- `ix_learning_objective_subject` on `subject_id`
- `ix_learning_objective_teacher` on `teacher_id`
- `ix_learning_objective_course` on `course_id`
- `ix_learning_objective_is_template` on (`school_id`, `is_template`)
- `ix_learning_objective_domain` on (`school_id`, `domain`)
- `ix_learning_objective_phase` on (`school_id`, `phase`)

### Learning Objective Domains

Learning objectives are typically organized into domains (A-E):

- **Domain A**: General/foundational skills
- **Domain B**: Research and investigation
- **Domain C**: Analysis and evaluation
- **Domain D - Ontwerpen**: Design and development
- **Domain E**: Implementation and realization

### Example Template Learning Objective

```python
{
    "school_id": 1,
    "subject_id": 1,
    "teacher_id": None,  # NULL for central objectives
    "course_id": None,
    "is_template": True,  # IMPORTANT: Must be True
    "domain": "D - Ontwerpen",
    "title": "Conceptontwikkeling",
    "description": "De leerling kan een concept ontwikkelen op basis van onderzoeksresultaten",
    "order": 9,
    "phase": "onderbouw",
    "metadata_json": {}
}
```

### Linking Learning Objectives to Rubric Criteria

**Table Name:** `rubric_criterion_learning_objectives`

This many-to-many junction table links learning objectives to rubric criteria.

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| `id` | Integer | No | Primary Key | Unique identifier |
| `school_id` | Integer | No | Index | School tenant |
| `criterion_id` | Integer | No | FK → rubric_criteria.id (CASCADE) | Rubric criterion |
| `learning_objective_id` | Integer | No | FK → learning_objectives.id (CASCADE) | Learning objective |

**Constraint:** Unique on (`criterion_id`, `learning_objective_id`)

---

## Email Templates

**Table Name:** `mail_templates`

Template emails for various communication scenarios with clients and stakeholders.

### Schema

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | FK → schools.id (CASCADE) | School tenant |
| `subject_id` | Integer | Yes | NULL | FK → subjects.id (SET NULL) | Subject (optional) |
| `name` | String(200) | No | - | - | Template name |
| `type` | String(100) | No | - | - | Template type (see below) |
| `subject` | String(500) | No | - | - | Email subject line (can contain variables) |
| `body` | Text | No | - | - | Email body (text/markdown, can contain variables) |
| `variables_allowed` | JSON | No | {} | - | Dict of allowed variable names and their types |
| `is_active` | Boolean | No | True | - | Whether template is active |
| `created_at` | DateTime | No | now() | - | Creation timestamp |
| `updated_at` | DateTime | No | now() | - | Update timestamp |

### Indexes

- `ix_mail_template_school` on `school_id`
- `ix_mail_template_subject` on `subject_id`
- `ix_mail_template_type` on `type`
- `ix_mail_template_active` on `is_active`

### Template Types

1. **start_opdrachtgever** - Initial contact with client
2. **tussenpresentatie** - Intermediate presentation invitation
3. **eindpresentatie** - Final presentation invitation
4. **bedankmail** - Thank you email after project completion
5. **herinnering** - Reminder email

### Variable Substitution

Templates support variable substitution using placeholders like `{{variable_name}}`.

Common variables:
- `{{contactpersoon}}` - Contact person name
- `{{organisatie}}` - Organization name
- `{{datum}}` - Date
- `{{tijd}}` - Time
- `{{locatie}}` - Location
- `{{projectnaam}}` - Project name
- `{{schoolnaam}}` - School name
- `{{docentnaam}}` - Teacher name

### Example Record

```python
{
    "school_id": 1,
    "subject_id": 1,
    "name": "Start opdrachtgever - O&O",
    "type": "start_opdrachtgever",
    "subject": "Samenwerking project {{projectnaam}} met {{schoolnaam}}",
    "body": """Beste {{contactpersoon}},

Hartelijk dank voor uw interesse in een samenwerking met {{schoolnaam}}. 

Wij zijn verheugd u te kunnen melden dat leerlingen van onze school graag aan de slag gaan met uw opdracht: {{projectnaam}}.

De eerste presentatie vindt plaats op {{datum}} om {{tijd}} op {{locatie}}.

Met vriendelijke groet,
{{docentnaam}}
Docent {{schoolnaam}}""",
    "variables_allowed": {
        "contactpersoon": "string",
        "organisatie": "string",
        "datum": "date",
        "tijd": "time",
        "locatie": "string",
        "projectnaam": "string",
        "schoolnaam": "string",
        "docentnaam": "string"
    },
    "is_active": True
}
```

---

## Standard Remarks

**Table Name:** `standard_remarks`

Pre-written feedback comments that teachers can quickly insert during assessment.

### Schema

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | FK → schools.id (CASCADE) | School tenant |
| `subject_id` | Integer | Yes | NULL | FK → subjects.id (SET NULL) | Subject (optional) |
| `type` | String(50) | No | - | - | Remark type (see below) |
| `category` | String(50) | No | - | - | Remark category: "positief", "aandachtspunt", "aanbeveling" |
| `text` | Text | No | - | - | Remark text |
| `order` | Integer | No | 0 | - | Display order (for drag & drop) |
| `created_at` | DateTime | No | now() | - | Creation timestamp |
| `updated_at` | DateTime | No | now() | - | Update timestamp |

### Indexes

- `ix_standard_remark_school` on `school_id`
- `ix_standard_remark_subject` on `subject_id`
- `ix_standard_remark_type` on `type`
- `ix_standard_remark_category` on `category`

### Remark Types

1. **peer** - For peer evaluations
2. **project** - For project assessments
3. **competency** - For competency assessments
4. **project_feedback** - General project feedback
5. **omza** - Specific to OMZA categories

### Remark Categories

1. **positief** (Positive) - Praise and recognition
2. **aandachtspunt** (Point of Attention) - Areas needing improvement
3. **aanbeveling** (Recommendation) - Suggestions for development

### Example Records

```python
# Positive peer feedback
{
    "school_id": 1,
    "subject_id": 1,
    "type": "peer",
    "category": "positief",
    "text": "Werkt constructief samen en draagt actief bij aan het team",
    "order": 1
}

# Point of attention for project
{
    "school_id": 1,
    "subject_id": 1,
    "type": "project",
    "category": "aandachtspunt",
    "text": "De planning zou nauwkeuriger gevolgd kunnen worden",
    "order": 2
}

# Recommendation for OMZA
{
    "school_id": 1,
    "subject_id": 1,
    "type": "omza",
    "category": "aanbeveling",
    "text": "Probeer meer initiatief te nemen bij het verdelen van taken",
    "order": 3
}
```

---

## Template Tags

**Table Name:** `template_tags`

Tags for categorizing and organizing templates across different types.

### Schema

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| `id` | Integer | No | Auto | Primary Key | Unique identifier |
| `school_id` | Integer | No | - | FK → schools.id (CASCADE) | School tenant |
| `subject_id` | Integer | Yes | NULL | FK → subjects.id (SET NULL) | Subject (optional) |
| `name` | String(100) | No | - | Unique per school | Tag name |
| `description` | Text | Yes | NULL | - | Tag description |
| `color` | String(20) | Yes | NULL | - | Hex color for UI |
| `created_at` | DateTime | No | now() | - | Creation timestamp |
| `updated_at` | DateTime | No | now() | - | Update timestamp |

**Constraint:** Unique on (`school_id`, `name`)

### Template Tag Links

**Table Name:** `template_tag_links`

Many-to-many junction table linking tags to various template types.

| Column | Type | Nullable | Constraints | Description |
|--------|------|----------|-------------|-------------|
| `id` | Integer | No | Primary Key | Unique identifier |
| `school_id` | Integer | No | FK → schools.id (CASCADE) | School tenant |
| `tag_id` | Integer | No | FK → template_tags.id (CASCADE) | Tag |
| `target_type` | String(100) | No | - | Template type (see below) |
| `target_id` | Integer | No | - | ID of the template record |
| `created_at` | DateTime | No | now() | Creation timestamp |

**Constraint:** Unique on (`tag_id`, `target_type`, `target_id`)

### Target Types

- `peer_criterion` - Peer evaluation criterion template
- `project_criterion` - Project assessment criterion template
- `competency` - Competency
- `learning_objective` - Learning objective

### Example Tag and Link

```python
# Tag
{
    "school_id": 1,
    "subject_id": 1,
    "name": "Onderbouw",
    "description": "Templates voor onderbouw niveau",
    "color": "#3B82F6"
}

# Link to a peer criterion template
{
    "school_id": 1,
    "tag_id": 1,
    "target_type": "peer_criterion",
    "target_id": 42  # ID of the peer criterion template
}
```

---

## Migration Best Practices

### 1. Multi-Tenant Considerations

Always loop through all schools when seeding data:

```python
def upgrade():
    conn = op.get_bind()
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()
    
    for school in schools:
        school_id = school[0]
        # Insert template data for this school
```

### 2. Idempotent Migrations

Use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` to make migrations safe to run multiple times:

```python
conn.execute(
    sa.text("""
        INSERT INTO peer_evaluation_criterion_templates 
            (school_id, subject_id, omza_category, title, ...)
        VALUES (:school_id, :subject_id, :category, :title, ...)
        ON CONFLICT (school_id, subject_id, title) DO NOTHING
    """),
    params
)
```

### 3. Subject-Based Templates

Most templates require a `subject_id`. Query subjects first:

```python
subjects = conn.execute(
    sa.text("SELECT id FROM subjects WHERE school_id = :school_id"),
    {"school_id": school_id}
).fetchall()

for subject in subjects:
    subject_id = subject[0]
    # Insert templates for this subject
```

### 4. Preserve Existing Data

When updating, use `COALESCE` to preserve user modifications:

```python
conn.execute(
    sa.text("""
        INSERT INTO competencies (school_id, name, description, ...)
        VALUES (:school_id, :name, :description, ...)
        ON CONFLICT (school_id, name) DO UPDATE SET
            description = COALESCE(
                NULLIF(competencies.description, ''), 
                EXCLUDED.description
            )
    """),
    params
)
```

### 5. JSON Field Defaults

Always provide default values for JSON fields:

```python
"level_descriptors": level_descriptors if level_descriptors else {},
"learning_objective_ids": lo_ids if lo_ids else []
```

### 6. Timestamp Handling

Let the database handle timestamps with `server_default`:

```sql
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

### 7. Foreign Key Cascade

Use appropriate cascade rules:
- `CASCADE` - Delete children when parent is deleted
- `SET NULL` - Set to NULL when parent is deleted
- `RESTRICT` - Prevent deletion if children exist

---

## Example Migration Code

### Complete Migration Template

```python
"""Seed peer evaluation criterion templates for onderbouw

Revision ID: pec_20251207_01
Revises: previous_revision
Create Date: 2025-12-07

"""

from alembic import op
import sqlalchemy as sa

revision = "pec_20251207_01"
down_revision = "previous_revision"
branch_labels = None
depends_on = None

# Template data structure
OMZA_TEMPLATES = {
    "Organiseren": [
        {
            "title": "Maakt en bewaakt een realistische planning",
            "description": "Een haalbare planning opstellen en deze monitoren",
            "target_level": "onderbouw",
            "level_descriptors": {
                "1": "Maakt geen planning of plant onrealistisch",
                "2": "Maakt een planning maar houdt deze niet bij",
                "3": "Maakt een realistische planning en houdt deze grotendeels bij",
                "4": "Maakt een realistische planning en bewaakt deze consequent",
                "5": "Maakt een excellente planning en past deze proactief aan"
            },
            "learning_objective_ids": []
        },
        # More templates...
    ],
    "Meedoen": [
        # Templates...
    ],
    "Zelfvertrouwen": [
        # Templates...
    ],
    "Autonomie": [
        # Templates...
    ]
}


def upgrade():
    """Seed peer evaluation criterion templates for all schools and subjects"""
    conn = op.get_bind()
    
    # Get all schools
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()
    
    for school in schools:
        school_id = school[0]
        
        # Get all subjects for this school
        subjects = conn.execute(
            sa.text("SELECT id FROM subjects WHERE school_id = :school_id"),
            {"school_id": school_id}
        ).fetchall()
        
        for subject in subjects:
            subject_id = subject[0]
            
            # Insert templates for each OMZA category
            for category, templates in OMZA_TEMPLATES.items():
                for template in templates:
                    conn.execute(
                        sa.text("""
                            INSERT INTO peer_evaluation_criterion_templates (
                                school_id, subject_id, omza_category, title,
                                description, target_level, level_descriptors,
                                learning_objective_ids, created_at, updated_at
                            ) VALUES (
                                :school_id, :subject_id, :category, :title,
                                :description, :target_level, :descriptors::jsonb,
                                :lo_ids::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                            )
                            ON CONFLICT DO NOTHING
                        """),
                        {
                            "school_id": school_id,
                            "subject_id": subject_id,
                            "category": category,
                            "title": template["title"],
                            "description": template.get("description"),
                            "target_level": template.get("target_level"),
                            "descriptors": sa.text(f"'{sa.inspect(sa.JSON).stringify(template['level_descriptors'])}'"),
                            "lo_ids": sa.text(f"'{sa.inspect(sa.JSON).stringify(template['learning_objective_ids'])}'")
                        }
                    )


def downgrade():
    """Remove seeded templates"""
    conn = op.get_bind()
    
    # Only remove templates that match our seeded data
    # Be careful not to delete user-created templates
    for category, templates in OMZA_TEMPLATES.items():
        for template in templates:
            conn.execute(
                sa.text("""
                    DELETE FROM peer_evaluation_criterion_templates
                    WHERE omza_category = :category
                    AND title = :title
                    AND target_level = :target_level
                """),
                {
                    "category": category,
                    "title": template["title"],
                    "target_level": template.get("target_level")
                }
            )
```

### Simplified Migration for Small Datasets

```python
def upgrade():
    """Seed standard remarks"""
    conn = op.get_bind()
    
    # Define remarks
    remarks = [
        {
            "type": "peer",
            "category": "positief",
            "text": "Werkt constructief samen en draagt actief bij aan het team"
        },
        {
            "type": "peer",
            "category": "aandachtspunt",
            "text": "Zou meer initiatief kunnen tonen bij het verdelen van taken"
        }
    ]
    
    # Get all schools
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()
    
    for school in schools:
        school_id = school[0]
        
        # Insert remarks for this school
        for idx, remark in enumerate(remarks):
            conn.execute(
                sa.text("""
                    INSERT INTO standard_remarks 
                        (school_id, type, category, text, "order")
                    VALUES (:school_id, :type, :category, :text, :order)
                    ON CONFLICT DO NOTHING
                """),
                {
                    "school_id": school_id,
                    "type": remark["type"],
                    "category": remark["category"],
                    "text": remark["text"],
                    "order": idx + 1
                }
            )


def downgrade():
    """Remove seeded remarks"""
    conn = op.get_bind()
    
    conn.execute(
        sa.text("DELETE FROM standard_remarks WHERE type = 'peer'")
    )
```

---

## Migration Naming Convention

Use descriptive prefixes for migration files:

- `pec_YYYYMMDD_NN_*` - Peer evaluation criterion templates
- `pac_YYYYMMDD_NN_*` - Project assessment criterion templates
- `comp_YYYYMMDD_NN_*` - Competency templates
- `lo_YYYYMMDD_NN_*` - Learning objectives
- `mail_YYYYMMDD_NN_*` - Email templates
- `rem_YYYYMMDD_NN_*` - Standard remarks
- `tag_YYYYMMDD_NN_*` - Template tags

Example: `pec_20251207_01_seed_onderbouw_templates.py`

---

## Quick Reference Tables

### All Template Tables Summary

| Table Name | Purpose | Key Fields | Multi-Tenant | Subject-Linked |
|------------|---------|------------|--------------|----------------|
| `peer_evaluation_criterion_templates` | OMZA peer criteria | omza_category, target_level | Yes | Yes (required) |
| `project_assessment_criterion_templates` | Project assessment | category, target_level | Yes | Yes (required) |
| `competencies` | Competency definitions | is_template=True, category_id | Yes | Yes (optional) |
| `competency_categories` | Category grouping | name, color, order_index | Yes | No |
| `competency_rubric_levels` | Level descriptions | level (1-5), label | Yes | No |
| `learning_objectives` | Learning goals | is_template=True, domain, phase | Yes | Yes (optional) |
| `mail_templates` | Email templates | type, subject, body | Yes | Yes (optional) |
| `standard_remarks` | Quick feedback | type, category, text | Yes | Yes (optional) |
| `template_tags` | Categorization | name, color | Yes | Yes (optional) |
| `template_tag_links` | Tag associations | target_type, target_id | Yes | No |

### Scale/Level Conventions

Most assessment templates use a **1-5 scale**:

1. **Level 1** - Beginner/Starting (Startend)
2. **Level 2** - Developing (Ontwikkelend)
3. **Level 3** - Competent (Competent)
4. **Level 4** - Advanced (Gevorderd)
5. **Level 5** - Expert (Expert)

---

## Additional Resources

- See `backend/migrations/versions/comp_20251127_02_seed_competency_categories.py` for a complete competency seeding example
- See `backend/app/infra/db/models.py` for the complete data model
- See `docs/COMPETENCIES_ARCHITECTURE.md` for competency two-tier architecture details
- See `docs/LEARNING_OBJECTIVES_ARCHITECTURE.md` for learning objectives architecture

---

**Last Updated:** 2025-12-07  
**Version:** 1.0

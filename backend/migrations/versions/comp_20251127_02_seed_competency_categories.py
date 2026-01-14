"""seed default competency categories, competencies and rubric levels

Revision ID: comp_20251127_02
Revises: comp_20251127_01
Create Date: 2025-11-27 20:30:00.000000

This migration seeds the default competency categories, competencies and
rubric level descriptions for schools. These are global defaults that can
be customized per school.

Structure:
- 6 categories
- 5 competencies per category (30 total)
- 5 rubric levels per competency (150 total)
"""

from alembic import op
import sqlalchemy as sa

revision = "comp_20251127_02"
down_revision = "comp_20251127_01"
branch_labels = None
depends_on = None


# Complete competency data structure with exact names from the specification
# Each category has 5 competencies, each competency has 5 rubric level descriptions
CATEGORIES = [
    {
        "name": "Samenwerken",
        "description": "Effectief samenwerken met anderen in een team",
        "color": "#3B82F6",  # blue-500
        "icon": "users",
        "order_index": 1,
        "competencies": [
            {
                "name": "Draagt actief bij aan het team",
                "description": "Actief bijdragen aan het bereiken van gemeenschappelijke doelen",
                "order": 1,
            },
            {
                "name": "Luistert en reageert constructief",
                "description": "Open staan voor input van anderen en constructief reageren",
                "order": 2,
            },
            {
                "name": "Communiceert duidelijk binnen het team",
                "description": "Helder en effectief communiceren met teamleden",
                "order": 3,
            },
            {
                "name": "Verdeelt en stemt taken effectief af binnen het team",
                "description": "Taken verdelen en afstemmen voor optimale samenwerking",
                "order": 4,
            },
            {
                "name": "Neemt verantwoordelijkheid voor gezamenlijke taken en ondersteunt teamleden waar nodig",
                "description": "Verantwoordelijkheid nemen en teamleden ondersteunen",
                "order": 5,
            },
        ],
    },
    {
        "name": "Plannen & Organiseren",
        "description": "Effectief plannen en organiseren van werk en tijd",
        "color": "#22C55E",  # green-500
        "icon": "calendar",
        "order_index": 2,
        "competencies": [
            {
                "name": "Maakt en bewaakt een realistische planning",
                "description": "Een haalbare planning opstellen en deze monitoren",
                "order": 1,
            },
            {
                "name": "Houdt zich aan afspraken en deadlines",
                "description": "Betrouwbaar zijn in het nakomen van afspraken",
                "order": 2,
            },
            {
                "name": "Werkt gestructureerd en overzichtelijk",
                "description": "Georganiseerd werken met duidelijke structuur",
                "order": 3,
            },
            {
                "name": "Gebruikt hulpmiddelen effectief (Trello, planning, agenda)",
                "description": "Digitale en fysieke planningstools effectief inzetten",
                "order": 4,
            },
            {
                "name": "Stuurt planning en werkproces bij wanneer nodig",
                "description": "Flexibel aanpassen van planning bij veranderingen",
                "order": 5,
            },
        ],
    },
    {
        "name": "Creatief Denken & Probleemoplossen",
        "description": "Innovatief denken en oplossingen vinden voor problemen",
        "color": "#A855F7",  # purple-500
        "icon": "lightbulb",
        "order_index": 3,
        "competencies": [
            {
                "name": "Genereert meerdere ideeën en denkrichtingen",
                "description": "Diverse oplossingsrichtingen verkennen en bedenken",
                "order": 1,
            },
            {
                "name": "Onderzoekt en verkent oplossingen doelgericht",
                "description": "Systematisch onderzoek doen naar mogelijke oplossingen",
                "order": 2,
            },
            {
                "name": "Bouwt en test prototypes om keuzes te onderbouwen",
                "description": "Prototypes maken en testen om ontwerpkeuzes te valideren",
                "order": 3,
            },
            {
                "name": "Denkt kritisch: herkent het kernprobleem en maakt onderbouwde keuzes",
                "description": "Kritisch analyseren en beargumenteerde beslissingen nemen",
                "order": 4,
            },
            {
                "name": "Verbetert oplossingen op basis van feedback en testresultaten",
                "description": "Iteratief verbeteren op basis van input en tests",
                "order": 5,
            },
        ],
    },
    {
        "name": "Technische Vaardigheden",
        "description": "Beheersen van vakspecifieke kennis en vaardigheden",
        "color": "#F97316",  # orange-500
        "icon": "wrench",
        "order_index": 4,
        "competencies": [
            {
                "name": "Maakt nauwkeurige technische ontwerpen (CAD modelleren en technische tekeningen)",
                "description": "Precieze technische ontwerpen en tekeningen maken",
                "order": 1,
            },
            {
                "name": "Bouwt stevige en functionele constructies",
                "description": "Robuuste en werkende constructies realiseren",
                "order": 2,
            },
            {
                "name": "Programmeert logisch en gestructureerd",
                "description": "Georganiseerde en logische code schrijven",
                "order": 3,
            },
            {
                "name": "Gaat veilig en vaardig om met materialen en apparatuur",
                "description": "Veilig en bekwaam werken met gereedschap en materialen",
                "order": 4,
            },
            {
                "name": "Past technische kennis doelgericht toe in een ontwerp",
                "description": "Theoretische kennis praktisch toepassen in ontwerpen",
                "order": 5,
            },
        ],
    },
    {
        "name": "Communicatie & Presenteren",
        "description": "Effectief communiceren en presenteren van ideeën",
        "color": "#EAB308",  # yellow-500
        "icon": "message-circle",
        "order_index": 5,
        "competencies": [
            {
                "name": "Legt ideeën en keuzes helder uit",
                "description": "Duidelijk uitleggen van gedachten en beslissingen",
                "order": 1,
            },
            {
                "name": "Maakt duidelijke en passende visualisaties",
                "description": "Effectieve visuele representaties creëren",
                "order": 2,
            },
            {
                "name": "Schrijft gestructureerd en volledig (verslaglegging)",
                "description": "Georganiseerde en complete documentatie schrijven",
                "order": 3,
            },
            {
                "name": "Presenteert overtuigend en afgestemd op het publiek",
                "description": "Aansprekend presenteren voor de doelgroep",
                "order": 4,
            },
            {
                "name": "Rapporteert voortgang en resultaten tijdig en professioneel",
                "description": "Op tijd en professioneel rapporteren over voortgang",
                "order": 5,
            },
        ],
    },
    {
        "name": "Reflectie & Professionele houding",
        "description": "Zelfreflectie en professioneel gedrag",
        "color": "#EC4899",  # pink-500
        "icon": "mirror",
        "order_index": 6,
        "competencies": [
            {
                "name": "Reflecteert eerlijk op eigen werk en aanpak",
                "description": "Kritisch en eerlijk kijken naar eigen handelen",
                "order": 1,
            },
            {
                "name": "Gebruikt feedback om zichtbare verbeteringen aan te brengen",
                "description": "Feedback omzetten in concrete verbeteracties",
                "order": 2,
            },
            {
                "name": "Neemt verantwoordelijkheid voor eigen taken en gedrag",
                "description": "Verantwoording nemen voor eigen werk en houding",
                "order": 3,
            },
            {
                "name": "Werkt zelfstandig en toont doorzettingsvermogen",
                "description": "Zelfstandig werken en volhouden bij tegenslagen",
                "order": 4,
            },
            {
                "name": "Past houding en aanpak aan wanneer dat nodig is",
                "description": "Flexibel aanpassen van werkwijze en houding",
                "order": 5,
            },
        ],
    },
]

# Default rubric level labels (1-5 scale)
LEVEL_LABELS = {
    1: "Beginner",
    2: "Ontwikkelend",
    3: "Competent",
    4: "Gevorderd",
    5: "Expert",
}


def upgrade():
    """
    Seed competency categories, competencies, and rubric levels for all existing schools.
    Uses ON CONFLICT to ensure idempotency - can be run multiple times safely.
    """
    conn = op.get_bind()

    # Get all school IDs
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()

    for school in schools:
        school_id = school[0]

        for cat_data in CATEGORIES:
            # Insert category (skip if already exists)
            result = conn.execute(
                sa.text(
                    """
                    INSERT INTO competency_categories (school_id, name, description, color, icon, order_index)
                    VALUES (:school_id, :name, :description, :color, :icon, :order_index)
                    ON CONFLICT (school_id, name) DO NOTHING
                    RETURNING id
                """
                ),
                {
                    "school_id": school_id,
                    "name": cat_data["name"],
                    "description": cat_data["description"],
                    "color": cat_data["color"],
                    "icon": cat_data["icon"],
                    "order_index": cat_data["order_index"],
                },
            )

            row = result.fetchone()
            if row:
                category_id = row[0]
            else:
                # Category already exists, get its ID
                existing = conn.execute(
                    sa.text(
                        """
                        SELECT id FROM competency_categories 
                        WHERE school_id = :school_id AND name = :name
                    """
                    ),
                    {"school_id": school_id, "name": cat_data["name"]},
                ).fetchone()
                category_id = existing[0] if existing else None

            if not category_id:
                continue

            # Insert competencies for this category
            for comp_data in cat_data["competencies"]:
                # Insert or update competency
                comp_result = conn.execute(
                    sa.text(
                        """
                        INSERT INTO competencies (school_id, category_id, name, description, "order", active)
                        VALUES (:school_id, :category_id, :name, :description, :order, true)
                        ON CONFLICT (school_id, name) DO UPDATE SET
                            category_id = COALESCE(competencies.category_id, EXCLUDED.category_id),
                            description = COALESCE(NULLIF(competencies.description, ''), EXCLUDED.description)
                        RETURNING id
                    """
                    ),
                    {
                        "school_id": school_id,
                        "category_id": category_id,
                        "name": comp_data["name"],
                        "description": comp_data["description"],
                        "order": comp_data["order"],
                    },
                )

                comp_row = comp_result.fetchone()
                if comp_row:
                    competency_id = comp_row[0]
                else:
                    # Competency already exists, get its ID
                    existing_comp = conn.execute(
                        sa.text(
                            """
                            SELECT id FROM competencies 
                            WHERE school_id = :school_id AND name = :name
                        """
                        ),
                        {"school_id": school_id, "name": comp_data["name"]},
                    ).fetchone()
                    competency_id = existing_comp[0] if existing_comp else None

                if not competency_id:
                    continue

                # Insert 5 rubric levels for this competency (1-5)
                for level in range(1, 6):
                    conn.execute(
                        sa.text(
                            """
                            INSERT INTO competency_rubric_levels 
                                (school_id, competency_id, level, label, description)
                            VALUES (:school_id, :competency_id, :level, :label, :description)
                            ON CONFLICT (competency_id, level) DO NOTHING
                        """
                        ),
                        {
                            "school_id": school_id,
                            "competency_id": competency_id,
                            "level": level,
                            "label": LEVEL_LABELS[level],
                            "description": "",  # Empty placeholder - to be filled via admin UI
                        },
                    )


def downgrade():
    """
    Remove all seeded competency data.
    Order: rubric_levels -> competencies (set category_id NULL) -> categories
    """
    conn = op.get_bind()

    # First, delete all rubric levels for competencies that have a category
    conn.execute(
        sa.text(
            """
            DELETE FROM competency_rubric_levels 
            WHERE competency_id IN (
                SELECT id FROM competencies WHERE category_id IS NOT NULL
            )
        """
        )
    )

    # Set category_id to NULL for all competencies (preserves the competencies)
    conn.execute(
        sa.text(
            "UPDATE competencies SET category_id = NULL WHERE category_id IS NOT NULL"
        )
    )

    # Delete all categories
    conn.execute(sa.text("DELETE FROM competency_categories"))

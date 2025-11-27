"""seed default competency categories and competencies

Revision ID: comp_20251127_02
Revises: comp_20251127_01
Create Date: 2025-11-27 20:30:00.000000

This migration seeds the default competency categories and competencies
for schools. These are global defaults that can be customized per school.
"""

from alembic import op
import sqlalchemy as sa

revision = "comp_20251127_02"
down_revision = "comp_20251127_01"
branch_labels = None
depends_on = None


# Default categories with colors (using Tailwind-compatible hex colors)
CATEGORIES = [
    {
        "name": "Samenwerken",
        "description": "Effectief samenwerken met anderen in een team",
        "color": "#3B82F6",  # blue-500
        "icon": "users",
        "order_index": 1,
        "competencies": [
            {
                "name": "Teamwork",
                "description": "Actief bijdragen aan het bereiken van gemeenschappelijke doelen",
                "order": 1,
            },
            {
                "name": "Constructief feedback geven",
                "description": "Op een constructieve manier feedback geven aan teamleden",
                "order": 2,
            },
            {
                "name": "Feedback ontvangen",
                "description": "Open staan voor feedback en deze gebruiken om te verbeteren",
                "order": 3,
            },
            {
                "name": "Conflicthantering",
                "description": "Effectief omgaan met meningsverschillen en conflicten",
                "order": 4,
            },
            {
                "name": "Verantwoordelijkheid nemen",
                "description": "Eigen taken oppakken en verantwoording afleggen",
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
                "name": "Tijdmanagement",
                "description": "Effectief verdelen en bewaken van beschikbare tijd",
                "order": 1,
            },
            {
                "name": "Prioriteiten stellen",
                "description": "Bepalen welke taken het belangrijkst zijn",
                "order": 2,
            },
            {
                "name": "Projectplanning",
                "description": "Een realistisch plan maken voor complexe taken",
                "order": 3,
            },
            {
                "name": "Deadlines halen",
                "description": "Werk op tijd afronden volgens afspraken",
                "order": 4,
            },
            {
                "name": "Overzicht bewaren",
                "description": "Het geheel in de gaten houden bij complexe taken",
                "order": 5,
            },
        ],
    },
    {
        "name": "Creatief denken & probleemoplossen",
        "description": "Innovatief denken en oplossingen vinden voor problemen",
        "color": "#A855F7",  # purple-500
        "icon": "lightbulb",
        "order_index": 3,
        "competencies": [
            {
                "name": "Creativiteit",
                "description": "Nieuwe en originele ideeën bedenken",
                "order": 1,
            },
            {
                "name": "Probleemanalyse",
                "description": "Problemen systematisch analyseren en begrijpen",
                "order": 2,
            },
            {
                "name": "Oplossingsgerichtheid",
                "description": "Focus op het vinden van oplossingen",
                "order": 3,
            },
            {
                "name": "Innovatief denken",
                "description": "Buiten gebaande paden denken",
                "order": 4,
            },
            {
                "name": "Kritisch denken",
                "description": "Informatie en aannames kritisch evalueren",
                "order": 5,
            },
        ],
    },
    {
        "name": "Technische vaardigheden",
        "description": "Beheersen van vakspecifieke kennis en vaardigheden",
        "color": "#F97316",  # orange-500
        "icon": "wrench",
        "order_index": 4,
        "competencies": [
            {
                "name": "Vakkennis toepassen",
                "description": "Theoretische kennis toepassen in de praktijk",
                "order": 1,
            },
            {
                "name": "Gereedschappen beheersen",
                "description": "Effectief gebruiken van tools en software",
                "order": 2,
            },
            {
                "name": "Kwaliteitsbewustzijn",
                "description": "Oog hebben voor kwaliteit en nauwkeurigheid",
                "order": 3,
            },
            {
                "name": "Technisch inzicht",
                "description": "Begrijpen hoe systemen en processen werken",
                "order": 4,
            },
            {
                "name": "Vakvaardigheden ontwikkelen",
                "description": "Continu werken aan verbetering van technische skills",
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
                "name": "Mondeling communiceren",
                "description": "Helder en effectief spreken",
                "order": 1,
            },
            {
                "name": "Schriftelijk communiceren",
                "description": "Helder en correct schrijven",
                "order": 2,
            },
            {
                "name": "Presentatievaardigheden",
                "description": "Overtuigend presenteren voor een publiek",
                "order": 3,
            },
            {
                "name": "Luistervaardigheden",
                "description": "Actief luisteren naar anderen",
                "order": 4,
            },
            {
                "name": "Visuele communicatie",
                "description": "Ideeën visueel duidelijk overbrengen",
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
                "name": "Zelfreflectie",
                "description": "Kritisch kijken naar eigen handelen en ontwikkeling",
                "order": 1,
            },
            {
                "name": "Leervermogen",
                "description": "Open staan voor leren en groei",
                "order": 2,
            },
            {
                "name": "Professionele houding",
                "description": "Professioneel gedrag tonen in diverse situaties",
                "order": 3,
            },
            {
                "name": "Zelfstandigheid",
                "description": "Zelfstandig kunnen werken en beslissingen nemen",
                "order": 4,
            },
            {
                "name": "Initiatief tonen",
                "description": "Proactief handelen zonder te wachten op instructies",
                "order": 5,
            },
        ],
    },
]


def upgrade():
    # This migration seeds default data for existing schools
    # New schools will get this data via an application-level seed function
    
    # Get connection
    conn = op.get_bind()
    
    # Get all school IDs
    schools = conn.execute(sa.text("SELECT id FROM schools")).fetchall()
    
    for school in schools:
        school_id = school[0]
        
        for cat_data in CATEGORIES:
            # Insert category
            result = conn.execute(
                sa.text("""
                    INSERT INTO competency_categories (school_id, name, description, color, icon, order_index)
                    VALUES (:school_id, :name, :description, :color, :icon, :order_index)
                    ON CONFLICT (school_id, name) DO NOTHING
                    RETURNING id
                """),
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
                
                # Insert competencies for this category
                for comp_data in cat_data["competencies"]:
                    conn.execute(
                        sa.text("""
                            INSERT INTO competencies (school_id, category_id, name, description, "order", active)
                            VALUES (:school_id, :category_id, :name, :description, :order, true)
                            ON CONFLICT (school_id, name) DO UPDATE SET
                                category_id = EXCLUDED.category_id,
                                description = EXCLUDED.description,
                                "order" = EXCLUDED."order"
                        """),
                        {
                            "school_id": school_id,
                            "category_id": category_id,
                            "name": comp_data["name"],
                            "description": comp_data["description"],
                            "order": comp_data["order"],
                        },
                    )


def downgrade():
    # Remove seeded data
    conn = op.get_bind()
    
    # Delete competencies that were linked to categories
    conn.execute(
        sa.text("UPDATE competencies SET category_id = NULL WHERE category_id IS NOT NULL")
    )
    
    # Delete all categories (they're school-specific so we can remove all)
    conn.execute(sa.text("DELETE FROM competency_categories"))

"""cleanup duplicate competency categories

Revision ID: 20260124_01
Revises: 20260121_01
Create Date: 2026-01-24 20:43:00.000000

This migration cleans up duplicate competency categories that may have been
created by old seed scripts using abbreviated names. It removes categories
with the old names if the correct full names exist:

Old names to remove:
- "Plannen" -> should be "Plannen & Organiseren"
- "Creatief Denken" -> should be "Creatief Denken & Probleemoplossen"
- "Technisch Werken" -> should be "Technische Vaardigheden"
- "Communiceren" -> should be "Communicatie & Presenteren"
- "Reflecteren" -> should be "Reflectie & Professionele houding"
"""

from alembic import op
import sqlalchemy as sa

revision = "20260124_01"
down_revision = "20260121_01"
branch_labels = None
depends_on = None

# Mapping of old names to correct names
OLD_TO_NEW_NAMES = {
    "Plannen": "Plannen & Organiseren",
    "Creatief Denken": "Creatief Denken & Probleemoplossen",
    "Technisch Werken": "Technische Vaardigheden",
    "Communiceren": "Communicatie & Presenteren",
    "Reflecteren": "Reflectie & Professionele houding",
}


def upgrade():
    """
    Remove duplicate competency categories with old abbreviated names.
    Only removes if the new full name exists for the same school.
    """
    conn = op.get_bind()

    for old_name, new_name in OLD_TO_NEW_NAMES.items():
        # For each school that has both old and new categories
        result = conn.execute(
            sa.text(
                """
                SELECT DISTINCT cc_old.school_id
                FROM competency_categories cc_old
                INNER JOIN competency_categories cc_new 
                    ON cc_old.school_id = cc_new.school_id
                WHERE cc_old.name = :old_name 
                AND cc_new.name = :new_name
            """
            ),
            {"old_name": old_name, "new_name": new_name},
        )

        school_ids = [row[0] for row in result.fetchall()]

        for school_id in school_ids:
            # Get the IDs of both categories
            old_cat = conn.execute(
                sa.text(
                    """
                    SELECT id FROM competency_categories 
                    WHERE school_id = :school_id AND name = :old_name
                """
                ),
                {"school_id": school_id, "old_name": old_name},
            ).fetchone()

            new_cat = conn.execute(
                sa.text(
                    """
                    SELECT id FROM competency_categories 
                    WHERE school_id = :school_id AND name = :new_name
                """
                ),
                {"school_id": school_id, "new_name": new_name},
            ).fetchone()

            if not old_cat or not new_cat:
                continue

            old_cat_id = old_cat[0]
            new_cat_id = new_cat[0]

            # Migrate any competencies from old category to new category
            conn.execute(
                sa.text(
                    """
                    UPDATE competencies 
                    SET category_id = :new_cat_id 
                    WHERE category_id = :old_cat_id 
                    AND school_id = :school_id
                """
                ),
                {
                    "new_cat_id": new_cat_id,
                    "old_cat_id": old_cat_id,
                    "school_id": school_id,
                },
            )

            # Delete the old category
            conn.execute(
                sa.text(
                    """
                    DELETE FROM competency_categories 
                    WHERE id = :old_cat_id AND school_id = :school_id
                """
                ),
                {"old_cat_id": old_cat_id, "school_id": school_id},
            )

            print(
                f"Cleaned up duplicate category '{old_name}' -> '{new_name}' for school {school_id}"
            )


def downgrade():
    """
    This migration is a cleanup operation and should not be reversed.
    The old duplicate categories were created incorrectly and should not be restored.
    """
    pass

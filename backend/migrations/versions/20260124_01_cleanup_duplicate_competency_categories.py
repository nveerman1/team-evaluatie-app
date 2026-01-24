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

revision = "20260124_01_cleanup_comp"
down_revision = "20260121_01_pat"
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
    Removes old names regardless of whether new names exist, but only migrates
    competencies if both exist.
    """
    conn = op.get_bind()

    for old_name, new_name in OLD_TO_NEW_NAMES.items():
        # Find all schools that have the old category name (case-insensitive)
        schools_with_old = conn.execute(
            sa.text(
                """
                SELECT DISTINCT school_id, id, name
                FROM competency_categories
                WHERE LOWER(name) = LOWER(:old_name)
            """
            ),
            {"old_name": old_name},
        ).fetchall()

        for school_id, old_cat_id, actual_old_name in schools_with_old:
            # Check if the new category exists for this school
            new_cat = conn.execute(
                sa.text(
                    """
                    SELECT id FROM competency_categories 
                    WHERE school_id = :school_id 
                    AND (name = :new_name OR LOWER(name) = LOWER(:new_name))
                """
                ),
                {"school_id": school_id, "new_name": new_name},
            ).fetchone()

            if new_cat:
                new_cat_id = new_cat[0]
                
                # Migrate any competencies from old category to new category
                migrated = conn.execute(
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
                
                print(
                    f"Migrated competencies from '{actual_old_name}' to '{new_name}' for school {school_id}"
                )

            # Delete the old category (whether or not new one exists)
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
                f"Deleted duplicate category '{actual_old_name}' for school {school_id}"
            )


def downgrade():
    """
    This migration is a cleanup operation and should not be reversed.
    The old duplicate categories were created incorrectly and should not be restored.
    """
    pass

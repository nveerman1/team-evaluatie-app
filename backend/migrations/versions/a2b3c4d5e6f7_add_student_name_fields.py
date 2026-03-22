"""Add student_number, first_name, prefix, last_name to users

Revision ID: a2b3c4d5e6f7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-21 14:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "a2b3c4d5e6f7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to users table
    op.add_column("users", sa.Column("student_number", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("first_name", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("prefix", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("last_name", sa.String(100), nullable=True))

    # Add index on student_number
    op.create_index("ix_users_student_number", "users", ["student_number"])

    # Add partial unique index: student_number is unique per school, but only when not NULL
    # For non-PostgreSQL databases (e.g. SQLite in tests), use a regular unique index
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            CREATE UNIQUE INDEX uq_student_number_per_school
            ON users (school_id, student_number)
            WHERE student_number IS NOT NULL
            """
        )
    else:
        # SQLite / other: just create a regular index (no partial index support)
        op.create_index(
            "uq_student_number_per_school",
            "users",
            ["school_id", "student_number"],
        )

    # Data migration: split existing 'name' into first_name / last_name
    # Simple heuristic: last word = last_name, everything before = first_name
    op.execute(
        """
        UPDATE users
        SET
            last_name = CASE
                WHEN INSTR(name, ' ') > 0
                THEN SUBSTR(name, LENGTH(name) - INSTR(REVERSE(name), ' ') + 2)
                ELSE name
            END,
            first_name = CASE
                WHEN INSTR(name, ' ') > 0
                THEN SUBSTR(name, 1, LENGTH(name) - INSTR(REVERSE(name), ' '))
                ELSE NULL
            END
        WHERE name IS NOT NULL AND name != ''
        """
        if bind.dialect.name != "postgresql"
        else """
        UPDATE users
        SET
            last_name = CASE
                WHEN POSITION(' ' IN name) > 0
                THEN SPLIT_PART(name, ' ', -1)
                ELSE name
            END,
            first_name = CASE
                WHEN POSITION(' ' IN name) > 0
                THEN LEFT(name, LENGTH(name) - LENGTH(SPLIT_PART(name, ' ', -1)) - 1)
                ELSE NULL
            END
        WHERE name IS NOT NULL AND name != ''
        """
    )


def downgrade() -> None:
    # Drop partial/regular unique index
    op.drop_index("uq_student_number_per_school", table_name="users")
    op.drop_index("ix_users_student_number", table_name="users")

    op.drop_column("users", "last_name")
    op.drop_column("users", "prefix")
    op.drop_column("users", "first_name")
    op.drop_column("users", "student_number")

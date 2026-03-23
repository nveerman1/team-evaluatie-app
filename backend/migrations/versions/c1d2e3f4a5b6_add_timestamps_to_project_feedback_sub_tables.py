"""Add missing created_at/updated_at to project_feedback sub-tables

The Base class adds created_at and updated_at to every SQLAlchemy model, but
the original migration (b1c2d3e4f5a6) only included these columns for
project_feedback_rounds.  SQLAlchemy uses RETURNING to fetch them after INSERT,
causing a 500 "UndefinedColumn" error when creating a feedback round.

Revision ID: c1d2e3f4a5b6
Revises: b1c2d3e4f5a6
Create Date: 2026-03-23 11:30:00.000000

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "c1d2e3f4a5b6"
down_revision = "b1c2d3e4f5a6"
branch_labels = None
depends_on = None

_TABLES = [
    "project_feedback_questions",
    "project_feedback_responses",
    "project_feedback_answers",
]


def upgrade() -> None:
    # Use IF NOT EXISTS so this migration is safe whether the columns were
    # already created by the updated b1c2d3e4f5a6 migration (fresh install)
    # or are genuinely missing (existing install from the original migration).
    for table in _TABLES:
        op.execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS"
            " created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        )
        op.execute(
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS"
            " updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        )


def downgrade() -> None:
    for table in reversed(_TABLES):
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS updated_at")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS created_at")

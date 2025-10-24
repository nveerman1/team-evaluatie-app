"""add cluster to users

Revision ID: 7525b9bfa8d2
Revises: add_class_name_to_users
Create Date: 2025-10-18 21:41:13.829727
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "7525b9bfa8d2"
down_revision: Union[str, None] = "add_class_name_to_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ensure_grades_meta_exists_and_not_null() -> None:
    """
    Zorgt dat grades.meta bestaat (JSONB), geen NULLs heeft en NOT NULL is.
    """
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("grades")}
    added = False

    if "meta" not in cols:
        op.add_column(
            "grades",
            sa.Column(
                "meta",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
                server_default=sa.text("'{}'::jsonb"),
            ),
        )
        added = True

    op.execute("UPDATE grades SET meta = '{}'::jsonb WHERE meta IS NULL")

    op.alter_column(
        "grades",
        "meta",
        nullable=False,
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
    )

    if added:
        op.alter_column("grades", "meta", server_default=None)


def _drop_index_if_exists(name: str, schema: str = "public") -> None:
    """
    Drop een index alleen als hij bestaat (Postgres).
    """
    op.execute(f'DROP INDEX IF EXISTS "{schema}"."{name}"')


def _drop_column_if_exists(table: str, column: str) -> None:
    """
    Drop een kolom alleen als hij bestaat.
    """
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns(table)}
    if column in cols:
        op.drop_column(table, column)


def upgrade() -> None:
    # 1) Zorg dat grades.meta goed staat
    _ensure_grades_meta_exists_and_not_null()

    # 2) published_grades timestamps -> timezone=True
    op.alter_column(
        "published_grades",
        "created_at",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )
    op.alter_column(
        "published_grades",
        "updated_at",
        existing_type=postgresql.TIMESTAMP(),
        type_=sa.DateTime(timezone=True),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # 3) Team->cluster cleanup: alleen droppen als ze bestaan
    _drop_index_if_exists("ix_users_team_id")  # safe op schone DB
    _drop_column_if_exists("users", "team_id")  # safe op schone DB


def downgrade() -> None:
    # zet published_grades timestamps terug
    op.alter_column(
        "published_grades",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )
    op.alter_column(
        "published_grades",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        type_=postgresql.TIMESTAMP(),
        existing_nullable=False,
        existing_server_default=sa.text("now()"),
    )

    # maak grades.meta weer nullable (drop kolom niet in downgrade)
    op.alter_column(
        "grades",
        "meta",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
    )

    # herstel users.team_id + index (downgrade pad)
    op.add_column(
        "users",
        sa.Column("team_id", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.create_index("ix_users_team_id", "users", ["team_id"], unique=False)

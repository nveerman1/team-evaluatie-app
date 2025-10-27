"""add_unique_index_groups_school_course_team_number

Revision ID: 49147e418f67
Revises: d1aa98606da3
Create Date: 2025-10-27 22:05:23.471022

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "49147e418f67"
down_revision: Union[str, None] = "d1aa98606da3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_index(
        "uq_groups_school_course_team",
        "groups",
        ["school_id", "course_id", "team_number"],
        unique=True,
        postgresql_where=sa.text("team_number IS NOT NULL"),
    )


def downgrade():
    op.drop_index("uq_groups_school_course_team", table_name="groups")

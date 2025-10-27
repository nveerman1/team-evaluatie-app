"""add team_number to groups + composite index + backfill

Revision ID: d1aa98606da3
Revises: 4b9dc9370c68
Create Date: 2025-10-27 21:44:00.972487

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1aa98606da3"
down_revision: Union[str, None] = "4b9dc9370c68"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Kolom toevoegen
    op.add_column(
        "groups",
        sa.Column("team_number", sa.Integer(), nullable=True),
    )

    # 2) Indexen
    op.create_index("ix_groups_team_number", "groups", ["team_number"], unique=False)
    # Let op: je had al ix_group_course in je model; composite index erbij:
    op.create_index(
        "ix_groups_course_team", "groups", ["course_id", "team_number"], unique=False
    )

    # 3) (optioneel) Backfill: zet team_number op group-niveau
    #    als ALLE leden in die groep hetzelfde team_number hebben.
    #    Pas 'group_members' aan als je tabel anders heet.
    op.execute(
        """
        WITH per_group AS (
          SELECT
            gm.group_id,
            COUNT(*) AS cnt_members,
            COUNT(DISTINCT u.team_number) AS distinct_team_numbers,
            MIN(u.team_number) FILTER (WHERE u.team_number IS NOT NULL) AS decided_team
          FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          GROUP BY gm.group_id
        )
        UPDATE groups g
        SET team_number = p.decided_team
        FROM per_group p
        WHERE g.id = p.group_id
          AND p.distinct_team_numbers = 1
          AND p.decided_team IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_groups_course_team", table_name="groups")
    op.drop_index("ix_groups_team_number", table_name="groups")
    op.drop_column("groups", "team_number")

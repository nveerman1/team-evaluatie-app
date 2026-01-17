"""merge heads

Revision ID: adec74c3bac7
Revises: seed_20260111_01, pasa_20260116_01
Create Date: 2026-01-16 15:13:18.223791

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "adec74c3bac7"
down_revision: Union[str, Sequence[str], None] = (
    "seed_20260111_01",
    "pasa_20260116_01",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

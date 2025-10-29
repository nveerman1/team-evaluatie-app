"""merge multiple heads

Revision ID: cfa88434a159
Revises: abc123def456, def789ghi012
Create Date: 2025-10-29 23:00:25.503196

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "cfa88434a159"
down_revision: Union[str, None] = ("abc123def456", "def789ghi012")  # type: ignore[assignment]
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

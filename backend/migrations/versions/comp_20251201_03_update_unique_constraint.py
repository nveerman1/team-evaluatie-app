"""Update competency unique constraint to include teacher_id

This allows teachers to create competencies with the same name as
central/template competencies or as other teachers' competencies.

The new constraint ensures:
- Central competencies (teacher_id IS NULL) are unique per school + name
- Teacher competencies are unique per school + name + teacher_id

Revision ID: comp_20251201_03
Revises: comp_20251201_02
Create Date: 2025-12-01 21:45:00.000000
"""

from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "comp_20251201_03"
down_revision: Union[str, None] = "comp_20251201_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the old unique constraint
    op.drop_constraint(
        "uq_competency_name_per_school",
        "competencies",
        type_="unique"
    )
    
    # Create new unique constraint that includes teacher_id
    # This allows same name for different teachers or for central vs teacher
    op.create_unique_constraint(
        "uq_competency_name_per_school_teacher",
        "competencies",
        ["school_id", "name", "teacher_id"]
    )


def downgrade() -> None:
    # Drop the new constraint
    op.drop_constraint(
        "uq_competency_name_per_school_teacher",
        "competencies",
        type_="unique"
    )
    
    # Restore the old constraint
    op.create_unique_constraint(
        "uq_competency_name_per_school",
        "competencies",
        ["school_id", "name"]
    )

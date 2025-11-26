"""add_student_id_to_project_scores for individual score overrides

Revision ID: stud_20251126_01
Revises: ext_20251125_03
Create Date: 2025-11-26 14:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "stud_20251126_01"
down_revision = "ext_20251125_03"
branch_labels = None
depends_on = None


def upgrade():
    # Add student_id column to project_assessment_scores
    # This allows individual student score overrides
    op.add_column(
        "project_assessment_scores",
        sa.Column("student_id", sa.Integer(), nullable=True),
    )

    # Add foreign key constraint for student_id
    op.create_foreign_key(
        "fk_project_score_student",
        "project_assessment_scores",
        "users",
        ["student_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Add index for better query performance when filtering by student
    op.create_index(
        "ix_project_score_student",
        "project_assessment_scores",
        ["assessment_id", "student_id"],
    )

    # Drop old unique constraint
    op.drop_constraint(
        "uq_project_score_per_criterion_team",
        "project_assessment_scores",
        type_="unique",
    )

    # Create new unique constraint including student_id
    # This allows: one team score (student_id NULL) per criterion per team
    # AND one individual override (student_id set) per criterion per student
    op.create_unique_constraint(
        "uq_project_score_per_criterion_team_student",
        "project_assessment_scores",
        ["assessment_id", "criterion_id", "team_number", "student_id"],
    )


def downgrade():
    # Drop new constraint
    op.drop_constraint(
        "uq_project_score_per_criterion_team_student",
        "project_assessment_scores",
        type_="unique",
    )

    # Recreate old constraint
    op.create_unique_constraint(
        "uq_project_score_per_criterion_team",
        "project_assessment_scores",
        ["assessment_id", "criterion_id", "team_number"],
    )

    # Drop index
    op.drop_index("ix_project_score_student", "project_assessment_scores")

    # Drop foreign key
    op.drop_constraint(
        "fk_project_score_student", "project_assessment_scores", type_="foreignkey"
    )

    # Drop student_id column
    op.drop_column("project_assessment_scores", "student_id")

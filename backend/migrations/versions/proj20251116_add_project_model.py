"""add_project_model

Revision ID: proj20251116
Revises: mt_20251112_01, xyz789
Create Date: 2025-11-16 10:30:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "proj20251116"
down_revision = ("mt_20251112_01", "xyz789")  # Merge two heads
branch_labels = None
depends_on = None


def upgrade():
    # Create projects table
    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("class_name", sa.String(length=50), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="concept"),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_school", "projects", ["school_id"], unique=False)
    op.create_index("ix_project_course", "projects", ["course_id"], unique=False)
    op.create_index("ix_project_status", "projects", ["status"], unique=False)
    op.create_index(
        "ix_project_school_course", "projects", ["school_id", "course_id"], unique=False
    )
    op.create_index(op.f("ix_projects_id"), "projects", ["id"], unique=False)

    # Add project_id to evaluations table
    op.add_column(
        "evaluations",
        sa.Column("project_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        "ix_eval_project", "evaluations", ["project_id"], unique=False
    )
    op.create_foreign_key(
        "fk_evaluations_project_id_projects",
        "evaluations",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Add project_id to project_notes_contexts table
    op.add_column(
        "project_notes_contexts",
        sa.Column("project_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_project_notes_contexts_project_id_projects",
        "project_notes_contexts",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_project_notes_contexts_project_id"),
        "project_notes_contexts",
        ["project_id"],
        unique=False,
    )

    # Update client_project_links to link to projects instead of project_assessments
    # Step 1: Add new project_id column
    op.add_column(
        "client_project_links",
        sa.Column("project_id", sa.Integer(), nullable=True),
    )
    
    # Step 2: Drop old constraints and indexes
    op.drop_constraint(
        "uq_client_project_once", "client_project_links", type_="unique"
    )
    op.drop_index("ix_client_project_project", table_name="client_project_links")
    op.drop_constraint(
        "client_project_links_project_assessment_id_fkey",
        "client_project_links",
        type_="foreignkey",
    )
    
    # Step 3: Drop old column (data migration would happen here if needed)
    op.drop_column("client_project_links", "project_assessment_id")
    
    # Step 4: Make project_id non-nullable now that old column is gone
    op.alter_column(
        "client_project_links",
        "project_id",
        nullable=False,
    )
    
    # Step 5: Add new constraints and indexes
    op.create_foreign_key(
        "fk_client_project_links_project_id_projects",
        "client_project_links",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_client_project_once",
        "client_project_links",
        ["client_id", "project_id"],
    )
    op.create_index(
        "ix_client_project_project", "client_project_links", ["project_id"], unique=False
    )

    # Update start_date and end_date column types from DateTime to Date
    op.alter_column(
        "client_project_links",
        "start_date",
        type_=sa.Date(),
        existing_type=sa.DateTime(),
        nullable=True,
    )
    op.alter_column(
        "client_project_links",
        "end_date",
        type_=sa.Date(),
        existing_type=sa.DateTime(),
        nullable=True,
    )


def downgrade():
    # Revert client_project_links changes
    op.alter_column(
        "client_project_links",
        "start_date",
        type_=sa.DateTime(),
        existing_type=sa.Date(),
        nullable=True,
    )
    op.alter_column(
        "client_project_links",
        "end_date",
        type_=sa.DateTime(),
        existing_type=sa.DateTime(),
        nullable=True,
    )

    op.drop_index("ix_client_project_project", table_name="client_project_links")
    op.drop_constraint(
        "uq_client_project_once", "client_project_links", type_="unique"
    )
    op.drop_constraint(
        "fk_client_project_links_project_id_projects",
        "client_project_links",
        type_="foreignkey",
    )
    
    op.add_column(
        "client_project_links",
        sa.Column("project_assessment_id", sa.Integer(), nullable=True),
    )
    op.drop_column("client_project_links", "project_id")
    
    op.alter_column(
        "client_project_links",
        "project_assessment_id",
        nullable=False,
    )
    
    op.create_foreign_key(
        "client_project_links_project_assessment_id_fkey",
        "client_project_links",
        "project_assessments",
        ["project_assessment_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_client_project_once",
        "client_project_links",
        ["client_id", "project_assessment_id"],
    )
    op.create_index(
        "ix_client_project_project",
        "client_project_links",
        ["project_assessment_id"],
        unique=False,
    )

    # Remove project_id from project_notes_contexts
    op.drop_index(
        op.f("ix_project_notes_contexts_project_id"),
        table_name="project_notes_contexts",
    )
    op.drop_constraint(
        "fk_project_notes_contexts_project_id_projects",
        "project_notes_contexts",
        type_="foreignkey",
    )
    op.drop_column("project_notes_contexts", "project_id")

    # Remove project_id from evaluations
    op.drop_constraint(
        "fk_evaluations_project_id_projects", "evaluations", type_="foreignkey"
    )
    op.drop_index("ix_eval_project", table_name="evaluations")
    op.drop_column("evaluations", "project_id")

    # Drop projects table
    op.drop_index(op.f("ix_projects_id"), table_name="projects")
    op.drop_index("ix_project_school_course", table_name="projects")
    op.drop_index("ix_project_status", table_name="projects")
    op.drop_index("ix_project_course", table_name="projects")
    op.drop_index("ix_project_school", table_name="projects")
    op.drop_table("projects")

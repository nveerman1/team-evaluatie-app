"""add tasks table

Revision ID: task_20250104_01
Revises: xyz789abc012
Create Date: 2025-01-04 22:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "task_20250104_01"
down_revision = "xyz789abc012"
branch_labels = None
depends_on = None


def upgrade():
    # Create tasks table
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="open"),
        sa.Column("type", sa.String(length=30), nullable=False, server_default="opdrachtgever"),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("client_id", sa.Integer(), nullable=True),
        sa.Column("class_id", sa.Integer(), nullable=True),
        sa.Column("auto_generated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("source", sa.String(length=50), nullable=False, server_default="manual"),
        sa.Column("email_to", sa.String(length=500), nullable=True),
        sa.Column("email_cc", sa.String(length=500), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    
    # Create indexes
    op.create_index(op.f("ix_tasks_id"), "tasks", ["id"], unique=False)
    op.create_index(op.f("ix_tasks_school_id"), "tasks", ["school_id"], unique=False)
    op.create_index("ix_task_school", "tasks", ["school_id"], unique=False)
    op.create_index("ix_task_due_date", "tasks", ["due_date"], unique=False)
    op.create_index("ix_task_status", "tasks", ["status"], unique=False)
    op.create_index("ix_task_project", "tasks", ["project_id"], unique=False)
    op.create_index("ix_task_client", "tasks", ["client_id"], unique=False)
    op.create_index("ix_task_school_status", "tasks", ["school_id", "status"], unique=False)
    op.create_index("ix_task_auto_generated", "tasks", ["auto_generated"], unique=False)


def downgrade():
    # Drop indexes
    op.drop_index("ix_task_auto_generated", table_name="tasks")
    op.drop_index("ix_task_school_status", table_name="tasks")
    op.drop_index("ix_task_client", table_name="tasks")
    op.drop_index("ix_task_project", table_name="tasks")
    op.drop_index("ix_task_status", table_name="tasks")
    op.drop_index("ix_task_due_date", table_name="tasks")
    op.drop_index("ix_task_school", table_name="tasks")
    op.drop_index(op.f("ix_tasks_school_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_id"), table_name="tasks")
    
    # Drop table
    op.drop_table("tasks")

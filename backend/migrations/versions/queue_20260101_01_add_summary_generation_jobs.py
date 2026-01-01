"""Add summary generation jobs table

Revision ID: queue_20260101_01
Revises: aaa111bbb222
Create Date: 2026-01-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'queue_20260101_01'
down_revision: Union[str, None] = 'aaa111bbb222'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create summary_generation_jobs table
    op.create_table(
        'summary_generation_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('evaluation_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.String(length=200), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['evaluation_id'], ['evaluations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id')
    )
    
    # Create indexes
    op.create_index('ix_summary_generation_jobs_id', 'summary_generation_jobs', ['id'])
    op.create_index('ix_summary_generation_jobs_school_id', 'summary_generation_jobs', ['school_id'])
    op.create_index('ix_summary_generation_jobs_job_id', 'summary_generation_jobs', ['job_id'])
    op.create_index('ix_summary_job_status', 'summary_generation_jobs', ['status'])
    op.create_index('ix_summary_job_eval_student', 'summary_generation_jobs', ['evaluation_id', 'student_id'])
    op.create_index('ix_summary_job_created', 'summary_generation_jobs', ['created_at'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_summary_job_created', table_name='summary_generation_jobs')
    op.drop_index('ix_summary_job_eval_student', table_name='summary_generation_jobs')
    op.drop_index('ix_summary_job_status', table_name='summary_generation_jobs')
    op.drop_index('ix_summary_generation_jobs_job_id', table_name='summary_generation_jobs')
    op.drop_index('ix_summary_generation_jobs_school_id', table_name='summary_generation_jobs')
    op.drop_index('ix_summary_generation_jobs_id', table_name='summary_generation_jobs')
    
    # Drop table
    op.drop_table('summary_generation_jobs')

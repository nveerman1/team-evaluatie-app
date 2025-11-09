"""add_feedback_summary_table

Revision ID: aaa111bbb222
Revises: xyz789abc012
Create Date: 2025-11-08 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'aaa111bbb222'
down_revision = 'xyz789abc012'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'feedback_summaries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('evaluation_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('summary_text', sa.Text(), nullable=False),
        sa.Column('feedback_hash', sa.String(length=64), nullable=False),
        sa.Column('generation_method', sa.String(length=20), nullable=False),
        sa.Column('generation_duration_ms', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['evaluation_id'], ['evaluations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('evaluation_id', 'student_id', name='uq_summary_per_student_eval')
    )
    op.create_index('ix_feedback_summary_eval', 'feedback_summaries', ['evaluation_id'], unique=False)
    op.create_index('ix_feedback_summary_hash', 'feedback_summaries', ['feedback_hash'], unique=False)
    op.create_index(op.f('ix_feedback_summaries_id'), 'feedback_summaries', ['id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_feedback_summaries_id'), table_name='feedback_summaries')
    op.drop_index('ix_feedback_summary_hash', table_name='feedback_summaries')
    op.drop_index('ix_feedback_summary_eval', table_name='feedback_summaries')
    op.drop_table('feedback_summaries')

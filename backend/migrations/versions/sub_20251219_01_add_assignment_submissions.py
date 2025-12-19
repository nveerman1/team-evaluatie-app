"""add assignment submissions and events tables

Revision ID: sub_20251219_01
Revises: rc_20251212_backfill
Create Date: 2025-12-19 13:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'sub_20251219_01'
down_revision = 'rc_20251212_backfill'
branch_labels = None
depends_on = None


def upgrade():
    # Create assignment_submissions table
    op.create_table(
        'assignment_submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('project_assessment_id', sa.Integer(), nullable=False),
        sa.Column('project_team_id', sa.Integer(), nullable=False),
        sa.Column('doc_type', sa.String(length=20), nullable=False),
        sa.Column('url', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False, server_default='missing'),
        sa.Column('version_label', sa.String(length=50), nullable=True),
        sa.Column('submitted_by_user_id', sa.Integer(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_checked_by_user_id', sa.Integer(), nullable=True),
        sa.Column('last_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_assessment_id'], ['project_assessments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_team_id'], ['project_teams.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['submitted_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['last_checked_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("doc_type IN ('report', 'slides', 'attachment')", name='check_doc_type'),
        sa.CheckConstraint("status IN ('missing', 'submitted', 'ok', 'access_requested', 'broken')", name='check_status'),
        sa.UniqueConstraint('project_assessment_id', 'project_team_id', 'doc_type', 'version_label', 
                          name='uq_submission_per_assessment_team_doctype_version')
    )
    
    # Create indices for performance
    op.create_index('ix_submissions_assessment', 'assignment_submissions', ['project_assessment_id'])
    op.create_index('ix_submissions_team', 'assignment_submissions', ['project_team_id'])
    op.create_index('ix_submissions_status', 'assignment_submissions', ['project_assessment_id', 'status'])
    op.create_index('ix_submissions_school', 'assignment_submissions', ['school_id'])
    
    # Create submission_events table for audit trail
    op.create_table(
        'submission_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), nullable=False),
        sa.Column('actor_user_id', sa.Integer(), nullable=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['submission_id'], ['assignment_submissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("event_type IN ('submitted', 'status_changed', 'cleared', 'opened', 'commented')", 
                          name='check_event_type')
    )
    
    # Create indices for submission_events
    op.create_index('ix_submission_events_submission', 'submission_events', ['submission_id'])
    op.create_index('ix_submission_events_created', 'submission_events', ['created_at'], postgresql_ops={'created_at': 'DESC'})
    op.create_index('ix_submission_events_school', 'submission_events', ['school_id'])


def downgrade():
    # Drop indices for submission_events
    op.drop_index('ix_submission_events_school', table_name='submission_events')
    op.drop_index('ix_submission_events_created', table_name='submission_events')
    op.drop_index('ix_submission_events_submission', table_name='submission_events')
    
    # Drop submission_events table
    op.drop_table('submission_events')
    
    # Drop indices for assignment_submissions
    op.drop_index('ix_submissions_school', table_name='assignment_submissions')
    op.drop_index('ix_submissions_status', table_name='assignment_submissions')
    op.drop_index('ix_submissions_team', table_name='assignment_submissions')
    op.drop_index('ix_submissions_assessment', table_name='assignment_submissions')
    
    # Drop assignment_submissions table
    op.drop_table('assignment_submissions')

"""Drop legacy groups and group_members tables

Revision ID: 20260119_drop_legacy
Revises: pa_20260119_01
Create Date: 2026-01-19

Phase 5: Drop legacy tables after completing migration to CourseEnrollment and ProjectTeam
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260119_drop_legacy'
down_revision = "pa_20260119_01"  # Set this to the latest migration ID
branch_labels = None
depends_on = None


def upgrade():
    """Drop legacy group_members and groups tables"""
    # First, drop foreign key constraints from other tables that reference groups
    
    # Drop FK from project_teams.team_id -> groups.id
    op.drop_constraint('project_teams_team_id_fkey', 'project_teams', type_='foreignkey')
    
    # Drop FK from project_notes.team_id -> groups.id
    op.drop_constraint('project_notes_team_id_fkey', 'project_notes', type_='foreignkey')
    
    # Drop FK from project_team_externals.group_id -> groups.id
    op.drop_constraint('project_team_externals_group_id_fkey', 'project_team_externals', type_='foreignkey')
    
    # Now drop the tables themselves
    # Drop group_members table first (has FK to groups)
    op.drop_table('group_members')
    
    # Drop groups table
    op.drop_table('groups')


def downgrade():
    """Recreate tables if needed (not recommended - data will be lost)"""
    # Note: This downgrade is provided for safety but should not be used
    # as data will be lost. The modern architecture uses CourseEnrollment
    # and ProjectTeam instead.
    
    # Recreate groups table
    op.create_table(
        'groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('team_number', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Recreate group_members table
    op.create_table(
        'group_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_in_team', sa.String(length=50), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('group_id', 'user_id', name='uq_group_member')
    )
    
    # Recreate foreign key constraints
    op.create_foreign_key(
        'project_teams_team_id_fkey', 'project_teams', 'groups',
        ['team_id'], ['id'], ondelete='SET NULL'
    )
    op.create_foreign_key(
        'project_notes_team_id_fkey', 'project_notes', 'groups',
        ['team_id'], ['id'], ondelete='CASCADE'
    )
    op.create_foreign_key(
        'project_team_externals_group_id_fkey', 'project_team_externals', 'groups',
        ['group_id'], ['id'], ondelete='CASCADE'
    )

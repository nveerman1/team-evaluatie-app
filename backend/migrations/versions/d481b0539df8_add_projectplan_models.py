"""add_projectplan_models

Revision ID: d481b0539df8
Revises: de711157475c
Create Date: 2026-02-01 22:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'd481b0539df8'
down_revision = 'de711157475c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create ProjectPlan tables following the ProjectAssessment pattern.
    
    Architecture:
    - ProjectPlan: One per project (the component/template)
    - ProjectPlanTeam: One per team in the project (the instance)
    - ProjectPlanSection: 8 sections per team
    """
    
    # Create project_plans table
    op.create_table(
        'project_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('version', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_plan_project_id', 'project_plans', ['project_id'], unique=False)
    op.create_index('ix_project_plan_school', 'project_plans', ['school_id'], unique=False)
    op.create_index(op.f('ix_project_plans_id'), 'project_plans', ['id'], unique=False)
    op.create_index(op.f('ix_project_plans_school_id'), 'project_plans', ['school_id'], unique=False)
    
    # Create project_plan_teams table
    op.create_table(
        'project_plan_teams',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('project_plan_id', sa.Integer(), nullable=False),
        sa.Column('project_team_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('locked', sa.Boolean(), nullable=False),
        sa.Column('global_teacher_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_plan_id'], ['project_plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_team_id'], ['project_teams.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_plan_id', 'project_team_id', name='uq_project_plan_team')
    )
    op.create_index('ix_ppt_project_plan', 'project_plan_teams', ['project_plan_id'], unique=False)
    op.create_index('ix_ppt_project_team', 'project_plan_teams', ['project_team_id'], unique=False)
    op.create_index('ix_ppt_status', 'project_plan_teams', ['status'], unique=False)
    op.create_index(op.f('ix_project_plan_teams_id'), 'project_plan_teams', ['id'], unique=False)
    op.create_index(op.f('ix_project_plan_teams_school_id'), 'project_plan_teams', ['school_id'], unique=False)
    
    # Create project_plan_sections table
    op.create_table(
        'project_plan_sections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('project_plan_team_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('client_organisation', sa.String(length=200), nullable=True),
        sa.Column('client_contact', sa.String(length=200), nullable=True),
        sa.Column('client_email', sa.String(length=320), nullable=True),
        sa.Column('client_phone', sa.String(length=50), nullable=True),
        sa.Column('client_description', sa.Text(), nullable=True),
        sa.Column('teacher_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_plan_team_id'], ['project_plan_teams.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('project_plan_team_id', 'key', name='uq_project_plan_team_section_key')
    )
    op.create_index('ix_pps_project_plan_team', 'project_plan_sections', ['project_plan_team_id'], unique=False)
    op.create_index('ix_pps_key', 'project_plan_sections', ['key'], unique=False)
    op.create_index('ix_pps_status', 'project_plan_sections', ['status'], unique=False)
    op.create_index(op.f('ix_project_plan_sections_id'), 'project_plan_sections', ['id'], unique=False)
    op.create_index(op.f('ix_project_plan_sections_school_id'), 'project_plan_sections', ['school_id'], unique=False)


def downgrade() -> None:
    """Drop ProjectPlan tables in reverse order."""
    op.drop_index(op.f('ix_project_plan_sections_school_id'), table_name='project_plan_sections')
    op.drop_index(op.f('ix_project_plan_sections_id'), table_name='project_plan_sections')
    op.drop_index('ix_pps_status', table_name='project_plan_sections')
    op.drop_index('ix_pps_key', table_name='project_plan_sections')
    op.drop_index('ix_pps_project_plan_team', table_name='project_plan_sections')
    op.drop_table('project_plan_sections')
    
    op.drop_index(op.f('ix_project_plan_teams_school_id'), table_name='project_plan_teams')
    op.drop_index(op.f('ix_project_plan_teams_id'), table_name='project_plan_teams')
    op.drop_index('ix_ppt_status', table_name='project_plan_teams')
    op.drop_index('ix_ppt_project_team', table_name='project_plan_teams')
    op.drop_index('ix_ppt_project_plan', table_name='project_plan_teams')
    op.drop_table('project_plan_teams')
    
    op.drop_index(op.f('ix_project_plans_school_id'), table_name='project_plans')
    op.drop_index(op.f('ix_project_plans_id'), table_name='project_plans')
    op.drop_index('ix_project_plan_school', table_name='project_plans')
    op.drop_index('ix_project_plan_project_id', table_name='project_plans')
    op.drop_table('project_plans')

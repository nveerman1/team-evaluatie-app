"""add_skill_training_tables

Revision ID: e8a9b2c3d4f5
Revises: ca4111bca819
Create Date: 2026-02-17 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'e8a9b2c3d4f5'
down_revision = 'ca4111bca819'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add skill_trainings and skill_training_progress tables.
    
    These tables support the Vaardigheidstrainingen feature:
    - skill_trainings: Training definitions linked to competency categories
    - skill_training_progress: Student progress tracking per training
    """
    
    # Create skill_trainings table
    op.create_table(
        'skill_trainings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('url', sa.String(length=500), nullable=False),
        sa.Column('competency_category_id', sa.Integer(), nullable=False),
        sa.Column('learning_objective_id', sa.Integer(), nullable=True),
        sa.Column('level', sa.String(length=20), nullable=True),
        sa.Column('est_minutes', sa.String(length=30), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['competency_category_id'], ['competency_categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['learning_objective_id'], ['learning_objectives.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_skill_training_category', 'skill_trainings', ['competency_category_id'], unique=False)
    op.create_index('ix_skill_training_school', 'skill_trainings', ['school_id'], unique=False)
    op.create_index('ix_skill_training_school_active', 'skill_trainings', ['school_id', 'is_active'], unique=False)
    op.create_index(op.f('ix_skill_trainings_id'), 'skill_trainings', ['id'], unique=False)
    op.create_index(op.f('ix_skill_trainings_competency_category_id'), 'skill_trainings', ['competency_category_id'], unique=False)
    op.create_index(op.f('ix_skill_trainings_learning_objective_id'), 'skill_trainings', ['learning_objective_id'], unique=False)
    op.create_index(op.f('ix_skill_trainings_school_id'), 'skill_trainings', ['school_id'], unique=False)
    
    # Create skill_training_progress table
    op.create_table(
        'skill_training_progress',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('training_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='none'),
        sa.Column('updated_by_user_id', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['training_id'], ['skill_trainings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['updated_by_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'training_id', 'course_id', name='uq_skill_progress_student_training_course')
    )
    op.create_index('ix_skill_progress_course', 'skill_training_progress', ['course_id'], unique=False)
    op.create_index('ix_skill_progress_course_training', 'skill_training_progress', ['course_id', 'training_id'], unique=False)
    op.create_index('ix_skill_progress_student', 'skill_training_progress', ['student_id'], unique=False)
    op.create_index('ix_skill_progress_training', 'skill_training_progress', ['training_id'], unique=False)
    op.create_index(op.f('ix_skill_training_progress_id'), 'skill_training_progress', ['id'], unique=False)
    op.create_index(op.f('ix_skill_training_progress_course_id'), 'skill_training_progress', ['course_id'], unique=False)
    op.create_index(op.f('ix_skill_training_progress_school_id'), 'skill_training_progress', ['school_id'], unique=False)
    op.create_index(op.f('ix_skill_training_progress_student_id'), 'skill_training_progress', ['student_id'], unique=False)
    op.create_index(op.f('ix_skill_training_progress_training_id'), 'skill_training_progress', ['training_id'], unique=False)


def downgrade() -> None:
    """
    Remove skill training tables.
    """
    op.drop_index(op.f('ix_skill_training_progress_training_id'), table_name='skill_training_progress')
    op.drop_index(op.f('ix_skill_training_progress_student_id'), table_name='skill_training_progress')
    op.drop_index(op.f('ix_skill_training_progress_school_id'), table_name='skill_training_progress')
    op.drop_index(op.f('ix_skill_training_progress_course_id'), table_name='skill_training_progress')
    op.drop_index(op.f('ix_skill_training_progress_id'), table_name='skill_training_progress')
    op.drop_index('ix_skill_progress_training', table_name='skill_training_progress')
    op.drop_index('ix_skill_progress_student', table_name='skill_training_progress')
    op.drop_index('ix_skill_progress_course_training', table_name='skill_training_progress')
    op.drop_index('ix_skill_progress_course', table_name='skill_training_progress')
    op.drop_table('skill_training_progress')
    
    op.drop_index(op.f('ix_skill_trainings_school_id'), table_name='skill_trainings')
    op.drop_index(op.f('ix_skill_trainings_learning_objective_id'), table_name='skill_trainings')
    op.drop_index(op.f('ix_skill_trainings_competency_category_id'), table_name='skill_trainings')
    op.drop_index(op.f('ix_skill_trainings_id'), table_name='skill_trainings')
    op.drop_index('ix_skill_training_school_active', table_name='skill_trainings')
    op.drop_index('ix_skill_training_school', table_name='skill_trainings')
    op.drop_index('ix_skill_training_category', table_name='skill_trainings')
    op.drop_table('skill_trainings')

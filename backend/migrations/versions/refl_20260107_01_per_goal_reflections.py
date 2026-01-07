"""per goal reflections

Revision ID: refl_20260107_01
Revises: task_20250104_01
Create Date: 2026-01-07 08:30:00.000000

Changes the competency_reflections table to allow multiple reflections per window,
one for each learning goal. Removes the window+user unique constraint and adds
a window+user+goal unique constraint instead.
"""

from alembic import op
import sqlalchemy as sa

revision = "refl_20260107_01"
down_revision = "task_20250104_01"
branch_labels = None
depends_on = None


def upgrade():
    # Drop the old unique constraint that allowed only one reflection per window+user
    op.drop_constraint(
        "uq_competency_reflection_once",
        "competency_reflections",
        type_="unique"
    )
    
    # Add new unique constraint: one reflection per window+user+goal
    # This allows multiple reflections per window (one per goal)
    op.create_unique_constraint(
        "uq_competency_reflection_per_goal",
        "competency_reflections",
        ["window_id", "user_id", "goal_id"]
    )
    
    # Make goal_id NOT NULL since reflections must now be tied to specific goals
    # First, update any existing reflections with NULL goal_id
    # We'll set them to reference the first goal for that user/window if one exists
    op.execute("""
        UPDATE competency_reflections r
        SET goal_id = (
            SELECT g.id 
            FROM competency_goals g 
            WHERE g.window_id = r.window_id 
            AND g.user_id = r.user_id 
            ORDER BY g.created_at ASC 
            LIMIT 1
        )
        WHERE r.goal_id IS NULL
        AND EXISTS (
            SELECT 1 
            FROM competency_goals g 
            WHERE g.window_id = r.window_id 
            AND g.user_id = r.user_id
        )
    """)
    
    # Delete any reflections that still have NULL goal_id (users with no goals)
    op.execute("""
        DELETE FROM competency_reflections
        WHERE goal_id IS NULL
    """)
    
    # Now make goal_id NOT NULL
    op.alter_column(
        "competency_reflections",
        "goal_id",
        existing_type=sa.Integer(),
        nullable=False
    )


def downgrade():
    # Make goal_id nullable again
    op.alter_column(
        "competency_reflections",
        "goal_id",
        existing_type=sa.Integer(),
        nullable=True
    )
    
    # Drop the per-goal unique constraint
    op.drop_constraint(
        "uq_competency_reflection_per_goal",
        "competency_reflections",
        type_="unique"
    )
    
    # Restore the old constraint (one reflection per window+user)
    # Note: This will fail if there are multiple reflections per window+user
    # In a downgrade scenario, you would need to manually consolidate reflections
    op.create_unique_constraint(
        "uq_competency_reflection_once",
        "competency_reflections",
        ["window_id", "user_id"]
    )

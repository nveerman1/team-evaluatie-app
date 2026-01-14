"""add notifications table

Revision ID: notif_20251219_01
Revises: sub_20251219_01
Create Date: 2025-12-19 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'notif_20251219_01'
down_revision = 'sub_20251219_01'
branch_labels = None
depends_on = None


def upgrade():
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('school_id', sa.Integer(), nullable=False),
        sa.Column('recipient_user_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('link', sa.String(length=500), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recipient_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # Create indices
    op.create_index('ix_notifications_recipient', 'notifications', ['recipient_user_id', 'read_at'])
    op.create_index('ix_notifications_school', 'notifications', ['school_id'])
    op.create_index('ix_notifications_created', 'notifications', ['created_at'], postgresql_ops={'created_at': 'DESC'})


def downgrade():
    # Drop indices
    op.drop_index('ix_notifications_created', table_name='notifications')
    op.drop_index('ix_notifications_school', table_name='notifications')
    op.drop_index('ix_notifications_recipient', table_name='notifications')
    
    # Drop table
    op.drop_table('notifications')

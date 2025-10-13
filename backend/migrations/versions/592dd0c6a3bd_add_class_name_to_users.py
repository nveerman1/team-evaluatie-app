from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "add_class_name_to_users"
down_revision = "f808a90e007e"  # laat Alembic dit zelf invullen
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("class_name", sa.String(length=50), nullable=True))
    op.create_index("ix_users_class_name", "users", ["class_name"])


def downgrade():
    op.drop_index("ix_users_class_name", table_name="users")
    op.drop_column("users", "class_name")

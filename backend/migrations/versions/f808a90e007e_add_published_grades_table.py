from alembic import op
import sqlalchemy as sa

revision = "f808a90e007e"
down_revision = "70278d654e6f"


def upgrade():
    op.create_table(
        "published_grades",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("school_id", sa.Integer, nullable=False, index=True),
        sa.Column(
            "created_at", sa.DateTime, server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at",
            sa.DateTime,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "evaluation_id",
            sa.Integer,
            sa.ForeignKey("evaluations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("grade", sa.Float, nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("meta", sa.JSON, nullable=False, server_default=sa.text("'{}'")),
        sa.UniqueConstraint(
            "school_id", "evaluation_id", "user_id", name="uq_published_grade_once"
        ),
    )


def downgrade():
    op.drop_table("published_grades")

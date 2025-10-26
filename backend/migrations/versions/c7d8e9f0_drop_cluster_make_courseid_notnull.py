# alembic revision -m "Drop cluster cols; make course_id NOT NULL again"
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "c7d8e9f0abcd"
down_revision = "b2c3d4e5f6a7"  # <-- jouw laatste: make_course_id_nullable
branch_labels = None
depends_on = None


def upgrade():
    # 1) Veiligstellen dat er geen NULLs meer zijn (zou na SQL-migratie al kloppen)
    conn = op.get_bind()
    nulls = conn.execute(
        sa.text("SELECT COUNT(*) FROM evaluations WHERE course_id IS NULL")
    ).scalar()
    if nulls and nulls > 0:
        raise RuntimeError(
            "Nog evaluations zonder course_id. Draai eerst migrate_clusters_to_courses.sql"
        )

    # 2) course_id verplicht maken
    op.alter_column(
        "evaluations",
        "course_id",
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True,
    )

    # 3) cluster-kolommen verwijderen (team_number blijft)
    with op.batch_alter_table("users") as b:
        if "cluster" in [c["name"] for c in sa.inspect(conn).get_columns("users")]:
            b.drop_column("cluster")

    with op.batch_alter_table("evaluations") as b:
        if "cluster" in [
            c["name"] for c in sa.inspect(conn).get_columns("evaluations")
        ]:
            b.drop_column("cluster")


def downgrade():
    # Terugdraaien: cluster terug (nullable), course_id weer optioneel
    with op.batch_alter_table("users") as b:
        b.add_column(sa.Column("cluster", sa.String(length=50), nullable=True))

    with op.batch_alter_table("evaluations") as b:
        b.add_column(sa.Column("cluster", sa.String(length=50), nullable=True))

    op.alter_column(
        "evaluations",
        "course_id",
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False,
    )

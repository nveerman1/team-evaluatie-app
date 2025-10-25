"""add cluster to evaluations

Revision ID: a1b2c3d4e5f6
Revises: 10a4510f8374
Create Date: 2025-10-25 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6"
down_revision = "10a4510f8374"
branch_labels = None
depends_on = None


def upgrade():
    # 1) Kolom toevoegen als nullable (zodat we eerst kunnen backfillen)
    op.add_column(
        "evaluations",
        sa.Column("cluster", sa.String(length=50), nullable=True),
    )

    # 2) Proberen te backfillen vanuit bestaande gegevens
    #    Strategie A: als er allocations bestaan, gebruik de meest voorkomende cluster
    #                 van reviewees (of desnoods MIN) als cluster voor de evaluatie.
    #                 (werkt als allocations/users gevuld zijn)
    op.execute(
        """
        WITH cluster_per_eval AS (
            SELECT
                a.evaluation_id,
                -- meest voorkomende cluster (fallback: MIN als je mode niet wil gebruiken)
                -- mode() requires Postgres 9.4+; als je twijfelt, vervang door MIN(u.cluster)
                mode() WITHIN GROUP (ORDER BY u.cluster) AS cluster
            FROM allocations a
            JOIN users u ON u.id = a.reviewee_id
            WHERE u.cluster IS NOT NULL AND u.cluster <> ''
            GROUP BY a.evaluation_id
        )
        UPDATE evaluations e
        SET cluster = c.cluster
        FROM cluster_per_eval c
        WHERE c.evaluation_id = e.id
          AND e.cluster IS NULL
        """
    )

    # 3) Eventueel extra fallback: als er geen allocations zijn,
    #    en je had een "course_id" met een impliciete 1:1 relatie met een cluster,
    #    kun je hier aanvullende logica plaatsen om te backfillen.
    #    Standaard doen we niets; dan blijft cluster NULL en zetten we hieronder een placeholder.

    # 4) Zet eventuele NULLs naar een placeholder om NOT NULL te halen
    op.execute(
        """
        UPDATE evaluations
        SET cluster = '__MISSING__'
        WHERE cluster IS NULL OR cluster = ''
        """
    )

    # 5) NOT NULL en (optioneel) CHECK constraint zodat lege strings niet meer kunnen
    op.alter_column(
        "evaluations", "cluster", existing_type=sa.String(length=50), nullable=False
    )
    op.create_check_constraint(
        "ck_evaluations_cluster_nonempty", "evaluations", "cluster <> ''"
    )

    # 6) Handige index voor filtering/lijsten per school & cluster
    op.create_index(
        "ix_evaluations_school_cluster",
        "evaluations",
        ["school_id", "cluster"],
        unique=False,
    )


def downgrade():
    # Downgrade: index en constraint weg, kolom droppen
    op.drop_index("ix_evaluations_school_cluster", table_name="evaluations")
    op.drop_constraint("ck_evaluations_cluster_nonempty", "evaluations", type_="check")
    op.drop_column("evaluations", "cluster")

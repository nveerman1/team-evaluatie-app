"""add_school_management_architecture

This migration implements the new school management architecture with:
- AcademicYear: represents school years (e.g., "2025-2026")
- Class: fixed classes per academic year (e.g., "G2a")
- StudentClassMembership: links students to one class per academic year
- CourseEnrollment: links students to multiple courses
- Updates Course to include academic_year_id
- Updates Project to include period (P1-P4)

Revision ID: eb7ab5c90a35
Revises: rc_20251212_backfill
Create Date: 2025-12-17 12:51:56.539838

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "eb7ab5c90a35"
down_revision: Union[str, None] = "rc_20251212_backfill"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ========== 1. Create academic_years table ==========
    op.create_table(
        "academic_years",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=50), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_academic_years_id", "academic_years", ["id"])
    op.create_index("ix_academic_year_school", "academic_years", ["school_id"])
    op.create_unique_constraint(
        "uq_academic_year_label_per_school", "academic_years", ["school_id", "label"]
    )

    # ========== 2. Create classes table ==========
    op.create_table(
        "classes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("academic_year_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["academic_year_id"], ["academic_years.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_classes_id", "classes", ["id"])
    op.create_index("ix_class_school", "classes", ["school_id"])
    op.create_index("ix_class_academic_year", "classes", ["academic_year_id"])
    op.create_unique_constraint(
        "uq_class_name_per_year", "classes", ["school_id", "academic_year_id", "name"]
    )

    # ========== 3. Create student_class_memberships table ==========
    op.create_table(
        "student_class_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("academic_year_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["academic_year_id"], ["academic_years.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_student_class_memberships_id", "student_class_memberships", ["id"]
    )
    op.create_index(
        "ix_student_class_membership_student",
        "student_class_memberships",
        ["student_id"],
    )
    op.create_index(
        "ix_student_class_membership_class", "student_class_memberships", ["class_id"]
    )
    op.create_index(
        "ix_student_class_membership_academic_year",
        "student_class_memberships",
        ["academic_year_id"],
    )
    op.create_unique_constraint(
        "uq_student_one_class_per_year",
        "student_class_memberships",
        ["student_id", "academic_year_id"],
    )

    # ========== 4. Create course_enrollments table ==========
    op.create_table(
        "course_enrollments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column(
            "active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["student_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index("ix_course_enrollments_id", "course_enrollments", ["id"])
    op.create_index("ix_course_enrollment_course", "course_enrollments", ["course_id"])
    op.create_index(
        "ix_course_enrollment_student", "course_enrollments", ["student_id"]
    )
    op.create_unique_constraint(
        "uq_course_enrollment_once", "course_enrollments", ["course_id", "student_id"]
    )

    # ========== 5. Add academic_year_id to courses ==========
    op.add_column(
        "courses",
        sa.Column("academic_year_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_courses_academic_year_id",
        "courses",
        "academic_years",
        ["academic_year_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_index("ix_course_academic_year", "courses", ["academic_year_id"])

    # ========== 6. Add period to projects ==========
    op.add_column(
        "projects",
        sa.Column("period", sa.String(length=10), nullable=True),
    )

    op.create_index("ix_project_course_period", "projects", ["course_id", "period"])

    # ========== 7. Data Migration ==========
    # Create default academic years for each school based on existing course years

    # Get all distinct school_id, year combinations from courses
    conn.execute(
        text(
            """
        INSERT INTO academic_years (school_id, label, start_date, end_date, created_at, updated_at)
        SELECT DISTINCT
            c.school_id,
            CASE 
                WHEN c.year IS NOT NULL THEN c.year::text || '-' || (c.year + 1)::text
                ELSE '2024-2025'
            END as label,
            CASE 
                WHEN c.year IS NOT NULL THEN (c.year::text || '-09-01')::date
                ELSE '2024-09-01'::date
            END as start_date,
            CASE 
                WHEN c.year IS NOT NULL THEN ((c.year + 1)::text || '-08-31')::date
                ELSE '2025-08-31'::date
            END as end_date,
            now() as created_at,
            now() as updated_at
        FROM courses c
        WHERE NOT EXISTS (
            SELECT 1 FROM academic_years ay 
            WHERE ay.school_id = c.school_id
        )
        ON CONFLICT (school_id, label) DO NOTHING
    """
        )
    )

    # Also ensure every school has at least the default 2024-2025 academic year
    conn.execute(
        text(
            """
        INSERT INTO academic_years (school_id, label, start_date, end_date, created_at, updated_at)
        SELECT 
            s.id,
            '2024-2025' as label,
            '2024-09-01'::date as start_date,
            '2025-08-31'::date as end_date,
            now() as created_at,
            now() as updated_at
        FROM schools s
        WHERE NOT EXISTS (
            SELECT 1 FROM academic_years ay 
            WHERE ay.school_id = s.id
        )
        ON CONFLICT (school_id, label) DO NOTHING
    """
        )
    )

    # Link courses to academic years based on their year field
    conn.execute(
        text(
            """
        UPDATE courses c
        SET academic_year_id = ay.id
        FROM academic_years ay
        WHERE c.school_id = ay.school_id
          AND c.academic_year_id IS NULL
          AND (
              (c.year IS NOT NULL AND ay.label = c.year::text || '-' || (c.year + 1)::text)
              OR (c.year IS NULL AND ay.label = '2024-2025')
          )
    """
        )
    )

    # Migrate existing User.class_name to Class + StudentClassMembership
    # First, create classes from distinct class_name values
    conn.execute(
        text(
            """
        INSERT INTO classes (school_id, academic_year_id, name, created_at, updated_at)
        SELECT DISTINCT
            u.school_id,
            ay.id as academic_year_id,
            u.class_name,
            now() as created_at,
            now() as updated_at
        FROM users u
        CROSS JOIN LATERAL (
            SELECT id FROM academic_years 
            WHERE school_id = u.school_id 
            ORDER BY start_date DESC 
            LIMIT 1
        ) ay
        WHERE u.class_name IS NOT NULL 
          AND u.class_name != ''
          AND u.role = 'student'
        ON CONFLICT (school_id, academic_year_id, name) DO NOTHING
    """
        )
    )

    # Create student class memberships
    conn.execute(
        text(
            """
        INSERT INTO student_class_memberships (student_id, class_id, academic_year_id, created_at, updated_at)
        SELECT DISTINCT
            u.id as student_id,
            c.id as class_id,
            c.academic_year_id,
            now() as created_at,
            now() as updated_at
        FROM users u
        JOIN classes c ON c.school_id = u.school_id AND c.name = u.class_name
        WHERE u.class_name IS NOT NULL 
          AND u.class_name != ''
          AND u.role = 'student'
        ON CONFLICT (student_id, academic_year_id) DO NOTHING
    """
        )
    )

    # Migrate existing group memberships to course enrollments
    # This creates enrollments based on group_members -> groups -> courses
    conn.execute(
        text(
            """
        INSERT INTO course_enrollments (course_id, student_id, active, created_at, updated_at)
        SELECT DISTINCT
            g.course_id,
            gm.user_id as student_id,
            gm.active,
            now() as created_at,
            now() as updated_at
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE g.course_id IS NOT NULL
          AND gm.active IS true
        ON CONFLICT (course_id, student_id) DO NOTHING
    """
        )
    )


def downgrade() -> None:
    # Drop indexes and constraints in reverse order
    op.drop_index("ix_project_course_period", table_name="projects")
    op.drop_column("projects", "period")

    op.drop_index("ix_course_academic_year", table_name="courses")
    op.drop_constraint("fk_courses_academic_year_id", "courses", type_="foreignkey")
    op.drop_column("courses", "academic_year_id")

    op.drop_constraint(
        "uq_course_enrollment_once", "course_enrollments", type_="unique"
    )
    op.drop_index("ix_course_enrollment_student", table_name="course_enrollments")
    op.drop_index("ix_course_enrollment_course", table_name="course_enrollments")
    op.drop_index("ix_course_enrollments_id", table_name="course_enrollments")
    op.drop_table("course_enrollments")

    op.drop_constraint(
        "uq_student_one_class_per_year", "student_class_memberships", type_="unique"
    )
    op.drop_index(
        "ix_student_class_membership_academic_year",
        table_name="student_class_memberships",
    )
    op.drop_index(
        "ix_student_class_membership_class", table_name="student_class_memberships"
    )
    op.drop_index(
        "ix_student_class_membership_student", table_name="student_class_memberships"
    )
    op.drop_index(
        "ix_student_class_memberships_id", table_name="student_class_memberships"
    )
    op.drop_table("student_class_memberships")

    op.drop_constraint("uq_class_name_per_year", "classes", type_="unique")
    op.drop_index("ix_class_academic_year", table_name="classes")
    op.drop_index("ix_class_school", table_name="classes")
    op.drop_index("ix_classes_id", table_name="classes")
    op.drop_table("classes")

    op.drop_constraint(
        "uq_academic_year_label_per_school", "academic_years", type_="unique"
    )
    op.drop_index("ix_academic_year_school", table_name="academic_years")
    op.drop_index("ix_academic_years_id", table_name="academic_years")
    op.drop_table("academic_years")

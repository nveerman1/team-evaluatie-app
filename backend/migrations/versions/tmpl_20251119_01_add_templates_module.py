"""Add Templates module for admin template management

This migration introduces all template models for the admin Templates feature.

Changes:
- Create peer_evaluation_criterion_templates table
- Create project_rubric_templates table
- Create project_rubric_criterion_templates table
- Create competency_templates table
- Create competency_level_descriptor_templates table
- Create competency_reflection_question_templates table
- Create mail_templates table
- Create standard_remarks table
- Create template_tags table
- Create template_tag_links table

Revision ID: tmpl_20251119_01
Revises: subj_20251119_01
Create Date: 2025-11-19 10:30:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "tmpl_20251119_01"
down_revision: Union[str, None] = "subj_20251119_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ========== Peer Evaluation Criterion Templates ==========
    op.create_table(
        "peer_evaluation_criterion_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("omza_category", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("level_descriptors", sa.JSON(), nullable=False, server_default="{}"),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_peer_criterion_template_id",
        "peer_evaluation_criterion_templates",
        ["id"],
    )
    op.create_index(
        "ix_peer_criterion_template_school",
        "peer_evaluation_criterion_templates",
        ["school_id"],
    )
    op.create_index(
        "ix_peer_criterion_template_subject",
        "peer_evaluation_criterion_templates",
        ["subject_id"],
    )
    op.create_index(
        "ix_peer_criterion_template_category",
        "peer_evaluation_criterion_templates",
        ["omza_category"],
    )

    # ========== Project Rubric Templates ==========
    op.create_table(
        "project_rubric_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("level", sa.String(length=50), nullable=False),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_rubric_templates_id", "project_rubric_templates", ["id"])
    op.create_index(
        "ix_project_rubric_template_school", "project_rubric_templates", ["school_id"]
    )
    op.create_index(
        "ix_project_rubric_template_subject", "project_rubric_templates", ["subject_id"]
    )
    op.create_index(
        "ix_project_rubric_template_level", "project_rubric_templates", ["level"]
    )

    # ========== Project Rubric Criterion Templates ==========
    op.create_table(
        "project_rubric_criterion_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("rubric_template_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("level_descriptors", sa.JSON(), nullable=False, server_default="{}"),
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
            ["rubric_template_id"],
            ["project_rubric_templates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_project_criterion_templates_id",
        "project_rubric_criterion_templates",
        ["id"],
    )
    op.create_index(
        "ix_project_criterion_template_rubric",
        "project_rubric_criterion_templates",
        ["rubric_template_id"],
    )
    op.create_index(
        "ix_project_criterion_template_category",
        "project_rubric_criterion_templates",
        ["category"],
    )

    # ========== Competency Templates ==========
    op.create_table(
        "competency_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_competency_templates_id", "competency_templates", ["id"])
    op.create_index(
        "ix_competency_template_school", "competency_templates", ["school_id"]
    )
    op.create_index(
        "ix_competency_template_subject", "competency_templates", ["subject_id"]
    )

    # ========== Competency Level Descriptor Templates ==========
    op.create_table(
        "competency_level_descriptor_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("competency_template_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.String(length=50), nullable=False),
        sa.Column("behavior_description", sa.Text(), nullable=False),
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
            ["competency_template_id"],
            ["competency_templates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "competency_template_id",
            "level",
            name="uq_competency_level_per_template",
        ),
    )
    op.create_index(
        "ix_competency_level_descriptor_templates_id",
        "competency_level_descriptor_templates",
        ["id"],
    )
    op.create_index(
        "ix_competency_level_template_competency",
        "competency_level_descriptor_templates",
        ["competency_template_id"],
    )

    # ========== Competency Reflection Question Templates ==========
    op.create_table(
        "competency_reflection_question_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("competency_template_id", sa.Integer(), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=False),
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
            ["competency_template_id"],
            ["competency_templates.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_competency_reflection_question_templates_id",
        "competency_reflection_question_templates",
        ["id"],
    )
    op.create_index(
        "ix_competency_reflection_template_competency",
        "competency_reflection_question_templates",
        ["competency_template_id"],
    )

    # ========== Mail Templates ==========
    op.create_table(
        "mail_templates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("subject", sa.String(length=500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("variables_allowed", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mail_templates_id", "mail_templates", ["id"])
    op.create_index("ix_mail_template_school", "mail_templates", ["school_id"])
    op.create_index("ix_mail_template_subject", "mail_templates", ["subject_id"])
    op.create_index("ix_mail_template_type", "mail_templates", ["type"])
    op.create_index("ix_mail_template_active", "mail_templates", ["is_active"])

    # ========== Standard Remarks ==========
    op.create_table(
        "standard_remarks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_standard_remarks_id", "standard_remarks", ["id"])
    op.create_index("ix_standard_remark_school", "standard_remarks", ["school_id"])
    op.create_index("ix_standard_remark_subject", "standard_remarks", ["subject_id"])
    op.create_index("ix_standard_remark_type", "standard_remarks", ["type"])
    op.create_index("ix_standard_remark_category", "standard_remarks", ["category"])

    # ========== Template Tags ==========
    op.create_table(
        "template_tags",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=True),
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
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "school_id", "name", name="uq_template_tag_name_per_school"
        ),
    )
    op.create_index("ix_template_tags_id", "template_tags", ["id"])
    op.create_index("ix_template_tag_school", "template_tags", ["school_id"])
    op.create_index("ix_template_tag_subject", "template_tags", ["subject_id"])

    # ========== Template Tag Links ==========
    op.create_table(
        "template_tag_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("tag_id", sa.Integer(), nullable=False),
        sa.Column("target_type", sa.String(length=100), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["template_tags.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tag_id",
            "target_type",
            "target_id",
            name="uq_template_tag_link_once",
        ),
    )
    op.create_index("ix_template_tag_links_id", "template_tag_links", ["id"])
    op.create_index("ix_template_tag_link_tag", "template_tag_links", ["tag_id"])
    op.create_index(
        "ix_template_tag_link_target",
        "template_tag_links",
        ["target_type", "target_id"],
    )


def downgrade() -> None:
    # Drop in reverse order

    # Template Tag Links
    op.drop_index("ix_template_tag_link_target", table_name="template_tag_links")
    op.drop_index("ix_template_tag_link_tag", table_name="template_tag_links")
    op.drop_index("ix_template_tag_links_id", table_name="template_tag_links")
    op.drop_table("template_tag_links")

    # Template Tags
    op.drop_index("ix_template_tag_subject", table_name="template_tags")
    op.drop_index("ix_template_tag_school", table_name="template_tags")
    op.drop_index("ix_template_tags_id", table_name="template_tags")
    op.drop_table("template_tags")

    # Standard Remarks
    op.drop_index("ix_standard_remark_category", table_name="standard_remarks")
    op.drop_index("ix_standard_remark_type", table_name="standard_remarks")
    op.drop_index("ix_standard_remark_subject", table_name="standard_remarks")
    op.drop_index("ix_standard_remark_school", table_name="standard_remarks")
    op.drop_index("ix_standard_remarks_id", table_name="standard_remarks")
    op.drop_table("standard_remarks")

    # Mail Templates
    op.drop_index("ix_mail_template_active", table_name="mail_templates")
    op.drop_index("ix_mail_template_type", table_name="mail_templates")
    op.drop_index("ix_mail_template_subject", table_name="mail_templates")
    op.drop_index("ix_mail_template_school", table_name="mail_templates")
    op.drop_index("ix_mail_templates_id", table_name="mail_templates")
    op.drop_table("mail_templates")

    # Competency Reflection Question Templates
    op.drop_index(
        "ix_competency_reflection_template_competency",
        table_name="competency_reflection_question_templates",
    )
    op.drop_index(
        "ix_competency_reflection_question_templates_id",
        table_name="competency_reflection_question_templates",
    )
    op.drop_table("competency_reflection_question_templates")

    # Competency Level Descriptor Templates
    op.drop_index(
        "ix_competency_level_template_competency",
        table_name="competency_level_descriptor_templates",
    )
    op.drop_index(
        "ix_competency_level_descriptor_templates_id",
        table_name="competency_level_descriptor_templates",
    )
    op.drop_table("competency_level_descriptor_templates")

    # Competency Templates
    op.drop_index("ix_competency_template_subject", table_name="competency_templates")
    op.drop_index("ix_competency_template_school", table_name="competency_templates")
    op.drop_index("ix_competency_templates_id", table_name="competency_templates")
    op.drop_table("competency_templates")

    # Project Rubric Criterion Templates
    op.drop_index(
        "ix_project_criterion_template_category",
        table_name="project_rubric_criterion_templates",
    )
    op.drop_index(
        "ix_project_criterion_template_rubric",
        table_name="project_rubric_criterion_templates",
    )
    op.drop_index(
        "ix_project_criterion_templates_id",
        table_name="project_rubric_criterion_templates",
    )
    op.drop_table("project_rubric_criterion_templates")

    # Project Rubric Templates
    op.drop_index(
        "ix_project_rubric_template_level", table_name="project_rubric_templates"
    )
    op.drop_index(
        "ix_project_rubric_template_subject", table_name="project_rubric_templates"
    )
    op.drop_index(
        "ix_project_rubric_template_school", table_name="project_rubric_templates"
    )
    op.drop_index("ix_project_rubric_templates_id", table_name="project_rubric_templates")
    op.drop_table("project_rubric_templates")

    # Peer Evaluation Criterion Templates
    op.drop_index(
        "ix_peer_criterion_template_category",
        table_name="peer_evaluation_criterion_templates",
    )
    op.drop_index(
        "ix_peer_criterion_template_subject",
        table_name="peer_evaluation_criterion_templates",
    )
    op.drop_index(
        "ix_peer_criterion_template_school",
        table_name="peer_evaluation_criterion_templates",
    )
    op.drop_index(
        "ix_peer_criterion_template_id",
        table_name="peer_evaluation_criterion_templates",
    )
    op.drop_table("peer_evaluation_criterion_templates")

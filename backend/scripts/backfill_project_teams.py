"""
Backfill script for project team rosters

This script creates historical project_team and project_team_member records
for existing data in the database. It:

1. Finds all distinct (project_id, team_id) combinations from evaluations and assessments
2. Creates a project_team record for each combination
3. Populates project_team_members from existing group_members or evaluation participants
4. Links evaluations and assessments to their corresponding project_teams
5. Marks backfilled records with backfill_source='backfill' or 'inference'

Run this after applying the migration pt_20251208_01.

Usage:
    python scripts/backfill_project_teams.py
"""

import sys
import os
from datetime import datetime
from collections import defaultdict

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.infra.db.models import (
    ProjectTeam,
    ProjectTeamMember,
    Evaluation,
    ProjectAssessment,
    ProjectNotesContext,
    Group,
    GroupMember,
    Allocation,
)


def backfill_project_teams(db: Session) -> None:
    """
    Backfill project teams from existing evaluation and assessment data
    """
    print("=" * 80)
    print("BACKFILLING PROJECT TEAMS")
    print("=" * 80)

    # Track statistics
    stats = {
        "project_teams_created": 0,
        "team_members_added": 0,
        "evaluations_linked": 0,
        "assessments_linked": 0,
        "notes_linked": 0,
        "inference_count": 0,
    }

    # Dictionary to cache (project_id, team_id) -> project_team_id
    project_team_cache = {}

    # ========== Step 1: Find all distinct (project_id, group_id) from evaluations ==========
    print("\n[1/6] Finding distinct project-group combinations from evaluations...")

    # Query evaluations with project_id and derive group_id from allocations
    eval_query = text("""
        SELECT DISTINCT 
            e.id as eval_id,
            e.project_id,
            e.school_id,
            g.id as group_id,
            g.name as group_name,
            MIN(e.created_at) as earliest_date
        FROM evaluations e
        LEFT JOIN allocations a ON a.evaluation_id = e.id
        LEFT JOIN users u ON u.id = a.reviewee_id
        LEFT JOIN group_members gm ON gm.user_id = u.id
        LEFT JOIN groups g ON g.id = gm.group_id AND g.course_id = e.course_id
        WHERE e.project_id IS NOT NULL
          AND e.project_team_id IS NULL
        GROUP BY e.id, e.project_id, e.school_id, g.id, g.name
        HAVING g.id IS NOT NULL
    """)

    eval_combinations = db.execute(eval_query).fetchall()
    print(f"  Found {len(eval_combinations)} evaluation-group combinations")

    # ========== Step 2: Find all distinct (project_id, group_id) from project_assessments ==========
    print("\n[2/6] Finding distinct project-group combinations from project assessments...")

    assessment_query = text("""
        SELECT DISTINCT
            pa.id as assessment_id,
            p.id as project_id,
            pa.school_id,
            pa.group_id,
            g.name as group_name,
            MIN(pa.published_at) as earliest_date
        FROM project_assessments pa
        JOIN groups g ON g.id = pa.group_id
        LEFT JOIN projects p ON p.course_id = g.course_id
        WHERE pa.project_team_id IS NULL
        GROUP BY pa.id, p.id, pa.school_id, pa.group_id, g.name
        HAVING p.id IS NOT NULL
    """)

    assessment_combinations = db.execute(assessment_query).fetchall()
    print(f"  Found {len(assessment_combinations)} assessment-group combinations")

    # ========== Step 3: Create project_teams for all unique combinations ==========
    print("\n[3/6] Creating project_team records...")

    # Collect all unique (project_id, group_id, school_id) combinations
    all_combinations = defaultdict(lambda: {
        "group_name": None,
        "earliest_date": None,
        "school_id": None,
        "eval_ids": [],
        "assessment_ids": [],
    })

    for row in eval_combinations:
        key = (row.project_id, row.group_id)
        combo = all_combinations[key]
        combo["group_name"] = row.group_name
        combo["school_id"] = row.school_id
        combo["eval_ids"].append(row.eval_id)
        # Handle None dates properly
        if row.earliest_date is not None:
            if combo["earliest_date"] is None or row.earliest_date < combo["earliest_date"]:
                combo["earliest_date"] = row.earliest_date

    for row in assessment_combinations:
        key = (row.project_id, row.group_id)
        combo = all_combinations[key]
        combo["group_name"] = row.group_name
        combo["school_id"] = row.school_id
        combo["assessment_ids"].append(row.assessment_id)
        # Handle None dates properly
        if row.earliest_date is not None:
            if combo["earliest_date"] is None or row.earliest_date < combo["earliest_date"]:
                combo["earliest_date"] = row.earliest_date

    print(f"  Found {len(all_combinations)} unique project-group combinations")

    # Create ProjectTeam records
    for (project_id, group_id), combo in all_combinations.items():
        project_team = ProjectTeam(
            school_id=combo["school_id"],
            project_id=project_id,
            team_id=group_id,
            display_name_at_time=combo["group_name"] or f"Team {group_id}",
            version=1,
            backfill_source="backfill",
            created_at=combo["earliest_date"] or datetime.utcnow(),
        )
        db.add(project_team)
        db.flush()  # Get the ID

        project_team_cache[key] = project_team.id
        stats["project_teams_created"] += 1

        # ========== Step 4: Populate project_team_members ==========
        # Get group members from the group at the time
        members_query = text("""
            SELECT DISTINCT gm.user_id, gm.role_in_team
            FROM group_members gm
            WHERE gm.group_id = :group_id AND gm.active = true
        """)
        members = db.execute(
            members_query, {"group_id": group_id}
        ).fetchall()

        # If no group members found, try to infer from evaluation allocations
        if not members and combo["eval_ids"]:
            stats["inference_count"] += 1
            # Only query if we have eval_ids
            if len(combo["eval_ids"]) > 0:
                inference_query = text("""
                    SELECT DISTINCT a.reviewee_id as user_id
                    FROM allocations a
                    WHERE a.evaluation_id IN :eval_ids
                """)
                members = [
                    {"user_id": row.user_id, "role_in_team": None}
                    for row in db.execute(
                        inference_query, {"eval_ids": tuple(combo["eval_ids"])}
                    ).fetchall()
                ]

        # Add team members
        for member in members:
            team_member = ProjectTeamMember(
                school_id=combo["school_id"],
                project_team_id=project_team.id,
                user_id=member.user_id if hasattr(member, "user_id") else member["user_id"],
                role=member.role_in_team if hasattr(member, "role_in_team") else member.get("role_in_team"),
                created_at=combo["earliest_date"] or datetime.utcnow(),
            )
            db.add(team_member)
            stats["team_members_added"] += 1

    db.commit()
    print(f"  Created {stats['project_teams_created']} project_team records")
    print(f"  Added {stats['team_members_added']} team member records")
    print(
        f"  Used inference for {stats['inference_count']} teams (no group_members found)"
    )

    # ========== Step 5: Link evaluations to project_teams ==========
    print("\n[4/6] Linking evaluations to project_teams...")

    for (project_id, group_id), combo in all_combinations.items():
        project_team_id = project_team_cache[(project_id, group_id)]
        for eval_id in combo["eval_ids"]:
            db.execute(
                text(
                    "UPDATE evaluations SET project_team_id = :project_team_id WHERE id = :eval_id"
                ),
                {"project_team_id": project_team_id, "eval_id": eval_id},
            )
            stats["evaluations_linked"] += 1

    db.commit()
    print(f"  Linked {stats['evaluations_linked']} evaluations")

    # ========== Step 6: Link project_assessments to project_teams ==========
    print("\n[5/6] Linking project_assessments to project_teams...")

    for (project_id, group_id), combo in all_combinations.items():
        project_team_id = project_team_cache[(project_id, group_id)]
        for assessment_id in combo["assessment_ids"]:
            db.execute(
                text(
                    "UPDATE project_assessments SET project_team_id = :project_team_id WHERE id = :assessment_id"
                ),
                {"project_team_id": project_team_id, "assessment_id": assessment_id},
            )
            stats["assessments_linked"] += 1

    db.commit()
    print(f"  Linked {stats['assessments_linked']} project assessments")

    # ========== Step 7: Link project_notes_contexts if any exist ==========
    print("\n[6/6] Linking project_notes_contexts to project_teams...")

    # Try to link based on project_id and evaluation_id
    notes_query = text("""
        SELECT pnc.id, e.project_team_id
        FROM project_notes_contexts pnc
        JOIN evaluations e ON e.id = pnc.evaluation_id
        WHERE pnc.project_team_id IS NULL
          AND e.project_team_id IS NOT NULL
    """)

    notes_to_link = db.execute(notes_query).fetchall()
    for row in notes_to_link:
        db.execute(
            text(
                "UPDATE project_notes_contexts SET project_team_id = :project_team_id WHERE id = :notes_id"
            ),
            {"project_team_id": row.project_team_id, "notes_id": row.id},
        )
        stats["notes_linked"] += 1

    db.commit()
    print(f"  Linked {stats['notes_linked']} project notes contexts")

    # ========== Summary ==========
    print("\n" + "=" * 80)
    print("BACKFILL COMPLETE")
    print("=" * 80)
    print(f"Project teams created:      {stats['project_teams_created']}")
    print(f"Team members added:         {stats['team_members_added']}")
    print(f"Evaluations linked:         {stats['evaluations_linked']}")
    print(f"Assessments linked:         {stats['assessments_linked']}")
    print(f"Notes contexts linked:      {stats['notes_linked']}")
    print(f"Teams inferred from evals:  {stats['inference_count']}")
    print("=" * 80)


if __name__ == "__main__":
    # Create database engine
    engine = create_engine(settings.DATABASE_URL)

    print("Connecting to database...")
    print(f"Database: {settings.DATABASE_URL.split('@')[-1]}")

    with Session(engine) as db:
        try:
            backfill_project_teams(db)
        except Exception as e:
            print(f"\n❌ ERROR: {e}")
            db.rollback()
            raise
        finally:
            db.close()

    print("\n✅ Done!")

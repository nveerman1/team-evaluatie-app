#!/usr/bin/env python3
"""
Backfill ProjectAssessment.project_team_id

This script populates project_team_id for all ProjectAssessment records that have
a group_id but no project_team_id. It either links to existing ProjectTeam records
or creates new ones from Group data.

Phase 2.2 of Legacy Tables Migration Plan
"""

import sys
from pathlib import Path
from datetime import datetime, timezone

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine, and_, select
from sqlalchemy.orm import Session
from app.infra.db.models import (
    ProjectAssessment,
    ProjectTeam,
    ProjectTeamMember,
    Group,
    GroupMember,
    User,
    Project,
)
from app.core.config import settings


def backfill_project_assessment_teams(db: Session, dry_run: bool = True):
    """
    Backfill project_team_id for ProjectAssessment records.
    
    For each ProjectAssessment with group_id but no project_team_id:
    1. Check if ProjectTeam exists with team_id == assessment.group_id
    2. If exists: Link to existing ProjectTeam
    3. If not: Create ProjectTeam from Group (with backfill_source='migration')
    4. Verify all members are in ProjectTeamMember
    
    Args:
        db: Database session
        dry_run: If True, only report what would be done without making changes
    
    Returns:
        dict with backfill results
    """
    print("=" * 80)
    print("ProjectAssessment project_team_id Backfill")
    print("=" * 80)
    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
    else:
        print("⚠️  LIVE MODE - Changes will be committed to database")
    print("=" * 80)
    print()
    
    # Get all ProjectAssessment records that need backfill
    print("1. Fetching ProjectAssessment records without project_team_id...")
    assessments = (
        db.query(ProjectAssessment)
        .filter(
            ProjectAssessment.group_id.isnot(None),
            ProjectAssessment.project_team_id.is_(None),
        )
        .all()
    )
    
    print(f"   Found {len(assessments)} assessments to backfill")
    print()
    
    if len(assessments) == 0:
        print("✅ No assessments need backfilling. All done!")
        return {
            'total_assessments': 0,
            'linked_existing': 0,
            'created_new': 0,
            'errors': [],
        }
    
    results = {
        'total_assessments': len(assessments),
        'linked_existing': 0,
        'created_new': 0,
        'errors': [],
    }
    
    print("2. Processing assessments...")
    for i, assessment in enumerate(assessments, 1):
        try:
            # Get the group
            group = db.query(Group).filter(Group.id == assessment.group_id).first()
            if not group:
                error_msg = f"   ❌ Assessment {assessment.id}: Group {assessment.group_id} not found"
                print(error_msg)
                results['errors'].append(error_msg)
                continue
            
            # Check if ProjectTeam already exists for this group
            existing_team = (
                db.query(ProjectTeam)
                .filter(
                    ProjectTeam.school_id == assessment.school_id,
                    ProjectTeam.team_id == assessment.group_id,
                )
                .first()
            )
            
            # If assessment has project_id, try to find team for that specific project
            if assessment.project_id:
                project_specific_team = (
                    db.query(ProjectTeam)
                    .filter(
                        ProjectTeam.school_id == assessment.school_id,
                        ProjectTeam.project_id == assessment.project_id,
                        ProjectTeam.team_id == assessment.group_id,
                    )
                    .first()
                )
                if project_specific_team:
                    existing_team = project_specific_team
            
            if existing_team:
                # Link to existing ProjectTeam
                if not dry_run:
                    assessment.project_team_id = existing_team.id
                results['linked_existing'] += 1
                print(f"   ✓ Assessment {assessment.id}: Linked to existing ProjectTeam {existing_team.id}")
            else:
                # Create new ProjectTeam from Group
                team_number = group.team_number or 0
                
                # Get group members
                group_members = (
                    db.query(GroupMember)
                    .filter(
                        GroupMember.group_id == group.id,
                        GroupMember.active.is_(True),
                    )
                    .all()
                )
                
                if not dry_run:
                    # Create ProjectTeam
                    created_at = getattr(assessment, 'created_at', datetime.now(timezone.utc))
                    new_team = ProjectTeam(
                        school_id=assessment.school_id,
                        project_id=assessment.project_id,
                        team_id=assessment.group_id,  # Link back to legacy group
                        team_number=team_number,
                        version=1,
                        display_name_at_time=group.name or f"Team {team_number}",
                        is_locked=True,  # Lock since it's from migration
                        created_at=created_at,
                    )
                    db.add(new_team)
                    db.flush()  # Get the ID
                    
                    # Create ProjectTeamMembers
                    for gm in group_members:
                        team_member = ProjectTeamMember(
                            school_id=assessment.school_id,
                            project_team_id=new_team.id,
                            user_id=gm.user_id,
                            role=gm.role_in_team,
                        )
                        db.add(team_member)
                    
                    # Link assessment to new team
                    assessment.project_team_id = new_team.id
                    
                    team_id = new_team.id
                else:
                    team_id = "[would create]"
                
                results['created_new'] += 1
                print(f"   ✓ Assessment {assessment.id}: Created new ProjectTeam {team_id} with {len(group_members)} members")
        
        except Exception as e:
            error_msg = f"   ❌ Assessment {assessment.id}: Error - {str(e)}"
            print(error_msg)
            results['errors'].append(error_msg)
    
    print()
    print("=" * 80)
    print("Summary:")
    print("=" * 80)
    print(f"Total assessments processed: {results['total_assessments']}")
    print(f"Linked to existing teams:    {results['linked_existing']}")
    print(f"Created new teams:           {results['created_new']}")
    print(f"Errors:                      {len(results['errors'])}")
    
    if results['errors']:
        print()
        print("Errors encountered:")
        for error in results['errors']:
            print(error)
    
    if not dry_run:
        print()
        print("✅ Committing changes to database...")
        db.commit()
        print("✅ Done!")
    else:
        print()
        print("🔍 DRY RUN: No changes were made. Run with --commit to apply changes.")
    
    return results


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Backfill project_team_id for ProjectAssessment records"
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually commit changes (default is dry-run)",
    )
    args = parser.parse_args()
    
    # Create database connection
    engine = create_engine(settings.database_url)
    db = Session(engine)
    
    try:
        results = backfill_project_assessment_teams(db, dry_run=not args.commit)
        return 0 if len(results['errors']) == 0 else 1
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())

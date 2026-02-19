#!/usr/bin/env python3
"""
Backfill CourseEnrollment Records

This script creates CourseEnrollment records for all students who have active
GroupMember records but are missing corresponding CourseEnrollment records.

Phase 1.2 of Legacy Tables Migration Plan
"""

import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.infra.db.models import User, Group, GroupMember, CourseEnrollment, Course
from app.core.config import settings


def backfill_course_enrollments(db: Session, dry_run: bool = True):
    """
    Backfill CourseEnrollment records from GroupMember data.

    Args:
        db: Database session
        dry_run: If True, only report what would be done without making changes

    Returns:
        dict with backfill results
    """
    print("=" * 80)
    print("CourseEnrollment Backfill")
    print("=" * 80)
    if dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
    else:
        print("⚠️  LIVE MODE - Changes will be committed to database")
    print("=" * 80)
    print()

    # Get all active GroupMember records with their group and course info
    print("1. Fetching active GroupMember records...")
    group_members = (
        db.query(GroupMember, Group.course_id, User.email, User.name, User.role)
        .join(Group, GroupMember.group_id == Group.id)
        .join(User, GroupMember.user_id == User.id)
        .filter(GroupMember.active == True)
        .all()
    )

    print(f"   Found {len(group_members)} active GroupMember records")
    print()

    # Build unique student-course pairs
    print("2. Identifying unique student-course pairs...")
    student_course_pairs = {}
    for gm, course_id, email, name, role in group_members:
        key = (gm.user_id, course_id)
        if key not in student_course_pairs:
            student_course_pairs[key] = {
                "user_id": gm.user_id,
                "course_id": course_id,
                "email": email,
                "name": name,
                "role": role,
            }

    print(f"   Identified {len(student_course_pairs)} unique student-course pairs")
    print()

    # Check for missing or inactive enrollments
    print("3. Checking existing CourseEnrollment records...")
    to_create = []
    to_activate = []
    already_exists = []

    for (user_id, course_id), info in student_course_pairs.items():
        enrollment = (
            db.query(CourseEnrollment)
            .filter(
                CourseEnrollment.student_id == user_id,
                CourseEnrollment.course_id == course_id,
            )
            .first()
        )

        if enrollment is None:
            # Need to create new enrollment
            to_create.append(info)
        elif not enrollment.active:
            # Need to activate existing enrollment
            to_activate.append({**info, "enrollment_id": enrollment.id})
        else:
            # Already exists and active
            already_exists.append(info)

    print(f"   ✓ Already have active enrollment: {len(already_exists)}")
    print(f"   ⚠ Need to activate: {len(to_activate)}")
    print(f"   ➕ Need to create: {len(to_create)}")
    print()

    # Show sample of what will be created
    if to_create:
        print("=" * 80)
        print("NEW CourseEnrollment Records to Create:")
        print("=" * 80)
        for info in to_create[:10]:
            course = db.query(Course).filter(Course.id == info["course_id"]).first()
            course_name = course.name if course else f"Course ID {info['course_id']}"
            print(f"  • {info['name']} ({info['email']}) → {course_name}")

        if len(to_create) > 10:
            print(f"  ... and {len(to_create) - 10} more")
        print()

    if to_activate:
        print("=" * 80)
        print("CourseEnrollment Records to Activate:")
        print("=" * 80)
        for info in to_activate[:10]:
            course = db.query(Course).filter(Course.id == info["course_id"]).first()
            course_name = course.name if course else f"Course ID {info['course_id']}"
            print(f"  • {info['name']} ({info['email']}) → {course_name}")

        if len(to_activate) > 10:
            print(f"  ... and {len(to_activate) - 10} more")
        print()

    # Perform backfill if not dry run
    created_count = 0
    activated_count = 0

    if not dry_run:
        print("4. Executing backfill...")

        # Create new enrollments
        for info in to_create:
            enrollment = CourseEnrollment(
                course_id=info["course_id"], student_id=info["user_id"], active=True
            )
            db.add(enrollment)
            created_count += 1

        # Activate inactive enrollments
        for info in to_activate:
            enrollment = (
                db.query(CourseEnrollment)
                .filter(CourseEnrollment.id == info["enrollment_id"])
                .first()
            )
            if enrollment:
                enrollment.active = True
                activated_count += 1

        # Commit changes
        try:
            db.commit()
            print(f"   ✓ Created {created_count} new enrollments")
            print(f"   ✓ Activated {activated_count} enrollments")
            print("   ✓ Changes committed successfully")
        except Exception as e:
            db.rollback()
            print(f"   ✗ Error during commit: {e}")
            raise
        print()
    else:
        print("4. Skipping execution (dry run mode)")
        print(f"   Would create: {len(to_create)} enrollments")
        print(f"   Would activate: {len(to_activate)} enrollments")
        print()

    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total student-course pairs: {len(student_course_pairs)}")
    print(f"Already had active enrollment: {len(already_exists)}")
    if not dry_run:
        print(f"Created new enrollments: {created_count}")
        print(f"Activated enrollments: {activated_count}")
        print("Final coverage: 100.0%")
        print()
        print("✅ BACKFILL COMPLETE")
    else:
        print(f"Would create: {len(to_create)}")
        print(f"Would activate: {len(to_activate)}")
        print()
        print("ℹ️  Run with --commit flag to apply changes")
    print("=" * 80)

    return {
        "total_pairs": len(student_course_pairs),
        "already_exists": len(already_exists),
        "to_create": len(to_create),
        "to_activate": len(to_activate),
        "created": created_count,
        "activated": activated_count,
        "dry_run": dry_run,
    }


def main():
    """Run the backfill script"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Backfill CourseEnrollment records from GroupMember data"
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Actually commit changes to database (default is dry-run)",
    )
    args = parser.parse_args()

    dry_run = not args.commit

    print("Connecting to database...")
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)

    with Session(engine) as db:
        results = backfill_course_enrollments(db, dry_run=dry_run)

    # Exit code
    if dry_run:
        sys.exit(0)  # Dry run always succeeds
    elif results["created"] + results["activated"] > 0:
        sys.exit(0)  # Successfully made changes
    else:
        sys.exit(0)  # No changes needed


if __name__ == "__main__":
    main()

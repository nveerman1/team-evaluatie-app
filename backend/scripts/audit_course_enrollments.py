#!/usr/bin/env python3
"""
Audit CourseEnrollment Coverage

This script verifies that all students with active GroupMember records
have corresponding CourseEnrollment records.

Phase 1.1 of Legacy Tables Migration Plan
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


def audit_course_enrollments(db: Session):
    """
    Audit CourseEnrollment coverage by comparing with GroupMember records.

    Returns:
        dict with audit results
    """
    print("=" * 80)
    print("CourseEnrollment Coverage Audit")
    print("=" * 80)
    print()

    # Get all active GroupMember records with their group and course info
    print("1. Fetching all active GroupMember records...")
    group_members = (
        db.query(GroupMember, Group.course_id, User.email, User.name)
        .join(Group, GroupMember.group_id == Group.id)
        .join(User, GroupMember.user_id == User.id)
        .filter(GroupMember.active == True)
        .all()
    )

    total_active_memberships = len(group_members)
    print(f"   Found {total_active_memberships} active GroupMember records")
    print()

    # Track unique student-course combinations
    student_course_pairs = {}
    for gm, course_id, email, name in group_members:
        key = (gm.user_id, course_id)
        if key not in student_course_pairs:
            student_course_pairs[key] = {
                "user_id": gm.user_id,
                "course_id": course_id,
                "email": email,
                "name": name,
                "group_count": 0,
            }
        student_course_pairs[key]["group_count"] += 1

    total_unique_pairs = len(student_course_pairs)
    print(f"2. Unique student-course pairs from GroupMember: {total_unique_pairs}")
    print()

    # Check which pairs have CourseEnrollment records
    print("3. Checking CourseEnrollment coverage...")
    missing_enrollments = []
    existing_enrollments = []
    inactive_enrollments = []

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
            missing_enrollments.append(info)
        elif not enrollment.active:
            inactive_enrollments.append({**info, "enrollment_active": False})
        else:
            existing_enrollments.append(info)

    print(f"   ✓ Students with active CourseEnrollment: {len(existing_enrollments)}")
    print(f"   ⚠ Students with inactive CourseEnrollment: {len(inactive_enrollments)}")
    print(f"   ✗ Students missing CourseEnrollment: {len(missing_enrollments)}")
    print()

    # Calculate coverage percentage
    coverage_pct = (
        (len(existing_enrollments) / total_unique_pairs * 100)
        if total_unique_pairs > 0
        else 100
    )

    # Print detailed results
    if missing_enrollments:
        print("=" * 80)
        print("MISSING CourseEnrollment Records:")
        print("=" * 80)
        for info in missing_enrollments[:10]:  # Show first 10
            course = db.query(Course).filter(Course.id == info["course_id"]).first()
            course_name = course.name if course else f"Course ID {info['course_id']}"
            print(f"  • {info['name']} ({info['email']})")
            print(f"    Course: {course_name}")
            print(f"    Groups: {info['group_count']}")
            print()

        if len(missing_enrollments) > 10:
            print(f"  ... and {len(missing_enrollments) - 10} more")
            print()

    if inactive_enrollments:
        print("=" * 80)
        print("INACTIVE CourseEnrollment Records (but active in GroupMember):")
        print("=" * 80)
        for info in inactive_enrollments[:10]:  # Show first 10
            course = db.query(Course).filter(Course.id == info["course_id"]).first()
            course_name = course.name if course else f"Course ID {info['course_id']}"
            print(f"  • {info['name']} ({info['email']})")
            print(f"    Course: {course_name}")
            print(f"    Groups: {info['group_count']}")
            print()

        if len(inactive_enrollments) > 10:
            print(f"  ... and {len(inactive_enrollments) - 10} more")
            print()

    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total active GroupMember records: {total_active_memberships}")
    print(f"Unique student-course pairs: {total_unique_pairs}")
    print(f"CourseEnrollment coverage: {coverage_pct:.1f}%")
    print()
    print("Status:")
    print(f"  ✓ Complete and active: {len(existing_enrollments)}")
    print(f"  ⚠ Present but inactive: {len(inactive_enrollments)}")
    print(f"  ✗ Missing: {len(missing_enrollments)}")
    print()

    if coverage_pct == 100.0 and len(inactive_enrollments) == 0:
        print("✅ AUDIT PASSED: All students have active CourseEnrollment records")
        status = "PASS"
    elif coverage_pct >= 99.0 and len(inactive_enrollments) == 0:
        print("⚠️  AUDIT WARNING: Coverage is good but not 100%")
        status = "WARNING"
    else:
        print("❌ AUDIT FAILED: CourseEnrollment backfill required")
        status = "FAIL"

    print("=" * 80)

    return {
        "status": status,
        "total_active_memberships": total_active_memberships,
        "unique_pairs": total_unique_pairs,
        "existing_enrollments": len(existing_enrollments),
        "inactive_enrollments": len(inactive_enrollments),
        "missing_enrollments": len(missing_enrollments),
        "coverage_percent": coverage_pct,
        "missing_details": missing_enrollments,
        "inactive_details": inactive_enrollments,
    }


def main():
    """Run the audit"""
    print("Connecting to database...")
    engine = create_engine(settings.SQLALCHEMY_DATABASE_URI)

    with Session(engine) as db:
        results = audit_course_enrollments(db)

    # Exit with appropriate code
    if results["status"] == "PASS":
        sys.exit(0)
    elif results["status"] == "WARNING":
        sys.exit(1)
    else:
        sys.exit(2)


if __name__ == "__main__":
    main()

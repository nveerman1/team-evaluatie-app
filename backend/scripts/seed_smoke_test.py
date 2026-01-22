#!/usr/bin/env python3
"""
Smoke Test for Database Seeding

Tests that:
1. Demo seed completes without errors
2. All major entity counts > 0
3. No null score fields where UI expects numbers
4. Referential integrity is maintained

Usage:
    python -m backend.scripts.seed_smoke_test
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.infra.db.session import SessionLocal
from app.infra.db.models import (
    School,
    User,
    Subject,
    AcademicYear,
    Class,
    StudentClassMembership,
    Course,
    TeacherCourse,
    CourseEnrollment,
    Group,
    GroupMember,
    Project,
    ProjectTeam,
    ProjectTeamMember,
    Rubric,
    RubricCriterion,
    Evaluation,
    Allocation,
    Score,
    Reflection,
    ProjectAssessment,
    ProjectAssessmentTeam,
    ProjectAssessmentScore,
    ProjectAssessmentReflection,
    ProjectAssessmentSelfAssessment,
    ProjectAssessmentSelfAssessmentScore,
    CompetencyCategory,
    Competency,
    CompetencyRubricLevel,
    CompetencyWindow,
    CompetencySelfScore,
    CompetencyTeacherObservation,
    CompetencyGoal,
    CompetencyReflection,
    LearningObjective,
    RubricCriterionLearningObjective,
    Client,
    ClientLog,
    ClientProjectLink,
    RFIDCard,
    AttendanceEvent,
)


class Colors:
    """ANSI color codes"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_success(msg: str):
    """Print success message in green"""
    print(f"{Colors.GREEN}✓{Colors.RESET} {msg}")


def print_error(msg: str):
    """Print error message in red"""
    print(f"{Colors.RED}✗{Colors.RESET} {msg}")


def print_warning(msg: str):
    """Print warning message in yellow"""
    print(f"{Colors.YELLOW}⚠{Colors.RESET} {msg}")


def print_info(msg: str):
    """Print info message in blue"""
    print(f"{Colors.BLUE}ℹ{Colors.RESET} {msg}")


def print_header(msg: str):
    """Print section header"""
    print(f"\n{Colors.BOLD}{msg}{Colors.RESET}")
    print("=" * len(msg))


def check_count(db: Session, model, expected_min: int, name: str) -> bool:
    """Check that entity count is at least expected_min"""
    count = db.query(func.count(model.id)).scalar()
    if count >= expected_min:
        print_success(f"{name}: {count} (expected >= {expected_min})")
        return True
    else:
        print_error(f"{name}: {count} (expected >= {expected_min})")
        return False


def check_no_null_scores(db: Session) -> bool:
    """Check that all scores have non-null values where expected"""
    errors = []
    
    # Check Score.score is not null
    null_scores = db.query(func.count(Score.id)).filter(Score.score.is_(None)).scalar()
    if null_scores > 0:
        errors.append(f"Score table has {null_scores} null score values")
    
    # Check ProjectAssessmentScore.score is not null
    null_pa_scores = db.query(func.count(ProjectAssessmentScore.id)).filter(
        ProjectAssessmentScore.score.is_(None)
    ).scalar()
    if null_pa_scores > 0:
        errors.append(f"ProjectAssessmentScore table has {null_pa_scores} null score values")
    
    # Check ProjectAssessmentSelfAssessmentScore.score is not null
    null_sa_scores = db.query(func.count(ProjectAssessmentSelfAssessmentScore.id)).filter(
        ProjectAssessmentSelfAssessmentScore.score.is_(None)
    ).scalar()
    if null_sa_scores > 0:
        errors.append(f"ProjectAssessmentSelfAssessmentScore table has {null_sa_scores} null score values")
    
    # Check CompetencySelfScore.score is not null (can be null for incomplete scans)
    # This is actually OK - some students may not have completed all scans
    
    if errors:
        for error in errors:
            print_error(error)
        return False
    else:
        print_success("All score fields have non-null values")
        return True


def check_referential_integrity(db: Session) -> bool:
    """Check that foreign key relationships are valid"""
    errors = []
    
    # Check User.school_id references School
    orphan_users = db.query(func.count(User.id)).filter(
        ~User.school_id.in_(select(School.id))
    ).scalar()
    if orphan_users > 0:
        errors.append(f"{orphan_users} users have invalid school_id")
    
    # Check Course.school_id references School
    orphan_courses = db.query(func.count(Course.id)).filter(
        ~Course.school_id.in_(select(School.id))
    ).scalar()
    if orphan_courses > 0:
        errors.append(f"{orphan_courses} courses have invalid school_id")
    
    # Check Project.course_id references Course
    orphan_projects = db.query(func.count(Project.id)).filter(
        Project.course_id.isnot(None),
        ~Project.course_id.in_(select(Course.id))
    ).scalar()
    if orphan_projects > 0:
        errors.append(f"{orphan_projects} projects have invalid course_id")
    
    # Check Evaluation.project_id references Project
    orphan_evaluations = db.query(func.count(Evaluation.id)).filter(
        Evaluation.project_id.isnot(None),
        ~Evaluation.project_id.in_(select(Project.id))
    ).scalar()
    if orphan_evaluations > 0:
        errors.append(f"{orphan_evaluations} evaluations have invalid project_id")
    
    # Check Allocation.evaluation_id references Evaluation
    orphan_allocations = db.query(func.count(Allocation.id)).filter(
        ~Allocation.evaluation_id.in_(select(Evaluation.id))
    ).scalar()
    if orphan_allocations > 0:
        errors.append(f"{orphan_allocations} allocations have invalid evaluation_id")
    
    # Check Score.allocation_id references Allocation
    orphan_scores = db.query(func.count(Score.id)).filter(
        ~Score.allocation_id.in_(select(Allocation.id))
    ).scalar()
    if orphan_scores > 0:
        errors.append(f"{orphan_scores} scores have invalid allocation_id")
    
    if errors:
        for error in errors:
            print_error(error)
        return False
    else:
        print_success("All foreign key relationships are valid")
        return True


def check_unique_constraints(db: Session) -> bool:
    """Check that unique constraints are respected"""
    errors = []
    
    # Check School.name is unique
    duplicate_schools = db.execute(
        select(School.name, func.count(School.id).label('count'))
        .group_by(School.name)
        .having(func.count(School.id) > 1)
    ).all()
    if duplicate_schools:
        for name, count in duplicate_schools:
            errors.append(f"School name '{name}' appears {count} times (should be unique)")
    
    # Check User (school_id, email) is unique
    duplicate_users = db.execute(
        select(User.school_id, User.email, func.count(User.id).label('count'))
        .group_by(User.school_id, User.email)
        .having(func.count(User.id) > 1)
    ).all()
    if duplicate_users:
        for school_id, email, count in duplicate_users:
            errors.append(f"User email '{email}' in school {school_id} appears {count} times (should be unique)")
    
    # Check GroupMember (group_id, user_id) is unique
    duplicate_members = db.execute(
        select(GroupMember.group_id, GroupMember.user_id, func.count(GroupMember.id).label('count'))
        .group_by(GroupMember.group_id, GroupMember.user_id)
        .having(func.count(GroupMember.id) > 1)
    ).all()
    if duplicate_members:
        for group_id, user_id, count in duplicate_members:
            errors.append(f"GroupMember (group={group_id}, user={user_id}) appears {count} times (should be unique)")
    
    if errors:
        for error in errors:
            print_error(error)
        return False
    else:
        print_success("All unique constraints are respected")
        return True


def check_business_rules(db: Session) -> bool:
    """Check business rules and invariants"""
    errors = []
    warnings = []
    
    # Check that all students are enrolled in at least one course
    unenrolled_students = db.query(func.count(User.id)).filter(
        User.role == "student",
        ~User.id.in_(select(CourseEnrollment.student_id))
    ).scalar()
    if unenrolled_students > 0:
        warnings.append(f"{unenrolled_students} students are not enrolled in any course")
    
    # Check that all evaluations have at least one allocation
    evaluations_without_allocations = db.query(func.count(Evaluation.id)).filter(
        ~Evaluation.id.in_(select(Allocation.evaluation_id))
    ).scalar()
    if evaluations_without_allocations > 0:
        warnings.append(f"{evaluations_without_allocations} evaluations have no allocations")
    
    # Check that all rubrics have at least one criterion
    rubrics_without_criteria = db.query(func.count(Rubric.id)).filter(
        ~Rubric.id.in_(select(RubricCriterion.rubric_id))
    ).scalar()
    if rubrics_without_criteria > 0:
        errors.append(f"{rubrics_without_criteria} rubrics have no criteria")
    
    # Check that all groups have at least one member
    groups_without_members = db.query(func.count(Group.id)).filter(
        ~Group.id.in_(select(GroupMember.group_id))
    ).scalar()
    if groups_without_members > 0:
        errors.append(f"{groups_without_members} groups have no members")
    
    if errors:
        for error in errors:
            print_error(error)
        return False
    else:
        for warning in warnings:
            print_warning(warning)
        print_success("All critical business rules are satisfied")
        return True


def run_smoke_test():
    """Run all smoke tests"""
    print_header("Database Seeding Smoke Test")
    print("Testing database integrity and data quality...\n")
    
    db = SessionLocal()
    all_passed = True
    
    try:
        # Test 1: Check entity counts
        print_header("1. Entity Count Checks")
        checks = [
            (School, 1, "Schools"),
            (User, 26, "Users"),  # 24 students + 2 teachers
            (Subject, 1, "Subjects"),
            (AcademicYear, 1, "Academic Years"),
            (Class, 2, "Classes"),
            (StudentClassMembership, 24, "Student Class Memberships"),
            (Course, 1, "Courses"),
            (TeacherCourse, 2, "Teacher-Course Assignments"),
            (CourseEnrollment, 24, "Course Enrollments"),
            (Group, 6, "Groups (Teams)"),
            (GroupMember, 24, "Group Members"),
            (Project, 3, "Projects"),
            (ProjectTeam, 6, "Project Teams"),
            (ProjectTeamMember, 24, "Project Team Members"),
            (Rubric, 2, "Rubrics"),
            (RubricCriterion, 8, "Rubric Criteria"),
            (Evaluation, 1, "Evaluations"),
            (Allocation, 1, "Allocations"),
            (Score, 1, "Scores"),
            (Reflection, 1, "Reflections"),
            (ProjectAssessment, 1, "Project Assessments"),
            (ProjectAssessmentTeam, 1, "Project Assessment Teams"),
            (ProjectAssessmentScore, 1, "Project Assessment Scores"),
            (CompetencyCategory, 6, "Competency Categories"),
            (Competency, 6, "Competencies"),
            (CompetencyRubricLevel, 30, "Competency Rubric Levels"),
            (CompetencyWindow, 2, "Competency Windows"),
            (CompetencySelfScore, 1, "Competency Self Scores"),
            (CompetencyTeacherObservation, 1, "Competency Teacher Observations"),
            (CompetencyGoal, 1, "Competency Goals"),
            (LearningObjective, 8, "Learning Objectives"),
            (Client, 3, "Clients"),
            (ClientLog, 3, "Client Logs"),
            (ClientProjectLink, 3, "Client-Project Links"),
            (RFIDCard, 8, "RFID Cards"),
            (AttendanceEvent, 40, "Attendance Events"),
        ]
        
        for model, expected_min, name in checks:
            if not check_count(db, model, expected_min, name):
                all_passed = False
        
        # Test 2: Check no null scores
        print_header("2. Null Score Field Checks")
        if not check_no_null_scores(db):
            all_passed = False
        
        # Test 3: Check referential integrity
        print_header("3. Referential Integrity Checks")
        if not check_referential_integrity(db):
            all_passed = False
        
        # Test 4: Check unique constraints
        print_header("4. Unique Constraint Checks")
        if not check_unique_constraints(db):
            all_passed = False
        
        # Test 5: Check business rules
        print_header("5. Business Rule Checks")
        if not check_business_rules(db):
            all_passed = False
        
        # Summary
        print_header("Summary")
        if all_passed:
            print_success("All smoke tests passed! ✨")
            return 0
        else:
            print_error("Some smoke tests failed. See details above.")
            return 1
    
    except Exception as e:
        print_error(f"Smoke test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(run_smoke_test())

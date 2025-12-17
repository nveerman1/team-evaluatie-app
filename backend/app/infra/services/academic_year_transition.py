"""
Service layer for Academic Year Transition
Handles bulk year transition with class and student membership copying
"""

from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
from fastapi import HTTPException, status
import logging

from app.infra.db.models import (
    AcademicYear,
    Class,
    StudentClassMembership,
    Course,
    CourseEnrollment,
)

logger = logging.getLogger(__name__)


class AcademicYearTransitionService:
    """Service for transitioning students and classes to a new academic year"""

    @staticmethod
    def validate_transition(
        db: Session,
        school_id: int,
        source_year_id: int,
        target_year_id: int,
        class_mapping: Dict[str, str],
    ) -> Tuple[AcademicYear, AcademicYear, List[Class]]:
        """
        Validate transition prerequisites
        
        Args:
            db: Database session
            school_id: School ID for multi-tenancy
            source_year_id: Source academic year ID
            target_year_id: Target academic year ID
            class_mapping: Dict mapping source class names to target class names
            
        Returns:
            Tuple of (source_year, target_year, source_classes)
            
        Raises:
            HTTPException: If validation fails
        """
        # Validate source academic year exists and belongs to school
        source_year = db.query(AcademicYear).filter(
            AcademicYear.id == source_year_id,
            AcademicYear.school_id == school_id,
        ).first()
        
        if not source_year:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Source academic year {source_year_id} not found or does not belong to this school",
            )
        
        # Validate target academic year exists and belongs to school
        target_year = db.query(AcademicYear).filter(
            AcademicYear.id == target_year_id,
            AcademicYear.school_id == school_id,
        ).first()
        
        if not target_year:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Target academic year {target_year_id} not found or does not belong to this school",
            )
        
        # Validate source and target are different
        if source_year_id == target_year_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Source and target academic years must be different",
            )
        
        # Get all classes in source year
        source_classes = db.query(Class).filter(
            Class.school_id == school_id,
            Class.academic_year_id == source_year_id,
        ).all()
        
        # Build mapping of class name to class object
        source_class_map = {c.name: c for c in source_classes}
        
        # Validate all mapped classes exist in source
        for source_name in class_mapping.keys():
            if source_name not in source_class_map:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Source class '{source_name}' not found in source academic year",
                )
        
        # Check if any target classes already exist
        target_class_names = list(class_mapping.values())
        existing_target_classes = db.query(Class).filter(
            Class.school_id == school_id,
            Class.academic_year_id == target_year_id,
            Class.name.in_(target_class_names),
        ).all()
        
        if existing_target_classes:
            existing_names = [c.name for c in existing_target_classes]
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target classes already exist: {', '.join(existing_names)}",
            )
        
        return source_year, target_year, source_classes

    @staticmethod
    def clone_classes(
        db: Session,
        school_id: int,
        target_year_id: int,
        source_classes: List[Class],
        class_mapping: Dict[str, str],
    ) -> Dict[int, int]:
        """
        Clone classes from source to target academic year
        
        Args:
            db: Database session
            school_id: School ID
            target_year_id: Target academic year ID
            source_classes: List of source class objects
            class_mapping: Dict mapping source class names to target class names
            
        Returns:
            Dict mapping old class IDs to new class IDs
        """
        old_to_new_class_map: Dict[int, int] = {}
        
        for source_class in source_classes:
            # Only clone classes that are in the mapping
            if source_class.name not in class_mapping:
                logger.warning(
                    f"Class '{source_class.name}' not in mapping, skipping clone"
                )
                continue
            
            new_name = class_mapping[source_class.name]
            
            # Create new class
            new_class = Class(
                school_id=school_id,
                academic_year_id=target_year_id,
                name=new_name,
            )
            
            db.add(new_class)
            db.flush()  # Get the new class ID
            
            old_to_new_class_map[source_class.id] = new_class.id
            
            logger.info(
                f"Created class '{new_name}' (ID: {new_class.id}) "
                f"from '{source_class.name}' (ID: {source_class.id})"
            )
        
        return old_to_new_class_map

    @staticmethod
    def copy_student_memberships(
        db: Session,
        source_year_id: int,
        target_year_id: int,
        class_id_map: Dict[int, int],
    ) -> Tuple[int, int]:
        """
        Copy student class memberships to target academic year
        
        Args:
            db: Database session
            source_year_id: Source academic year ID
            target_year_id: Target academic year ID
            class_id_map: Dict mapping old class IDs to new class IDs
            
        Returns:
            Tuple of (students_moved, skipped_students)
        """
        students_moved = 0
        skipped_students = 0
        
        # Get all memberships from source year for mapped classes
        source_class_ids = list(class_id_map.keys())
        source_memberships = db.query(StudentClassMembership).filter(
            StudentClassMembership.academic_year_id == source_year_id,
            StudentClassMembership.class_id.in_(source_class_ids),
        ).all()
        
        for membership in source_memberships:
            old_class_id = membership.class_id
            new_class_id = class_id_map.get(old_class_id)
            
            if not new_class_id:
                logger.warning(
                    f"No mapping found for class ID {old_class_id}, "
                    f"skipping student {membership.student_id}"
                )
                skipped_students += 1
                continue
            
            # Check if student already has membership in target year
            # (respects unique constraint: student_id, academic_year_id)
            existing = db.query(StudentClassMembership).filter(
                StudentClassMembership.student_id == membership.student_id,
                StudentClassMembership.academic_year_id == target_year_id,
            ).first()
            
            if existing:
                logger.warning(
                    f"Student {membership.student_id} already has membership "
                    f"in target year {target_year_id}, skipping"
                )
                skipped_students += 1
                continue
            
            # Create new membership
            new_membership = StudentClassMembership(
                student_id=membership.student_id,
                class_id=new_class_id,
                academic_year_id=target_year_id,
            )
            
            db.add(new_membership)
            students_moved += 1
            
            logger.debug(
                f"Created membership for student {membership.student_id} "
                f"in class {new_class_id}"
            )
        
        return students_moved, skipped_students

    @staticmethod
    def copy_courses_and_enrollments(
        db: Session,
        school_id: int,
        source_year_id: int,
        target_year_id: int,
    ) -> Tuple[int, int]:
        """
        Copy courses and course enrollments to target academic year
        
        Args:
            db: Database session
            school_id: School ID
            source_year_id: Source academic year ID
            target_year_id: Target academic year ID
            
        Returns:
            Tuple of (courses_created, enrollments_copied)
        """
        courses_created = 0
        enrollments_copied = 0
        old_to_new_course_map: Dict[int, int] = {}
        
        # Get all courses from source year
        source_courses = db.query(Course).filter(
            Course.school_id == school_id,
            Course.academic_year_id == source_year_id,
        ).all()
        
        # Clone courses
        for source_course in source_courses:
            new_course = Course(
                school_id=school_id,
                subject_id=source_course.subject_id,
                academic_year_id=target_year_id,
                name=source_course.name,
                code=None,  # Don't copy code to avoid unique constraint violations
                period=source_course.period,
                level=source_course.level,
                description=source_course.description,
                is_active=source_course.is_active,
            )
            
            db.add(new_course)
            db.flush()  # Get the new course ID
            
            old_to_new_course_map[source_course.id] = new_course.id
            courses_created += 1
            
            logger.info(
                f"Created course '{new_course.name}' (ID: {new_course.id}) "
                f"from course ID {source_course.id}"
            )
        
        # Get students who have membership in target year
        target_student_ids = db.query(StudentClassMembership.student_id).filter(
            StudentClassMembership.academic_year_id == target_year_id,
        ).distinct().all()
        target_student_ids_set = {s[0] for s in target_student_ids}
        
        # Get all enrollments from source courses
        source_course_ids = list(old_to_new_course_map.keys())
        source_enrollments = db.query(CourseEnrollment).filter(
            CourseEnrollment.course_id.in_(source_course_ids),
        ).all()
        
        # Copy enrollments for students who exist in target year
        for enrollment in source_enrollments:
            # Only copy if student has a class membership in target year
            if enrollment.student_id not in target_student_ids_set:
                logger.debug(
                    f"Student {enrollment.student_id} not in target year, "
                    f"skipping enrollment"
                )
                continue
            
            old_course_id = enrollment.course_id
            new_course_id = old_to_new_course_map.get(old_course_id)
            
            if not new_course_id:
                logger.warning(
                    f"No mapping found for course ID {old_course_id}, "
                    f"skipping enrollment"
                )
                continue
            
            # Check if enrollment already exists
            existing = db.query(CourseEnrollment).filter(
                CourseEnrollment.course_id == new_course_id,
                CourseEnrollment.student_id == enrollment.student_id,
            ).first()
            
            if existing:
                logger.debug(
                    f"Enrollment already exists for student {enrollment.student_id} "
                    f"in course {new_course_id}, skipping"
                )
                continue
            
            # Create new enrollment
            new_enrollment = CourseEnrollment(
                course_id=new_course_id,
                student_id=enrollment.student_id,
                active=enrollment.active,
            )
            
            db.add(new_enrollment)
            enrollments_copied += 1
            
            logger.debug(
                f"Created enrollment for student {enrollment.student_id} "
                f"in course {new_course_id}"
            )
        
        return courses_created, enrollments_copied

    @classmethod
    def execute_transition(
        cls,
        db: Session,
        school_id: int,
        source_year_id: int,
        target_year_id: int,
        class_mapping: Dict[str, str],
        copy_course_enrollments: bool = False,
    ) -> Dict[str, int]:
        """
        Execute complete academic year transition
        
        This is the main entry point for the transition process.
        All operations are performed within a single transaction.
        
        Args:
            db: Database session
            school_id: School ID for multi-tenancy
            source_year_id: Source academic year ID
            target_year_id: Target academic year ID
            class_mapping: Dict mapping source class names to target class names
            copy_course_enrollments: Whether to copy course enrollments
            
        Returns:
            Dict with transition statistics:
            - classes_created: Number of classes created
            - students_moved: Number of student memberships created
            - courses_created: Number of courses created (if enabled)
            - enrollments_copied: Number of enrollments copied (if enabled)
            - skipped_students: Number of students skipped
            
        Raises:
            HTTPException: If validation or operation fails
        """
        logger.info(
            f"Starting academic year transition from {source_year_id} "
            f"to {target_year_id} for school {school_id}"
        )
        
        # Step 1: Validate
        source_year, target_year, source_classes = cls.validate_transition(
            db, school_id, source_year_id, target_year_id, class_mapping
        )
        
        logger.info(
            f"Validation passed. Source: '{source_year.label}', "
            f"Target: '{target_year.label}'"
        )
        
        # Step 2: Clone classes
        class_id_map = cls.clone_classes(
            db, school_id, target_year_id, source_classes, class_mapping
        )
        
        classes_created = len(class_id_map)
        logger.info(f"Created {classes_created} classes")
        
        # Step 3: Copy student memberships
        students_moved, skipped_students = cls.copy_student_memberships(
            db, source_year_id, target_year_id, class_id_map
        )
        
        logger.info(
            f"Copied {students_moved} student memberships, "
            f"skipped {skipped_students}"
        )
        
        # Step 4: Optionally copy courses and enrollments
        courses_created = 0
        enrollments_copied = 0
        
        if copy_course_enrollments:
            courses_created, enrollments_copied = cls.copy_courses_and_enrollments(
                db, school_id, source_year_id, target_year_id
            )
            logger.info(
                f"Created {courses_created} courses and "
                f"copied {enrollments_copied} enrollments"
            )
        
        # Return statistics
        result = {
            "classes_created": classes_created,
            "students_moved": students_moved,
            "courses_created": courses_created,
            "enrollments_copied": enrollments_copied,
            "skipped_students": skipped_students,
        }
        
        logger.info(f"Transition completed successfully: {result}")
        
        return result

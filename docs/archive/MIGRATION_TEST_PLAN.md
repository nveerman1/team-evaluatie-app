# Legacy Tables Migration - Test Plan

## Overview
This document provides a comprehensive testing checklist for the migration from legacy `groups`/`group_members` tables to modern `CourseEnrollment`/`ProjectTeam` architecture.

## Pre-Test Setup
- [ ] Migration ran successfully: `alembic upgrade head`
- [ ] Verify tables dropped: `\dt groups` and `\dt group_members` should return "No relations found"
- [ ] Backend server starts without errors: `cd backend && python -m uvicorn app.main:app --reload`

---

## Phase 3: RBAC (Authorization) Tests

### Student Course Access
- [ ] **Test 1.1**: Student can access courses they are enrolled in
  - Login as student
  - Verify student sees only their enrolled courses
  - Check course list API: `GET /api/v1/courses`
  
- [ ] **Test 1.2**: Student cannot access courses they are NOT enrolled in
  - Try accessing a course the student is not enrolled in
  - Should return 403 Forbidden

- [ ] **Test 1.3**: Teacher can access assigned courses
  - Login as teacher
  - Verify teacher sees only courses they teach
  - Check course list filters correctly

- [ ] **Test 1.4**: Admin can access all courses in their school
  - Login as admin
  - Verify admin sees all courses in school
  - No access restrictions based on enrollment

---

## Phase 4: API Endpoints Tests

### Course Management (`courses.py`)

#### List Courses
- [ ] **Test 2.1**: List courses with student role
  - `GET /api/v1/courses` as student
  - Verify only enrolled courses appear
  - Check pagination works

- [ ] **Test 2.2**: List courses with teacher role
  - `GET /api/v1/courses` as teacher
  - Verify only assigned courses appear

- [ ] **Test 2.3**: List courses with filters
  - Test level filter: `GET /api/v1/courses?level=4`
  - Test year filter: `GET /api/v1/courses?year=2025`
  - Test search: `GET /api/v1/courses?search=Math`

#### Student Enrollment
- [ ] **Test 2.4**: Add student to course
  - `POST /api/v1/courses/{course_id}/students`
  - Verify CourseEnrollment record created
  - Check student appears in course roster

- [ ] **Test 2.5**: List students in course
  - `GET /api/v1/courses/{course_id}/students`
  - Verify all enrolled students appear
  - Check active/inactive status filtering

- [ ] **Test 2.6**: Re-enrolling inactive student
  - Add student who was previously inactive
  - Verify enrollment is reactivated
  - Check active flag is set to true

### OMZA Interface (`omza.py`)
- [ ] **Test 3.1**: Get OMZA data for evaluation
  - `GET /api/v1/omza/evaluations/{evaluation_id}/data`
  - Verify all enrolled students appear
  - Check peer scores calculated correctly

- [ ] **Test 3.2**: OMZA with course filter
  - Verify only students enrolled in course appear
  - No students from other courses included

### Projects (`projects.py`)

#### Team Information
- [ ] **Test 4.1**: List running projects with team info
  - `GET /api/v1/projects?status=active`
  - Verify team members shown correctly
  - Check team numbers displayed

- [ ] **Test 4.2**: Subproject with team assignment
  - View subproject details
  - Verify team members listed from ProjectTeam
  - Check team_number mapping correct

- [ ] **Test 4.3**: Create/update project teams
  - Create new project with teams
  - Verify ProjectTeam records created
  - Check team membership via ProjectTeamMember

### Overview (`overview.py`)

#### Project Assessments
- [ ] **Test 5.1**: List overview items
  - `GET /api/v1/overview/items`
  - Verify project assessments appear
  - Check team member names displayed

- [ ] **Test 5.2**: Filter by course
  - `GET /api/v1/overview/items?course_id={id}`
  - Verify only assessments for course projects appear

- [ ] **Test 5.3**: Filter by student
  - `GET /api/v1/overview/items?student_id={id}`
  - Verify only student's assessments appear

- [ ] **Test 5.4**: Export to CSV
  - Test CSV export functionality
  - Verify team information exported correctly

### External Assessments (`external_assessments.py`, `external_management.py`)

#### External Evaluator Flow
- [ ] **Test 6.1**: Create external assessment config
  - Create config for project with teams
  - Verify teams linked via ProjectTeam

- [ ] **Test 6.2**: Send external invitations
  - Send invitations to external evaluators
  - Check invitation tokens generated
  - Verify team assignments correct

- [ ] **Test 6.3**: External evaluator submission
  - Submit assessment as external evaluator
  - Verify assessment linked to correct team
  - Check scores saved correctly

### Allocations (`allocations.py`)
- [ ] **Test 7.1**: Create peer evaluation allocations
  - Create allocations for course
  - Verify all enrolled students included
  - Check allocation matrix correct

- [ ] **Test 7.2**: View student allocations
  - `GET /api/v1/allocations?student_id={id}`
  - Verify student sees correct reviewees

### Evaluations (`evaluations.py`)
- [ ] **Test 8.1**: Student access to evaluations
  - Student views their evaluations
  - Verify only allocated evaluations accessible
  - Check enrollment-based access works

### Dashboard (`dashboard.py`)
- [ ] **Test 9.1**: Student dashboard
  - View dashboard as student
  - Verify enrolled courses shown
  - Check assessment counts correct

- [ ] **Test 9.2**: Teacher dashboard
  - View dashboard as teacher
  - Verify assigned courses shown
  - Check student statistics correct

### Grades (`grades.py`)
- [ ] **Test 10.1**: Grade preview for course
  - `GET /api/v1/grades/preview?course_id={id}`
  - Verify all enrolled students listed
  - Check grade calculations correct

### Competencies (`competencies.py`)
- [ ] **Test 11.1**: Competency window student list
  - View competency window
  - Verify enrolled students appear
  - Check self-assessment access

### Learning Objectives (`learning_objectives.py`)
- [ ] **Test 12.1**: Learning objective tracking
  - View learning objectives for course
  - Verify student progress tracked
  - Check enrollment-based filtering

### Project Notes (`project_notes.py`)
- [ ] **Test 13.1**: Create team-specific note
  - Create note for project team
  - Verify team context saved
  - Check team members can access

### Project Assessments (`project_assessments.py`)
- [ ] **Test 14.1**: Create project assessment
  - Create assessment for project team
  - Verify linked to ProjectTeam
  - Check all team members associated

- [ ] **Test 14.2**: View project assessment
  - View assessment details
  - Verify team member list correct
  - Check scores display properly

### Student Overview (`student_overview.py`)
- [ ] **Test 15.1**: Student evaluation overview
  - `GET /api/v1/evaluations/{eval_id}/students/{user_id}/overview`
  - Verify student data loads
  - Check team_id/team_name are None (expected - teams now project-only)

### Reflections (`reflections_me.py`)
- [ ] **Test 16.1**: Student reflection access
  - Student views reflections
  - Verify enrollment-based access
  - Check reflection creation works

---

## Integration Tests

### End-to-End Workflows

#### Workflow 1: New Student Enrollment
1. [ ] Admin adds new student to course
2. [ ] Student logs in and sees course
3. [ ] Student can access course materials
4. [ ] Student appears in course roster
5. [ ] Student can be assigned to project team

#### Workflow 2: Project Assessment Flow
1. [ ] Teacher creates project for course
2. [ ] Teacher assigns students to project teams (ProjectTeam)
3. [ ] Teacher creates project assessment
4. [ ] Assessment linked to project team
5. [ ] All team members receive assessment
6. [ ] Grades calculated for team members

#### Workflow 3: Peer Evaluation Flow
1. [ ] Teacher creates peer evaluation
2. [ ] Allocations created for enrolled students
3. [ ] Students complete peer reviews
4. [ ] Results aggregated correctly
5. [ ] Grades calculated based on enrollments

#### Workflow 4: External Assessment Flow
1. [ ] Teacher creates external assessment config
2. [ ] Teams assigned via ProjectTeam
3. [ ] External invitations sent
4. [ ] External evaluators submit assessments
5. [ ] Results linked to correct project teams

---

## Regression Tests

### Data Integrity
- [ ] **Test 17.1**: Verify no orphaned data
  - Check all CourseEnrollment records valid
  - Verify ProjectTeam records link to valid projects
  - Check ProjectTeamMember records link to valid teams

- [ ] **Test 17.2**: Historical data access
  - Old project assessments still viewable
  - Past grades still accessible
  - Historical team information preserved in ProjectTeam

### Performance
- [ ] **Test 18.1**: Course list performance
  - Large number of courses loads quickly
  - Student filtering efficient

- [ ] **Test 18.2**: Student roster performance
  - Large course rosters load efficiently
  - Enrollment queries optimized

---

## Edge Cases

### Boundary Conditions
- [ ] **Test 19.1**: Empty course (no students)
  - Course with zero enrollments displays correctly
  - No errors when accessing empty course

- [ ] **Test 19.2**: Inactive enrollments
  - Inactive students don't appear in active lists
  - Can reactivate inactive enrollment

- [ ] **Test 19.3**: Multiple course enrollments
  - Student enrolled in multiple courses
  - Correct courses shown in each context

### Error Handling
- [ ] **Test 20.1**: Access denied scenarios
  - Student tries to access non-enrolled course
  - Returns 403 with clear message

- [ ] **Test 20.2**: Invalid enrollment attempts
  - Try to enroll non-student user
  - Appropriate error handling

---

## Database Verification

### Schema Changes
- [ ] **Test 21.1**: Verify tables dropped
  ```sql
  -- Should return "No relation found"
  \dt groups
  \dt group_members
  ```

- [ ] **Test 21.2**: Verify FK constraints removed
  ```sql
  -- Check project_teams.team_id no longer has FK to groups
  SELECT conname FROM pg_constraint WHERE conrelid = 'project_teams'::regclass AND conname LIKE '%group%';
  ```

- [ ] **Test 21.3**: Verify CourseEnrollment usage
  ```sql
  -- Should have enrollment records for all students
  SELECT COUNT(*) FROM course_enrollments WHERE active = true;
  ```

---

## Frontend Testing (if applicable)

### UI Components
- [ ] **Test 22.1**: Course selection dropdown
  - Students see only enrolled courses
  - Teachers see only assigned courses

- [ ] **Test 22.2**: Student roster display
  - Course student list displays correctly
  - Team member lists show properly

- [ ] **Test 22.3**: Assessment creation forms
  - Project assessment form works
  - Team selection uses ProjectTeam

---

## Rollback Testing (Optional)

### Migration Downgrade
- [ ] **Test 23.1**: Test downgrade (NOT recommended for production)
  ```bash
  alembic downgrade -1
  ```
  - Verify tables recreated
  - Check FK constraints restored
  - **NOTE**: Data will be lost - only test in dev environment

---

## Success Criteria

✅ **Migration Complete** when:
- [ ] All Phase 3 RBAC tests pass
- [ ] All Phase 4 API endpoint tests pass
- [ ] All integration workflows function correctly
- [ ] No regression in existing functionality
- [ ] Performance is acceptable
- [ ] All edge cases handled properly
- [ ] Database schema verified correct

---

## Test Execution Notes

**Priority Levels:**
- 🔴 **Critical**: Tests 1.x, 2.x, 4.x, 5.x, 14.x (Core functionality)
- 🟡 **High**: Tests 3.x, 6.x, 7.x, 10.x (Important features)
- 🟢 **Medium**: Tests 8.x, 9.x, 11.x, 12.x, 13.x, 15.x, 16.x (Supporting features)
- ⚪ **Low**: Tests 17.x-23.x (Verification and edge cases)

**Recommended Test Order:**
1. Start with Critical tests (RBAC and core endpoints)
2. Move to High priority (key features)
3. Run integration workflows
4. Complete Medium priority tests
5. Finish with verification and edge cases

---

## Automated Test Commands

If automated tests exist, run:

```bash
# Backend tests
cd backend
pytest tests/ -v

# Specific test files
pytest tests/test_rbac.py -v
pytest tests/test_courses_api.py -v
pytest tests/test_course_enrollment_backfill.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

---

## Issue Reporting

If issues found during testing:
1. Document the test case that failed
2. Note the expected vs actual behavior
3. Check logs for error messages
4. Verify database state
5. Report with reproduction steps

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-20  
**Migration Status:** Phase 5 Complete - Ready for Testing

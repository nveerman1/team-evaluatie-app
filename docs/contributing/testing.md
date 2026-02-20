# Testing Guide

This guide covers testing strategies, setup, and examples for both the backend (Python/FastAPI) and frontend (TypeScript/Next.js) of the Team Evaluatie App.

## Table of Contents

1. [Overview](#overview)
2. [Backend Testing (Python)](#backend-testing-python)
3. [Frontend Testing (TypeScript)](#frontend-testing-typescript)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Best Practices](#best-practices)

---

## Overview

### Testing Philosophy

The Team Evaluatie App follows a pragmatic testing approach:

- **Unit tests**: Test individual functions and methods in isolation
- **Integration tests**: Test API endpoints and service interactions
- **Manual testing**: For UI/UX validation and exploratory testing

### Test Coverage Goals

- **Backend**: >80% code coverage for services and API endpoints
- **Frontend**: Focus on critical user flows and business logic
- **Security**: All authentication and authorization paths tested

---

## Backend Testing (Python)

The backend uses **pytest** as the testing framework with **SQLAlchemy** for database interactions.

### Setup

#### Installation

```bash
cd backend
pip install -r requirements-dev.txt
```

Development dependencies include:
- `pytest` - Test framework
- `pytest-cov` - Coverage reporting
- `pytest-asyncio` - Async test support
- `httpx` - HTTP client for API testing
- `faker` - Test data generation

#### Test Configuration

```python
# backend/tests/conftest.py
"""
Pytest configuration and shared fixtures.

This module provides:
- Database session fixtures
- Test user fixtures
- API client fixtures
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from app.main import app
from app.db.base import Base
from app.db.session import get_db
from app.db.models import User, School, AcademicYear
from app.core.security import create_access_token

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def db_engine():
    """
    Creates a fresh database engine for each test.
    
    Yields:
        Engine: SQLAlchemy engine instance
    """
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine):
    """
    Creates a database session for each test.
    
    The session is automatically rolled back after the test completes,
    ensuring test isolation.
    
    Args:
        db_engine: Database engine fixture
        
    Yields:
        Session: SQLAlchemy session instance
    """
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=db_engine
    )
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()


@pytest.fixture(scope="function")
def test_school(db_session: Session):
    """
    Creates a test school.
    
    Args:
        db_session: Database session fixture
        
    Returns:
        School: Test school instance
    """
    school = School(
        name="Test School",
        subdomain="test",
        is_active=True
    )
    db_session.add(school)
    db_session.commit()
    db_session.refresh(school)
    return school


@pytest.fixture(scope="function")
def test_user(db_session: Session, test_school: School):
    """
    Creates a test user (teacher).
    
    Args:
        db_session: Database session fixture
        test_school: Test school fixture
        
    Returns:
        User: Test user instance
    """
    user = User(
        email="teacher@test.nl",
        name="Test Teacher",
        role="teacher",
        school_id=test_school.id,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(test_user: User):
    """
    Creates authentication headers with JWT token.
    
    Args:
        test_user: Test user fixture
        
    Returns:
        dict: Headers dictionary with Authorization header
    """
    token = create_access_token(data={
        "sub": test_user.email,
        "user_id": test_user.id,
        "school_id": test_user.school_id,
        "role": test_user.role
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="function")
def client(db_session: Session):
    """
    Creates a FastAPI test client with database override.
    
    Args:
        db_session: Database session fixture
        
    Returns:
        TestClient: FastAPI test client instance
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
```

### Running Tests

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_api_endpoints.py

# Run specific test class or function
pytest tests/test_api_endpoints.py::TestCourseEndpoints::test_list_courses

# Run with coverage
pytest --cov=app --cov-report=html

# Run with verbose output
pytest -v

# Run only failed tests from last run
pytest --lf

# Run tests matching a keyword
pytest -k "course"
```

### Unit Test Examples

#### Testing a Service Function

```python
# backend/tests/test_evaluation_service.py
"""
Tests for evaluation service.
"""

import pytest
from datetime import datetime, timedelta
from app.services.evaluation_service import EvaluationService
from app.db.models import Evaluation, Project, Course


class TestEvaluationService:
    """Test suite for EvaluationService."""
    
    def test_create_evaluation(self, db_session, test_user, test_school):
        """
        Test creating a new evaluation.
        
        Verifies that:
        - Evaluation is created with correct data
        - Dates are properly set
        - Evaluation is linked to project
        """
        # Arrange
        course = Course(
            school_id=test_school.id,
            code="TEST",
            name="Test Course",
            is_active=True
        )
        db_session.add(course)
        db_session.flush()
        
        project = Project(
            course_id=course.id,
            name="Test Project",
            start_date=datetime.utcnow().date(),
            end_date=(datetime.utcnow() + timedelta(days=30)).date()
        )
        db_session.add(project)
        db_session.commit()
        
        service = EvaluationService(db_session)
        
        # Act
        evaluation = service.create_evaluation(
            project_id=project.id,
            name="Midterm Evaluation",
            evaluation_type="peer",
            open_date=datetime.utcnow(),
            close_date=datetime.utcnow() + timedelta(days=7)
        )
        
        # Assert
        assert evaluation.id is not None
        assert evaluation.project_id == project.id
        assert evaluation.name == "Midterm Evaluation"
        assert evaluation.status == "open"
        assert evaluation.evaluation_type == "peer"
    
    def test_freeze_evaluation(self, db_session, test_user):
        """
        Test freezing an evaluation.
        
        Verifies that:
        - Status changes to 'frozen'
        - Team rosters are captured
        - Students can no longer submit
        """
        # Arrange
        evaluation = Evaluation(
            project_id=1,
            name="Test Evaluation",
            status="open",
            evaluation_type="peer"
        )
        db_session.add(evaluation)
        db_session.commit()
        
        service = EvaluationService(db_session)
        
        # Act
        frozen_evaluation = service.freeze_evaluation(evaluation.id)
        
        # Assert
        assert frozen_evaluation.status == "frozen"
    
    def test_cannot_submit_after_close_date(self, db_session):
        """
        Test that submissions are rejected after close date.
        
        Verifies that:
        - Evaluation past close_date raises exception
        - Error message is descriptive
        """
        # Arrange
        evaluation = Evaluation(
            project_id=1,
            name="Closed Evaluation",
            status="closed",
            close_date=datetime.utcnow() - timedelta(days=1)
        )
        db_session.add(evaluation)
        db_session.commit()
        
        service = EvaluationService(db_session)
        
        # Act & Assert
        with pytest.raises(ValueError, match="Evaluation is closed"):
            service.submit_score(
                evaluation_id=evaluation.id,
                evaluator_id=1,
                evaluatee_id=2,
                scores=[]
            )
```

#### Testing API Endpoints

```python
# backend/tests/test_course_api.py
"""
Tests for course API endpoints.
"""

import pytest
from fastapi.testclient import TestClient


class TestCourseEndpoints:
    """Test suite for /api/v1/courses endpoints."""
    
    def test_list_courses_as_teacher(self, client, auth_headers, test_user, test_school):
        """
        Test listing courses as a teacher.
        
        Verifies that:
        - Teacher can access course list
        - Only assigned courses are returned
        - Response includes teacher names
        """
        # Arrange
        from app.db.models import Course, TeacherCourse
        
        # Create courses via database
        course1 = Course(
            school_id=test_school.id,
            code="O&O",
            name="Onderzoek & Ontwerpen",
            is_active=True
        )
        course2 = Course(
            school_id=test_school.id,
            code="BIO",
            name="Biology",
            is_active=True
        )
        db_session = client.app.dependency_overrides[get_db]().__next__()
        db_session.add_all([course1, course2])
        db_session.commit()
        
        # Assign only course1 to teacher
        assignment = TeacherCourse(
            teacher_id=test_user.id,
            course_id=course1.id,
            is_active=True
        )
        db_session.add(assignment)
        db_session.commit()
        
        # Act
        response = client.get("/api/v1/courses", headers=auth_headers)
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["courses"]) == 1
        assert data["courses"][0]["code"] == "O&O"
    
    def test_create_course_as_admin(self, client, test_school):
        """
        Test creating a course as an admin.
        
        Verifies that:
        - Admin can create courses
        - Course data is properly saved
        - Response includes created course
        """
        # Arrange
        admin_user = User(
            email="admin@test.nl",
            name="Admin User",
            role="admin",
            school_id=test_school.id,
            is_active=True
        )
        db_session = client.app.dependency_overrides[get_db]().__next__()
        db_session.add(admin_user)
        db_session.commit()
        
        admin_token = create_access_token(data={
            "sub": admin_user.email,
            "user_id": admin_user.id,
            "school_id": admin_user.school_id,
            "role": admin_user.role
        })
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        course_data = {
            "code": "MATH",
            "name": "Mathematics",
            "description": "Math course",
            "level": "onderbouw",
            "year": 1
        }
        
        # Act
        response = client.post(
            "/api/v1/courses",
            json=course_data,
            headers=admin_headers
        )
        
        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "MATH"
        assert data["name"] == "Mathematics"
        assert data["school_id"] == test_school.id
    
    def test_student_cannot_create_course(self, client, test_school):
        """
        Test that students cannot create courses.
        
        Verifies that:
        - Student role is rejected
        - Returns 403 Forbidden
        """
        # Arrange
        student_user = User(
            email="student@test.nl",
            name="Student User",
            role="student",
            school_id=test_school.id,
            is_active=True
        )
        db_session = client.app.dependency_overrides[get_db]().__next__()
        db_session.add(student_user)
        db_session.commit()
        
        student_token = create_access_token(data={
            "sub": student_user.email,
            "user_id": student_user.id,
            "school_id": student_user.school_id,
            "role": student_user.role
        })
        student_headers = {"Authorization": f"Bearer {student_token}"}
        
        course_data = {
            "code": "TEST",
            "name": "Test Course"
        }
        
        # Act
        response = client.post(
            "/api/v1/courses",
            json=course_data,
            headers=student_headers
        )
        
        # Assert
        assert response.status_code == 403
```

### Test Data Generation

```python
# backend/tests/factories.py
"""
Test data factories for generating realistic test data.
"""

from faker import Faker
from app.db.models import User, Course, Project, Evaluation

fake = Faker()

def create_test_user(
    db_session,
    school_id: int,
    role: str = "student",
    **kwargs
) -> User:
    """
    Creates a test user with random data.
    
    Args:
        db_session: Database session
        school_id: School ID
        role: User role (default: "student")
        **kwargs: Additional user attributes
        
    Returns:
        User: Created user instance
    """
    user = User(
        email=kwargs.get("email", fake.email()),
        name=kwargs.get("name", fake.name()),
        role=role,
        school_id=school_id,
        is_active=True,
        **kwargs
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def create_test_course(
    db_session,
    school_id: int,
    **kwargs
) -> Course:
    """
    Creates a test course with random data.
    
    Args:
        db_session: Database session
        school_id: School ID
        **kwargs: Additional course attributes
        
    Returns:
        Course: Created course instance
    """
    course = Course(
        school_id=school_id,
        code=kwargs.get("code", fake.lexify(text="???").upper()),
        name=kwargs.get("name", fake.catch_phrase()),
        description=kwargs.get("description", fake.paragraph()),
        is_active=True,
        **kwargs
    )
    db_session.add(course)
    db_session.commit()
    db_session.refresh(course)
    return course
```

---

## Frontend Testing (TypeScript)

The frontend would use **Jest** and **React Testing Library** for component and integration testing.

### Setup (Future Implementation)

```bash
cd frontend
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### Example Component Test

```typescript
// frontend/src/components/CourseCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CourseCard } from './CourseCard';
import { Course } from '@/dtos/course.dto';

/**
 * Test suite for CourseCard component.
 */
describe('CourseCard', () => {
  const mockCourse: Course = {
    id: 1,
    code: 'O&O',
    name: 'Onderzoek & Ontwerpen',
    description: 'Project-based learning',
    level: 'onderbouw',
    year: 2,
    isActive: true,
    academicYearId: 1,
    teacherNames: ['John Doe'],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  };

  /**
   * Test that course information is displayed correctly.
   */
  it('renders course information', () => {
    render(<CourseCard course={mockCourse} />);

    expect(screen.getByText('O&O')).toBeInTheDocument();
    expect(screen.getByText('Onderzoek & Ontwerpen')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  /**
   * Test that clicking the card triggers the onClick handler.
   */
  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<CourseCard course={mockCourse} onClick={handleClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledWith(mockCourse);
  });

  /**
   * Test that inactive courses are displayed with muted styling.
   */
  it('renders inactive courses with muted styling', () => {
    const inactiveCourse = { ...mockCourse, isActive: false };
    render(<CourseCard course={inactiveCourse} />);

    const card = screen.getByRole('button');
    expect(card).toHaveClass('opacity-50');
  });
});
```

---

## Integration Testing

Integration tests verify that multiple components work together correctly.

### API Integration Test Example

```python
# backend/tests/test_evaluation_flow.py
"""
Integration tests for the complete evaluation flow.
"""

import pytest
from datetime import datetime, timedelta


class TestEvaluationFlow:
    """
    Test complete evaluation workflow.
    
    Tests the following flow:
    1. Create course
    2. Create project
    3. Create evaluation
    4. Students submit scores
    5. Freeze evaluation
    6. Calculate grades
    7. Close evaluation
    """
    
    def test_complete_evaluation_workflow(
        self,
        client,
        test_school,
        db_session
    ):
        """
        Test complete evaluation workflow from creation to grading.
        
        Verifies:
        - All steps complete successfully
        - Data is consistent across steps
        - Permissions are enforced
        """
        # 1. Create teacher and students
        teacher = create_test_user(db_session, test_school.id, role="teacher")
        student1 = create_test_user(db_session, test_school.id, role="student")
        student2 = create_test_user(db_session, test_school.id, role="student")
        
        teacher_token = create_access_token(data={
            "sub": teacher.email,
            "user_id": teacher.id,
            "school_id": teacher.school_id,
            "role": teacher.role
        })
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        
        # 2. Create course
        course_response = client.post(
            "/api/v1/courses",
            json={"code": "TEST", "name": "Test Course"},
            headers=teacher_headers
        )
        assert course_response.status_code == 201
        course_id = course_response.json()["id"]
        
        # 3. Create project
        project_response = client.post(
            f"/api/v1/courses/{course_id}/projects",
            json={
                "name": "Test Project",
                "start_date": datetime.utcnow().isoformat(),
                "end_date": (datetime.utcnow() + timedelta(days=30)).isoformat()
            },
            headers=teacher_headers
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]
        
        # 4. Create evaluation
        eval_response = client.post(
            "/api/v1/evaluations",
            json={
                "project_id": project_id,
                "name": "Midterm Evaluation",
                "evaluation_type": "peer",
                "open_date": datetime.utcnow().isoformat(),
                "close_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
            },
            headers=teacher_headers
        )
        assert eval_response.status_code == 201
        eval_id = eval_response.json()["id"]
        
        # 5. Students submit scores
        student1_token = create_access_token(data={
            "sub": student1.email,
            "user_id": student1.id,
            "school_id": student1.school_id,
            "role": student1.role
        })
        student1_headers = {"Authorization": f"Bearer {student1_token}"}
        
        score_response = client.post(
            f"/api/v1/evaluations/{eval_id}/scores",
            json={
                "evaluator_id": student1.id,
                "evaluatee_id": student2.id,
                "scores": [
                    {"criterion_id": 1, "score": 8, "comment": "Good work"}
                ]
            },
            headers=student1_headers
        )
        assert score_response.status_code == 201
        
        # 6. Teacher freezes evaluation
        freeze_response = client.post(
            f"/api/v1/evaluations/{eval_id}/freeze",
            headers=teacher_headers
        )
        assert freeze_response.status_code == 200
        
        # 7. Verify evaluation status
        eval_status = client.get(
            f"/api/v1/evaluations/{eval_id}",
            headers=teacher_headers
        )
        assert eval_status.json()["status"] == "frozen"
```

---

## End-to-End Testing

E2E tests verify complete user workflows using tools like Playwright or Cypress (not currently implemented).

### Example E2E Test Plan

```typescript
// Example Playwright test (not implemented)
// frontend/tests/e2e/teacher-evaluation-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Teacher Evaluation Flow', () => {
  test('create and manage evaluation', async ({ page }) => {
    // Login as teacher
    await page.goto('/login');
    await page.fill('[name="email"]', 'teacher@test.nl');
    await page.click('button[type="submit"]');
    
    // Navigate to courses
    await page.click('text=Courses');
    await expect(page).toHaveURL('/teacher/courses');
    
    // Select a course
    await page.click('text=Onderzoek & Ontwerpen');
    
    // Create evaluation
    await page.click('text=New Evaluation');
    await page.fill('[name="name"]', 'Midterm Evaluation');
    await page.click('button:has-text("Create")');
    
    // Verify evaluation created
    await expect(page.locator('text=Midterm Evaluation')).toBeVisible();
  });
});
```

---

## Best Practices

### General Testing Guidelines

1. **Write Descriptive Test Names**: Use clear, descriptive names that explain what is being tested
2. **Follow AAA Pattern**: Arrange, Act, Assert
3. **Test One Thing**: Each test should verify one specific behavior
4. **Use Fixtures**: Share common test setup using fixtures
5. **Mock External Dependencies**: Mock APIs, databases, and external services
6. **Test Edge Cases**: Test boundary conditions and error scenarios
7. **Keep Tests Fast**: Tests should run quickly to encourage frequent execution

### Backend Testing Best Practices

```python
# Good: Clear test name and single assertion
def test_course_creation_requires_authentication(client):
    """Test that creating a course without auth returns 401."""
    response = client.post("/api/v1/courses", json={"code": "TEST"})
    assert response.status_code == 401

# Bad: Unclear name and multiple unrelated assertions
def test_courses(client):
    response = client.get("/api/v1/courses")
    assert response.status_code == 200
    response = client.post("/api/v1/courses", json={})
    assert response.status_code == 401
```

### Testing Security

Always test authorization and authentication:

```python
def test_student_cannot_delete_course(client, test_student, test_course):
    """Test that students cannot delete courses (403 Forbidden)."""
    student_headers = create_auth_headers(test_student)
    response = client.delete(
        f"/api/v1/courses/{test_course.id}",
        headers=student_headers
    )
    assert response.status_code == 403

def test_user_can_only_access_own_school_data(client, test_user):
    """Test multi-tenant isolation: users can't access other schools' data."""
    other_school = create_test_school(db_session, name="Other School")
    other_course = create_test_course(db_session, school_id=other_school.id)
    
    user_headers = create_auth_headers(test_user)
    response = client.get(
        f"/api/v1/courses/{other_course.id}",
        headers=user_headers
    )
    assert response.status_code == 404  # Course not found (filtered by school_id)
```

### Continuous Integration

Tests run automatically on every pull request via GitHub Actions:

```yaml
# .github/workflows/ci.yml
- name: Run backend tests
  run: |
    cd backend
    pytest --cov=app --cov-report=xml
```

---

## Related Documentation

- [Code Structure](./code_structure.md) - Codebase organization
- [API Documentation](./api_docs.md) - API reference with examples
- [CI/CD Guide](./ci_cd.md) - Continuous integration setup
- [Development Guide](../README.md#development) - Local development setup

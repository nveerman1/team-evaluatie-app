# Code Structure

This document provides an overview of the codebase organization for the Team Evaluatie App, covering both backend and frontend architectures.

## Repository Overview

The repository follows a monorepo structure with clear separation between backend, frontend, operations, and scripts:

```
team-evaluatie-app/
├── backend/           # FastAPI Python backend
├── frontend/          # Next.js TypeScript frontend
├── ops/               # Operations and deployment configs
├── scripts/           # Utility scripts
├── docs/              # Documentation
└── .github/           # GitHub Actions CI/CD
```

## Language Distribution

- **TypeScript**: 54.1% (Frontend)
- **Python**: 44.3% (Backend)
- **Shell**: 1.5% (Scripts)
- **Docker**: 0.1% (Containerization)

---

## Backend Structure (`backend/`)

The backend is a **FastAPI** application written in Python, following a layered architecture pattern.

### Directory Layout

```
backend/
├── app/
│   ├── api/                    # API endpoints (routers)
│   │   └── v1/                 # API version 1
│   │       ├── auth.py
│   │       ├── courses.py
│   │       ├── evaluations.py
│   │       ├── projects.py
│   │       ├── scores.py
│   │       └── ...
│   ├── core/                   # Core configuration
│   │   ├── auth.py            # Authentication logic
│   │   ├── config.py          # Application settings
│   │   ├── security.py        # Security utilities
│   │   └── rate_limit.py      # Rate limiting
│   ├── db/                     # Database layer
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── session.py         # Database session management
│   │   └── base.py            # Base model classes
│   ├── services/               # Business logic services
│   │   ├── evaluation_service.py
│   │   ├── score_service.py
│   │   ├── ai_summary_service.py
│   │   └── ...
│   ├── infra/                  # Infrastructure services
│   │   ├── redis.py           # Redis client
│   │   ├── email.py           # Email service
│   │   └── storage.py         # File storage
│   ├── integrations/           # External integrations
│   │   └── somtoday/          # Somtoday integration (placeholder)
│   └── main.py                 # Application entry point
├── migrations/                 # Alembic database migrations
│   └── versions/
├── scripts/                    # Utility scripts
│   ├── seed.py                # Database seeding
│   └── ...
├── tests/                      # Pytest test suite
│   ├── conftest.py            # Pytest configuration
│   ├── test_api_endpoints.py
│   └── ...
├── worker.py                   # RQ background worker
├── scheduler.py                # Cron job scheduler
├── requirements.txt            # Production dependencies
├── requirements-dev.txt        # Development dependencies
└── alembic.ini                # Alembic configuration
```

### Key Components

#### 1. API Layer (`app/api/`)

RESTful API endpoints organized by resource:

- **Authentication** (`auth.py`): Login, logout, token management
- **Courses** (`courses.py`): Course CRUD, teacher assignment
- **Evaluations** (`evaluations.py`): Evaluation lifecycle management
- **Projects** (`projects.py`): Project and team management
- **Scores** (`scores.py`): Score submission and retrieval

**Example API endpoint structure:**

```python
# app/api/v1/courses.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/courses")
async def list_courses(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List all courses for the current user's school.
    
    Args:
        db: Database session
        current_user: Authenticated user from JWT token
        
    Returns:
        List of course objects
    """
    # Implementation
    pass
```

#### 2. Core Layer (`app/core/`)

Application configuration and cross-cutting concerns:

- **config.py**: Environment-based settings using Pydantic
- **auth.py**: JWT token generation/validation, Azure AD integration
- **security.py**: Password hashing, CSRF protection
- **rate_limit.py**: Redis-backed rate limiting

#### 3. Database Layer (`app/db/`)

SQLAlchemy ORM models and database management:

- **models.py**: Database table definitions
- **session.py**: Database connection pooling
- Multi-tenant data isolation via `school_id`

**Example model with docstring:**

```python
# app/db/models.py
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

class Course(Base):
    """
    Represents a course offering within a school's academic year.
    
    Attributes:
        id: Primary key
        school_id: Foreign key to School (multi-tenant isolation)
        academic_year_id: Foreign key to AcademicYear
        code: Course code (e.g., "O&O", "XPLR")
        name: Human-readable course name
        is_active: Soft delete flag
        
    Relationships:
        school: Many-to-one with School
        academic_year: Many-to-one with AcademicYear
        projects: One-to-many with Project
        enrollments: One-to-many with CourseEnrollment
    """
    __tablename__ = "courses"
    
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey("schools.id"), nullable=False)
    code = Column(String(50), nullable=False)
    name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True)
```

#### 4. Services Layer (`app/services/`)

Business logic encapsulation:

- **evaluation_service.py**: Evaluation creation, freezing, closing
- **score_service.py**: Score validation, aggregation, grading
- **ai_summary_service.py**: AI-powered feedback summarization

#### 5. Background Jobs

- **worker.py**: RQ (Redis Queue) worker for async tasks
- **scheduler.py**: Cron job scheduler for periodic tasks

---

## Frontend Structure (`frontend/`)

The frontend is a **Next.js 15** application written in TypeScript, using the App Router.

### Directory Layout

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/            # Authentication pages
│   │   │   └── login/
│   │   ├── student/           # Student dashboard
│   │   │   ├── dashboard/
│   │   │   ├── evaluations/
│   │   │   └── competencies/
│   │   ├── teacher/           # Teacher dashboard
│   │   │   ├── dashboard/
│   │   │   ├── courses/
│   │   │   ├── projects/
│   │   │   └── evaluations/
│   │   ├── admin/             # Admin dashboard
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Landing page
│   ├── components/             # Reusable React components
│   │   ├── ui/                # Base UI components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   ├── layout/            # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   └── features/          # Feature-specific components
│   │       ├── evaluation/
│   │       ├── project/
│   │       └── competency/
│   ├── services/               # API client services
│   │   ├── api.ts             # Base API client (Axios)
│   │   ├── course.service.ts
│   │   ├── evaluation.service.ts
│   │   └── ...
│   ├── dtos/                   # Data Transfer Objects
│   │   ├── course.dto.ts
│   │   ├── evaluation.dto.ts
│   │   └── ...
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useCourses.ts
│   │   └── ...
│   ├── utils/                  # Utility functions
│   │   ├── date.utils.ts
│   │   ├── array.utils.ts
│   │   └── ...
│   ├── lib/                    # Third-party library configs
│   │   └── utils.ts           # Class name utilities
│   ├── styles/                 # Global styles
│   │   └── globals.css
│   └── middleware.ts           # Next.js middleware (auth)
├── public/                     # Static assets
│   ├── images/
│   └── ...
├── package.json                # Dependencies
├── tsconfig.json              # TypeScript configuration
├── next.config.ts             # Next.js configuration
└── tailwind.config.js         # Tailwind CSS configuration
```

### Key Components

#### 1. App Router (`src/app/`)

File-based routing using Next.js 15 App Router:

- **Route groups**: `(auth)` for authentication pages
- **Dynamic routes**: `[id]` for dynamic segments
- **Layouts**: Nested layouts for role-based UIs
- **Server components**: Default for performance
- **Client components**: Use `'use client'` directive

**Example page with JSDoc:**

```typescript
// src/app/teacher/courses/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { courseService } from '@/services/course.service';
import { Course } from '@/dtos/course.dto';

/**
 * Teacher Courses Page
 * 
 * Displays all courses assigned to the current teacher.
 * Teachers can view course details, manage projects, and create evaluations.
 * 
 * @component
 * @returns {JSX.Element} Courses list page
 */
export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    loadCourses();
  }, []);

  /**
   * Loads courses for the current teacher from the API.
   * Filters courses by the teacher's assignments and active status.
   */
  const loadCourses = async () => {
    try {
      const data = await courseService.getTeacherCourses();
      setCourses(data);
    } catch (error) {
      console.error('Failed to load courses:', error);
    }
  };

  return (
    <div>
      <h1>My Courses</h1>
      {/* Component implementation */}
    </div>
  );
}
```

#### 2. Components (`src/components/`)

Organized by type:

- **ui/**: Base components from shadcn/ui (Button, Card, Dialog, etc.)
- **layout/**: Header, Sidebar, Footer
- **features/**: Domain-specific components (EvaluationCard, ProjectForm, etc.)

#### 3. Services (`src/services/`)

API client layer using Axios:

**Example service with JSDoc:**

```typescript
// src/services/course.service.ts
import { apiClient } from './api';
import { Course, CreateCourseDto } from '@/dtos/course.dto';

/**
 * Service for course-related API operations.
 * Provides methods for CRUD operations on courses.
 */
class CourseService {
  private readonly basePath = '/api/v1/courses';

  /**
   * Fetches all courses for the current user's school.
   * 
   * @returns {Promise<Course[]>} Array of course objects
   * @throws {Error} If the API request fails
   */
  async getCourses(): Promise<Course[]> {
    const response = await apiClient.get<Course[]>(this.basePath);
    return response.data;
  }

  /**
   * Creates a new course.
   * 
   * @param {CreateCourseDto} courseData - Course data to create
   * @returns {Promise<Course>} Created course object
   * @throws {Error} If validation fails or API request fails
   */
  async createCourse(courseData: CreateCourseDto): Promise<Course> {
    const response = await apiClient.post<Course>(this.basePath, courseData);
    return response.data;
  }
}

export const courseService = new CourseService();
```

#### 4. DTOs (`src/dtos/`)

TypeScript interfaces for type safety:

```typescript
// src/dtos/course.dto.ts

/**
 * Represents a course in the system.
 */
export interface Course {
  /** Unique identifier */
  id: number;
  /** Course code (e.g., "O&O", "XPLR") */
  code: string;
  /** Human-readable course name */
  name: string;
  /** Academic year ID */
  academicYearId: number;
  /** Whether the course is active */
  isActive: boolean;
}

/**
 * Data required to create a new course.
 */
export interface CreateCourseDto {
  code: string;
  name: string;
  academicYearId: number;
}
```

---

## Operations Structure (`ops/`)

Deployment and infrastructure configurations:

```
ops/
├── docker/                     # Docker configurations
│   ├── compose.dev.yml        # Development environment
│   ├── compose.prod.yml       # Production environment
│   ├── Dockerfile.backend     # Backend container
│   └── Dockerfile.frontend    # Frontend container
├── nginx/                      # Nginx reverse proxy configs
│   ├── nginx.conf             # Main configuration
│   └── ssl/                   # SSL certificates
└── scripts/                    # Deployment scripts
    ├── deploy.sh              # Production deployment
    └── backup.sh              # Database backup
```

---

## Scripts (`scripts/`)

Utility scripts for development and maintenance:

```
scripts/
├── seed_data.sh               # Seed database script
├── run_tests.sh               # Run all tests
└── health_check.sh            # Service health check
```

---

## Testing Structure

### Backend Tests (`backend/tests/`)

Using **pytest** with fixtures:

```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.base import Base

@pytest.fixture
def db_session():
    """
    Creates a clean database session for each test.
    
    Yields:
        Session: SQLAlchemy database session
    """
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
```

### Frontend Tests

Frontend testing setup would use **Jest** and **React Testing Library** (not currently implemented).

---

## Configuration Files

### Backend Configuration

- **alembic.ini**: Database migration configuration
- **requirements.txt**: Production dependencies
- **requirements-dev.txt**: Development dependencies (pytest, black, ruff, mypy)
- **.env.example**: Environment variable template

### Frontend Configuration

- **next.config.ts**: Next.js configuration (standalone output, rewrites)
- **tsconfig.json**: TypeScript compiler options
- **tailwind.config.js**: Tailwind CSS configuration
- **eslint.config.mjs**: ESLint rules

---

## Development Workflow

1. **Start database**: `make up` (Docker Compose)
2. **Backend**: `cd backend && uvicorn app.main:app --reload`
3. **Frontend**: `cd frontend && pnpm dev`
4. **Tests**: `cd backend && pytest`
5. **Linting**: `ruff check .` (backend), `pnpm lint` (frontend)
6. **Formatting**: `black .` (backend)

---

## Related Documentation

- [Architecture Overview](./architecture.md) - System design and data model
- [API Documentation](./api_docs.md) - Detailed API reference
- [Testing Guide](./testing.md) - Testing strategies and examples
- [Deployment Guide](./deployment.md) - Production deployment instructions

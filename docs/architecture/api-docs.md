# API Documentation

This document provides comprehensive API documentation for the Team Evaluatie App REST API, including authentication, request/response examples in TypeScript and Python, and common usage patterns.

## Base URL

```
Development: http://localhost:8000
Production: https://your-domain.com
```

## API Version

All API endpoints are prefixed with `/api/v1/`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Core Endpoints](#core-endpoints)
   - [Courses](#courses)
   - [Projects](#projects)
   - [Evaluations](#evaluations)
   - [Scores](#scores)
   - [Users](#users)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [TypeScript Examples](#typescript-examples)
6. [Python Examples](#python-examples)

---

## Authentication

The API uses **JWT (JSON Web Tokens)** for authentication with support for multiple authentication methods.

### Authentication Methods

1. **Azure AD (Production)**: OAuth 2.0 with Microsoft
2. **Dev Login (Development only)**: Simple email-based authentication

### Authentication Flow

```
1. User → GET /api/v1/auth/azure?school_id=1 → Backend
2. Backend → Redirect to Microsoft OAuth → User
3. User → Authenticate with Microsoft → Microsoft
4. Microsoft → Redirect to /api/v1/auth/azure/callback?code=... → Backend
5. Backend → Set JWT cookie + Redirect to dashboard → User
```

### JWT Token

- **Storage**: HttpOnly cookie (secure, SameSite=Lax)
- **Lifetime**: 24 hours (configurable)
- **Claims**: `user_id`, `school_id`, `role`, `email`

### API Endpoints

#### Get Current User

```http
GET /api/v1/auth/me
```

**Response:**
```json
{
  "id": 1,
  "email": "teacher@school.nl",
  "name": "John Doe",
  "role": "teacher",
  "school_id": 1,
  "class_name": null
}
```

#### Initiate Azure AD Login

```http
GET /api/v1/auth/azure?school_id=1&return_to=/teacher/courses
```

Redirects to Microsoft OAuth login page.

#### Logout

```http
POST /api/v1/auth/logout
```

Clears authentication cookie and redirects to login page.

---

## Core Endpoints

### Courses

Courses represent subjects taught within a school's academic year (e.g., "O&O", "XPLR", "Biology").

#### List Courses

```http
GET /api/v1/courses?page=1&per_page=20&is_active=true
```

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `per_page` (integer, default: 20, max: 100): Items per page
- `level` (string, optional): Filter by level (e.g., "onderbouw", "bovenbouw")
- `year` (integer, optional): Filter by year
- `is_active` (boolean, default: true): Filter by active status
- `search` (string, optional): Search in name, code, or description

**Authorization:**
- **Admin**: All courses in school
- **Teacher**: Only assigned courses
- **Student**: Only enrolled courses

**Response:**
```json
{
  "courses": [
    {
      "id": 1,
      "school_id": 1,
      "code": "O&O",
      "name": "Onderzoek & Ontwerpen",
      "description": "Project-based learning course",
      "level": "onderbouw",
      "year": 2,
      "period": null,
      "is_active": true,
      "academic_year_id": 1,
      "academic_year_label": "2025-2026",
      "subject_id": 1,
      "teacher_names": ["John Doe", "Jane Smith"],
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 5,
  "page": 1,
  "per_page": 20
}
```

#### Get Single Course

```http
GET /api/v1/courses/{course_id}
```

**Response:**
```json
{
  "id": 1,
  "school_id": 1,
  "code": "O&O",
  "name": "Onderzoek & Ontwerpen",
  "description": "Project-based learning course",
  "level": "onderbouw",
  "year": 2,
  "is_active": true,
  "academic_year_id": 1,
  "teacher_names": ["John Doe"],
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

#### Create Course

```http
POST /api/v1/courses
```

**Authorization:** Admin or Teacher (with appropriate permissions)

**Request Body:**
```json
{
  "code": "BIO",
  "name": "Biology",
  "description": "Biology course for grade 3",
  "level": "bovenbouw",
  "year": 3,
  "period": "Q1",
  "academic_year_id": 1,
  "subject_id": 2
}
```

**Response:** `201 Created`
```json
{
  "id": 10,
  "school_id": 1,
  "code": "BIO",
  "name": "Biology",
  "description": "Biology course for grade 3",
  "level": "bovenbouw",
  "year": 3,
  "period": "Q1",
  "is_active": true,
  "academic_year_id": 1,
  "subject_id": 2,
  "created_at": "2026-01-23T15:30:00Z",
  "updated_at": "2026-01-23T15:30:00Z"
}
```

#### Update Course

```http
PUT /api/v1/courses/{course_id}
```

**Authorization:** Admin or assigned Teacher

**Request Body:**
```json
{
  "name": "Biology Advanced",
  "description": "Updated description",
  "is_active": true
}
```

**Response:** `200 OK` (same structure as Get Single Course)

#### Delete Course

```http
DELETE /api/v1/courses/{course_id}
```

**Authorization:** Admin only

**Response:** `204 No Content`

---

### Projects

Projects are course-specific assignments with teams, evaluations, and deliverables.

#### List Projects

```http
GET /api/v1/courses/{course_id}/projects?include_archived=false
```

**Query Parameters:**
- `include_archived` (boolean, default: false): Include archived projects

**Response:**
```json
{
  "projects": [
    {
      "id": 1,
      "course_id": 1,
      "name": "Smart Home IoT",
      "description": "Build a smart home automation system",
      "start_date": "2026-01-20",
      "end_date": "2026-03-15",
      "is_active": true,
      "team_count": 6,
      "created_at": "2026-01-10T09:00:00Z"
    }
  ],
  "total": 3
}
```

#### Create Project

```http
POST /api/v1/courses/{course_id}/projects
```

**Request Body:**
```json
{
  "name": "AI Chatbot",
  "description": "Build a conversational AI chatbot",
  "start_date": "2026-02-01",
  "end_date": "2026-04-01"
}
```

**Response:** `201 Created`

---

### Evaluations

Evaluations are assessment periods where students evaluate themselves and peers.

#### List Evaluations

```http
GET /api/v1/evaluations?course_id=1&project_id=2
```

**Query Parameters:**
- `course_id` (integer, optional): Filter by course
- `project_id` (integer, optional): Filter by project
- `status` (string, optional): Filter by status ("open", "frozen", "closed")

**Response:**
```json
{
  "evaluations": [
    {
      "id": 1,
      "project_id": 2,
      "name": "Midterm Evaluation",
      "status": "open",
      "open_date": "2026-02-10T00:00:00Z",
      "freeze_date": "2026-02-15T00:00:00Z",
      "close_date": "2026-02-20T00:00:00Z",
      "evaluation_type": "peer",
      "created_at": "2026-02-01T10:00:00Z"
    }
  ],
  "total": 2
}
```

#### Create Evaluation

```http
POST /api/v1/evaluations
```

**Request Body:**
```json
{
  "project_id": 2,
  "name": "Final Evaluation",
  "evaluation_type": "peer",
  "open_date": "2026-03-01T00:00:00Z",
  "freeze_date": "2026-03-10T00:00:00Z",
  "close_date": "2026-03-15T00:00:00Z"
}
```

**Response:** `201 Created`

---

### Scores

Scores represent individual evaluation responses (self-assessment and peer reviews).

#### Submit Scores

```http
POST /api/v1/evaluations/{evaluation_id}/scores
```

**Request Body:**
```json
{
  "evaluator_id": 5,
  "evaluatee_id": 6,
  "scores": [
    {
      "criterion_id": 1,
      "score": 8,
      "comment": "Great collaboration skills"
    },
    {
      "criterion_id": 2,
      "score": 7,
      "comment": "Good technical contribution"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": 123,
  "evaluation_id": 1,
  "evaluator_id": 5,
  "evaluatee_id": 6,
  "submitted_at": "2026-02-12T14:30:00Z",
  "scores": [...]
}
```

#### Get Student Scores

```http
GET /api/v1/evaluations/{evaluation_id}/students/{student_id}/scores
```

**Response:**
```json
{
  "self_assessment": {
    "submitted": true,
    "scores": [...]
  },
  "peer_reviews": {
    "submitted": 4,
    "total": 5,
    "scores": [...]
  },
  "summary": {
    "gcf_score": 1.05,
    "omza_scores": {
      "collaboration": 8.2,
      "communication": 7.8,
      "technical": 8.5
    }
  }
}
```

---

### Users

User management endpoints for admins and teachers.

#### List Users

```http
GET /api/v1/users?role=student&page=1&per_page=50
```

**Query Parameters:**
- `role` (string, optional): Filter by role ("admin", "teacher", "student")
- `class_id` (integer, optional): Filter by class
- `search` (string, optional): Search by name or email

**Response:**
```json
{
  "users": [
    {
      "id": 10,
      "email": "student@school.nl",
      "name": "Alice Johnson",
      "role": "student",
      "school_id": 1,
      "class_name": "G2a",
      "is_active": true
    }
  ],
  "total": 45,
  "page": 1,
  "per_page": 50
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "detail": "Resource not found"
}
```

### HTTP Status Codes

- `200 OK`: Successful GET/PUT request
- `201 Created`: Successful POST request
- `204 No Content`: Successful DELETE request
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate)
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Validation Error Response

```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "invalid email format",
      "type": "value_error.email"
    }
  ]
}
```

---

## Rate Limiting

The API implements Redis-backed sliding window rate limiting:

- **Default**: 100 requests per minute per user
- **Auth endpoints**: 10 requests per minute per IP
- **Header**: `X-RateLimit-Remaining` indicates remaining requests

**Rate Limit Exceeded Response:**
```json
{
  "detail": "Rate limit exceeded. Please try again later."
}
```

---

## TypeScript Examples

### API Client Setup

```typescript
// src/services/api.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

/**
 * Base API client with authentication and error handling.
 * 
 * Features:
 * - Automatic JWT cookie handling
 * - Request/response interceptors
 * - Error transformation
 * - Base URL configuration
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
      withCredentials: true, // Include cookies in requests
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Sets up request and response interceptors.
   */
  private setupInterceptors() {
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Redirect to login on unauthorized
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request helper.
   * 
   * @template T - Response data type
   * @param {string} url - Endpoint URL
   * @param {object} config - Axios config options
   * @returns {Promise<T>} Response data
   */
  async get<T>(url: string, config = {}) {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * POST request helper.
   * 
   * @template T - Response data type
   * @param {string} url - Endpoint URL
   * @param {any} data - Request body data
   * @param {object} config - Axios config options
   * @returns {Promise<T>} Response data
   */
  async post<T>(url: string, data: any, config = {}) {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data: any, config = {}) {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config = {}) {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

### Course Service Example

```typescript
// src/services/course.service.ts
import { apiClient } from './api';
import { Course, CreateCourseDto, CourseListResponse } from '@/dtos/course.dto';

/**
 * Service for course-related API operations.
 * 
 * @example
 * ```typescript
 * const courses = await courseService.getCourses({ page: 1, perPage: 20 });
 * const course = await courseService.createCourse({
 *   code: 'BIO',
 *   name: 'Biology',
 *   academicYearId: 1
 * });
 * ```
 */
class CourseService {
  private readonly basePath = '/api/v1/courses';

  /**
   * Fetches paginated list of courses.
   * 
   * @param {object} params - Query parameters
   * @param {number} params.page - Page number (default: 1)
   * @param {number} params.perPage - Items per page (default: 20)
   * @param {boolean} params.isActive - Filter by active status
   * @returns {Promise<CourseListResponse>} Paginated course list
   * @throws {Error} If API request fails
   */
  async getCourses(params: {
    page?: number;
    perPage?: number;
    isActive?: boolean;
    search?: string;
  } = {}): Promise<CourseListResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.perPage) queryParams.set('per_page', params.perPage.toString());
    if (params.isActive !== undefined) {
      queryParams.set('is_active', params.isActive.toString());
    }
    if (params.search) queryParams.set('search', params.search);

    return apiClient.get<CourseListResponse>(
      `${this.basePath}?${queryParams.toString()}`
    );
  }

  /**
   * Fetches a single course by ID.
   * 
   * @param {number} courseId - Course ID
   * @returns {Promise<Course>} Course object
   * @throws {Error} If course not found or request fails
   */
  async getCourseById(courseId: number): Promise<Course> {
    return apiClient.get<Course>(`${this.basePath}/${courseId}`);
  }

  /**
   * Creates a new course.
   * 
   * @param {CreateCourseDto} courseData - Course data
   * @returns {Promise<Course>} Created course object
   * @throws {Error} If validation fails or request fails
   */
  async createCourse(courseData: CreateCourseDto): Promise<Course> {
    return apiClient.post<Course>(this.basePath, courseData);
  }

  /**
   * Updates an existing course.
   * 
   * @param {number} courseId - Course ID
   * @param {Partial<CreateCourseDto>} courseData - Updated course data
   * @returns {Promise<Course>} Updated course object
   * @throws {Error} If course not found or request fails
   */
  async updateCourse(
    courseId: number,
    courseData: Partial<CreateCourseDto>
  ): Promise<Course> {
    return apiClient.put<Course>(`${this.basePath}/${courseId}`, courseData);
  }

  /**
   * Deletes a course.
   * 
   * @param {number} courseId - Course ID
   * @returns {Promise<void>}
   * @throws {Error} If course not found or request fails
   */
  async deleteCourse(courseId: number): Promise<void> {
    return apiClient.delete(`${this.basePath}/${courseId}`);
  }
}

export const courseService = new CourseService();
```

---

## Python Examples

### API Client Setup

```python
# backend/app/infra/api_client.py
import requests
from typing import Dict, Any, Optional
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class ApiClient:
    """
    HTTP API client with retry logic and error handling.
    
    Features:
        - Automatic retries on network errors
        - Session management
        - JSON serialization/deserialization
        - Error handling
    
    Example:
        >>> client = ApiClient(base_url="http://localhost:8000")
        >>> courses = client.get("/api/v1/courses")
        >>> new_course = client.post("/api/v1/courses", data={...})
    """
    
    def __init__(self, base_url: str, token: Optional[str] = None):
        """
        Initialize API client.
        
        Args:
            base_url: Base URL for API (e.g., "http://localhost:8000")
            token: Optional JWT token for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        
        # Configure retry strategy
        retry_strategy = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT", "DELETE"]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set default headers
        self.session.headers.update({
            'Content-Type': 'application/json',
        })
        
        if token:
            self.session.headers.update({
                'Authorization': f'Bearer {token}'
            })
    
    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """
        Perform GET request.
        
        Args:
            endpoint: API endpoint (e.g., "/api/v1/courses")
            params: Optional query parameters
            
        Returns:
            Response JSON data
            
        Raises:
            requests.HTTPError: If request fails
        """
        url = f"{self.base_url}{endpoint}"
        response = self.session.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    def post(self, endpoint: str, data: Dict[str, Any]) -> Any:
        """
        Perform POST request.
        
        Args:
            endpoint: API endpoint
            data: Request body data
            
        Returns:
            Response JSON data
            
        Raises:
            requests.HTTPError: If request fails
        """
        url = f"{self.base_url}{endpoint}"
        response = self.session.post(url, json=data)
        response.raise_for_status()
        return response.json()
    
    def put(self, endpoint: str, data: Dict[str, Any]) -> Any:
        """Perform PUT request."""
        url = f"{self.base_url}{endpoint}"
        response = self.session.put(url, json=data)
        response.raise_for_status()
        return response.json()
    
    def delete(self, endpoint: str) -> None:
        """Perform DELETE request."""
        url = f"{self.base_url}{endpoint}"
        response = self.session.delete(url)
        response.raise_for_status()
```

### Using the API Client

```python
# Example usage script
from app.infra.api_client import ApiClient

def main():
    """
    Example script demonstrating API client usage.
    """
    # Initialize client
    client = ApiClient(base_url="http://localhost:8000")
    
    # List courses
    courses_response = client.get("/api/v1/courses", params={
        "page": 1,
        "per_page": 20,
        "is_active": True
    })
    print(f"Found {courses_response['total']} courses")
    
    # Create new course
    new_course = client.post("/api/v1/courses", data={
        "code": "BIO",
        "name": "Biology",
        "description": "Biology course",
        "level": "bovenbouw",
        "year": 3,
        "academic_year_id": 1
    })
    print(f"Created course: {new_course['name']} (ID: {new_course['id']})")
    
    # Update course
    updated_course = client.put(f"/api/v1/courses/{new_course['id']}", data={
        "description": "Updated biology course description"
    })
    print(f"Updated course description")
    
    # Delete course
    client.delete(f"/api/v1/courses/{new_course['id']}")
    print(f"Deleted course")

if __name__ == "__main__":
    main()
```

---

## Related Documentation

- [Architecture Overview](./architecture.md) - System design and data models
- [Code Structure](./code_structure.md) - Codebase organization
- [Testing Guide](./testing.md) - Testing strategies and examples
- [Authentication Guide](./AZURE_AD_SETUP.md) - Azure AD setup and configuration

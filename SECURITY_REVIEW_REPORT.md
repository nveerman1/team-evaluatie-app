# Security Review Summary

**Review Date:** 2026-02-18  
**Reviewed Features:** ProjectPlan & Vaardigheidstrainingen (Skill Trainings)  
**Reviewer:** GitHub Copilot Security Agent

## Executive Summary

A comprehensive security review was performed on the newly implemented ProjectPlan and Skill Trainings features. Multiple **critical** and **high-risk** vulnerabilities were identified and fixed, primarily related to authorization, input validation, and multi-tenant isolation.

### Critical Findings Fixed

1. **Mass Assignment Vulnerability in ProjectPlans** - Students could potentially modify restricted fields (status, locked, teacher_note)
2. **Missing Teacher Course Authorization in Skill Trainings** - Teachers could access/modify data from courses they don't teach
3. **Unbounded Bulk Operations** - DoS risk from unlimited array sizes in bulk updates
4. **Missing Status Transition Validation** - Invalid state transitions allowed
5. **Missing Multi-Tenant Isolation** - Unique constraints didn't include school_id

---

## 1. Authentication & Authorization

### ✅ Strengths

- **JWT-based authentication** with proper signature validation (HS256)
- **Token validation** includes expiration checks via `decode_access_token()`
- **Multi-factor auth support** via Azure AD integration
- **School scoping** enforced: `user.school_id` compared to `token_school_id`
- **Archived user blocking**: Users with `archived=True` rejected
- **Dev-login protection**: X-User-Email header blocked in production via `ENABLE_DEV_LOGIN=False`

### ⚠️ Risks Identified & Fixed

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| Mass assignment in student ProjectPlan updates | **CRITICAL** | Created separate `ProjectPlanTeamStudentUpdate` schema with only `title` field |
| Teacher can access any course's skill training progress | **CRITICAL** | Added `_verify_teacher_course_access()` validation |
| No teacher-student relationship verification | **HIGH** | Added CourseEnrollment check in progress updates |

### Configuration Review

**JWT Settings** (`/backend/app/core/config.py`):
```python
SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"  # ✅ Validated in production
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60  # ✅ Reasonable
JWT_ALGORITHM: str = "HS256"  # ✅ Secure algorithm
```

**Recommendations:**
- ✅ SECRET_KEY validation enforces 32+ characters in production
- ✅ Default value rejection in production environment
- ⚠️ Consider rotating JWT secrets periodically (currently static)

---

## 2. ProjectPlan Feature Security

### Vulnerabilities Fixed

#### 2.1 Mass Assignment Protection

**Before:**
```python
class ProjectPlanTeamUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[PlanStatus] = None  # ❌ Students could modify
    locked: Optional[bool] = None         # ❌ Students could modify
    global_teacher_note: Optional[str] = None  # ❌ Students could modify
```

**After:**
```python
class ProjectPlanTeamStudentUpdate(BaseModel):
    """Student-only schema with restricted fields"""
    title: Optional[str] = Field(None, max_length=500)  # ✅ Only allowed field

class ProjectPlanSectionStudentUpdate(BaseModel):
    """Student section update - no status/teacher_note"""
    text: Optional[str] = Field(None, max_length=10000)
    client: Optional[ClientData] = None
    # ✅ status and teacher_note removed
```

#### 2.2 Status Transition Validation

**Added finite state machine validation:**
```python
valid_transitions = {
    "concept": ["ingediend"],
    "ingediend": ["go", "no-go", "concept"],
    "go": ["no-go"],
    "no-go": ["concept", "ingediend"],
}
```

**Blocks invalid transitions:**
- ❌ concept → go (must go through ingediend first)
- ❌ concept → no-go
- ✅ concept → ingediend → go ✓

#### 2.3 Input Validation

**Added length limits:**
```python
title: max_length=500
text: max_length=10000
notes: max_length=2000
client_organisation: max_length=500
client_email: max_length=320  # RFC 5321 standard
client_phone: max_length=50
```

### Remaining Risks (Lower Priority)

| Risk | Severity | Status | Recommendation |
|------|----------|--------|----------------|
| No email format validation for client.email | MEDIUM | Open | Use Pydantic `EmailStr` |
| Section status not locked when team is locked | MEDIUM | Open | Add validation in section update |
| No audit trail for status changes | MEDIUM | Open | Log old→new status transitions |

---

## 3. Skill Trainings Feature Security

### Vulnerabilities Fixed

#### 3.1 Teacher Course Access Control

**Added helper function:**
```python
def _verify_teacher_course_access(db: Session, user: User, course_id: int) -> None:
    """
    Verify teacher is assigned to course via TeacherCourse table.
    Admins have access to all courses in school.
    Raises HTTPException(403) if denied.
    """
```

**Applied to endpoints:**
- ✅ `get_progress_matrix()` - Matrix view
- ✅ `update_single_progress()` - Single student update
- ✅ `bulk_update_progress()` - Bulk updates

#### 3.2 Bulk Operation Security

**Before:**
```python
class BulkProgressUpdate(BaseModel):
    student_ids: List[int]  # ❌ Unbounded
    training_ids: List[int]  # ❌ Unbounded
```

**After:**
```python
class BulkProgressUpdate(BaseModel):
    student_ids: List[int] = Field(..., max_length=100)  # ✅ Max 100
    training_ids: List[int] = Field(..., max_length=50)  # ✅ Max 50
```

**Additional validations:**
```python
# Validate all students exist and belong to school
students = db.execute(select(User).where(
    User.id.in_(payload.student_ids),
    User.school_id == user.school_id,
    User.role == "student"
)).scalars().all()

if len(students) != len(payload.student_ids):
    raise HTTPException(400, "One or more student IDs are invalid")

# Validate all students enrolled in course
enrollments = db.execute(select(CourseEnrollment).where(
    CourseEnrollment.student_id.in_(payload.student_ids),
    CourseEnrollment.course_id == course_id,
    CourseEnrollment.active == True
)).scalars().all()

if len(enrollments) != len(payload.student_ids):
    raise HTTPException(400, "Students not enrolled in course")
```

**DoS Protection:**
- Maximum 100 students × 50 trainings = 5,000 records per bulk operation
- Prevents memory exhaustion attacks
- Validates existence before creating records (no orphaned data)

#### 3.3 Student Restrictions

**Enforced via schema and endpoint logic:**
```python
STUDENT_ALLOWED_STATUSES = {"none", "planned", "in_progress", "submitted"}

# Students cannot set: "completed", "mastered" (teacher-only)

if payload.status not in STUDENT_ALLOWED_STATUSES:
    raise HTTPException(400, "Invalid status for student")
```

**Protection against overriding teacher feedback:**
```python
if progress and progress.status in ("completed", "mastered"):
    raise HTTPException(
        403,
        "Cannot modify teacher-assessed progress"
    )
```

---

## 4. Database Security

### Multi-Tenant Isolation

#### Fixed: Unique Constraints Now Include school_id

**Migration Created:** `f9a1b2c3d4e5_add_school_id_to_unique_constraints.py`

**Before:**
```python
UniqueConstraint("project_plan_id", "project_team_id", ...)  # ❌ Cross-school collision possible
```

**After:**
```python
UniqueConstraint("school_id", "project_plan_id", "project_team_id", ...)  # ✅ Scoped per school
```

**Impact:**
- Prevents cross-school data collisions
- Ensures unique constraints respect tenant boundaries
- Applied to:
  - `project_plan_teams.uq_project_plan_team`
  - `project_plan_sections.uq_project_plan_team_section_key`

### Foreign Key Constraints

**Review Summary:**
- ✅ All foreign keys to `schools.id` use `ondelete="CASCADE"`
- ✅ Orphan deletion enabled for nested relationships (ProjectPlan → Teams → Sections)
- ✅ `SkillTraining.competency_category_id` uses `RESTRICT` (prevents accidental deletion)
- ✅ Optional relationships use `SET NULL`

---

## 5. Input Validation & Data Safety

### Pydantic Schema Validation

**All request bodies validated with Pydantic schemas:**
- ✅ Type checking (int, str, bool, Enum)
- ✅ Length limits on all text fields
- ✅ Enum validation for status fields
- ✅ Optional field handling with `Field(None, ...)`

### XSS Protection

**Current state:**
- ✅ All data returned via Pydantic models (automatic JSON escaping)
- ⚠️ **Rich text fields not sanitized server-side** (projectplan.text, section.text)
  - Recommendation: Add HTML sanitization using `bleach` library if rich text is allowed
  - Frontend must escape output when rendering

**Example recommendation:**
```python
import bleach

ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 'ul', 'ol', 'li']
ALLOWED_ATTRS = {}

def sanitize_html(html: str) -> str:
    return bleach.clean(html, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)
```

### SQL Injection Protection

**Status:** ✅ **SECURE**
- All database queries use ORM (SQLAlchemy)
- No raw SQL with string concatenation found
- Parameterized queries throughout

---

## 6. CORS Configuration

**Location:** `/backend/app/main.py`

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # Configurable via env
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-User-Email"],
)
```

**Security Review:**
- ✅ `allow_origins` configurable (not `["*"]`)
- ✅ `allow_credentials=True` requires specific origins
- ⚠️ **X-User-Email header allowed** - Intentional for dev-login, but blocked in production
- ✅ No wildcard methods or headers

**Production Recommendation:**
```python
# In production, remove X-User-Email from allow_headers
allow_headers=["Content-Type", "Authorization"]
```

---

## 7. Security Headers

**Middleware:** `SecurityHeadersMiddleware`

**Headers Applied:**
```python
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

**Configuration:**
- ✅ Disabled in production (nginx handles headers)
- ✅ Enabled in development for testing
- ✅ Controlled via `ENABLE_BACKEND_SECURITY_HEADERS` env var

---

## 8. Cookie Security

**Settings** (`/backend/app/core/config.py`):
```python
COOKIE_SECURE: bool = True  # ✅ Auto-enabled in production
COOKIE_DOMAIN: str = ""     # Should be set in production
COOKIE_SAMESITE: str = "Lax"  # ✅ Allows OAuth redirects
COOKIE_MAX_AGE: int = 604800  # 7 days
```

**Validation:**
- ✅ `COOKIE_SECURE` automatically set to `True` in production
- ✅ Warning logged if explicitly set to `False` in production
- ✅ HttpOnly flag set on access_token cookie

**Production Checklist:**
- ✅ COOKIE_SECURE=True (enforced)
- ⚠️ COOKIE_DOMAIN should be set (e.g., ".yourdomain.nl")
- ✅ COOKIE_SAMESITE=Lax (secure + allows OAuth)

---

## 9. Rate Limiting

**Middleware:** `RateLimitMiddleware`

**Applied to:**
- Teacher scoring endpoints
- Authentication endpoints
- General API endpoints

**Configuration:**
- Configurable limits per endpoint
- Response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

---

## 10. Error Handling

**API Documentation:**
- ✅ Swagger UI disabled in production (`docs_url=None`)
- ✅ ReDoc disabled in production (`redoc_url=None`)
- ✅ OpenAPI schema hidden in production (`openapi_url=None`)

**Benefits:**
- Prevents API structure reconnaissance
- Mitigates historical Swagger vulnerabilities (CVE-2023-27322, CVE-2022-31677)

---

## Security Testing Recommendations

### Tests Created

1. **`test_projectplan_security.py`** - ProjectPlan security tests
2. **`test_skill_trainings_security.py`** - Skill Trainings security tests

### Test Coverage Needed

- [ ] Mass assignment protection (students cannot modify restricted fields)
- [ ] Status transition validation (invalid transitions rejected)
- [ ] Teacher course ownership (teachers cannot access other courses)
- [ ] Bulk operation limits (max students/trainings enforced)
- [ ] Student enrollment verification (bulk updates validate enrollment)
- [ ] IDOR prevention (users cannot access other schools' data)

### Recommended Tools

1. **CodeQL** - Static analysis for security vulnerabilities
2. **Bandit** - Python security linter
3. **Safety** - Dependency vulnerability scanner
4. **OWASP ZAP** - Dynamic security testing

---

## Production Deployment Checklist

### Environment Variables (MUST SET)

- [ ] `SECRET_KEY` - Random 32+ character string
- [ ] `NODE_ENV=production`
- [ ] `ENABLE_DEV_LOGIN=False` (automatically set)
- [ ] `COOKIE_SECURE=True` (automatically set)
- [ ] `COOKIE_DOMAIN=.yourdomain.nl`
- [ ] `CORS_ORIGINS=https://yourdomain.nl`
- [ ] `DATABASE_URL` - Production PostgreSQL connection
- [ ] `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, etc.

### Infrastructure

- [ ] HTTPS enforced (Let's Encrypt or other SSL certificate)
- [ ] Nginx security headers configured
- [ ] Rate limiting enabled (nginx or CloudFlare)
- [ ] Database backups configured
- [ ] WAF (Web Application Firewall) enabled
- [ ] DDoS protection enabled

### Monitoring

- [ ] Security logs aggregated (failed auth attempts, IDOR attempts)
- [ ] Alert on suspicious patterns (rapid failed logins, dev-login attempts)
- [ ] Database query performance monitoring
- [ ] API error rate monitoring

---

## Compliance Notes (GDPR/AVG)

### Data Protection

- ✅ School-scoped isolation (multi-tenancy enforced)
- ✅ User data encrypted in transit (HTTPS)
- ⚠️ Database encryption at rest (depends on infrastructure)
- ✅ User archival support (`user.archived=True`)
- ✅ No passwords stored in plaintext (bcrypt hashing)

### Access Control

- ✅ Role-based access control (admin, teacher, student)
- ✅ Principle of least privilege (students cannot access teacher data)
- ✅ Teacher-student relationship enforced (teachers cannot access all students)

### Audit Trail

- ✅ AuditLog model exists for tracking mutations
- ⚠️ Status transition logging incomplete (recommend enhancement)
- ✅ `updated_by_user_id` tracked in progress records

---

## Appendix: Migration Instructions

### Apply Security Fixes

```bash
# Backend
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run database migration
alembic upgrade head

# Run tests
pytest tests/test_projectplan_security.py -v
pytest tests/test_skill_trainings_security.py -v
```

### Rollback (if needed)

```bash
alembic downgrade -1  # Rollback last migration
```

---

## Summary

### Critical Issues Fixed ✅

1. Mass assignment in ProjectPlan student updates
2. Teacher course authorization in Skill Trainings
3. Bulk operation DoS vulnerability
4. Status transition validation
5. Multi-tenant unique constraint isolation

### High-Risk Issues Fixed ✅

1. Input validation (max_length on all text fields)
2. Student enrollment verification in bulk updates
3. Training existence validation in bulk updates

### Recommendations for Next Phase

1. Add HTML sanitization for rich text fields
2. Implement comprehensive audit logging for status changes
3. Add email format validation (use Pydantic `EmailStr`)
4. Remove X-User-Email from CORS allowed headers in production
5. Set COOKIE_DOMAIN in production configuration
6. Implement full security test suite
7. Run penetration testing before production launch

---

**End of Security Review**  
**Status:** Critical vulnerabilities fixed, ready for additional hardening and testing.

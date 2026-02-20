![CI](https://github.com/nveerman1/team-evaluatie-app/actions/workflows/ci.yml/badge.svg?branch=main)

# Team Evaluatie App

A production-ready multi-tenant web application for peer evaluations, project assessments, and competency monitoring — built for Technasium teachers and students.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture Overview](#architecture-overview)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Production Deployment](#production-deployment)
- [Security](#security)
- [Development Workflow](#development-workflow)
- [Documentation](#documentation)
- [License](#license)

---

## Project Overview

The Team Evaluatie App supports the full Technasium evaluation cycle:

| Module | Description |
|--------|-------------|
| **Projects** | Project management with team rosters and assignments |
| **Projectplans** (bovenbouw) | Structured project planning for upper secondary |
| **Peer Evaluations** | Student-to-student assessments with GCF/OMZA scoring |
| **Project Assessments** | Teacher-led project evaluations with rubrics |
| **Competency Tracking** | Self-assessment and peer feedback on competencies |
| **Skill Trainings** (Vaardigheidstrainingen) | Skill development exercises and tracking |
| **Attendance** | RFID-based automatic attendance registration |

**Key capabilities:**

- Multi-tenant: fully isolated data per school
- Role-based access: Admin, Teacher, Student
- AI-powered feedback summaries (async, via Ollama)
- Azure AD (Office 365) authentication in production

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser   │────▶│    Nginx     │────▶│  Next.js 15  │
│             │     │ (rev. proxy) │     │  (frontend)  │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌──────────────┐
                    │   FastAPI    │────▶│  PostgreSQL  │
                    │  (backend)   │     │     16       │
                    └──────┬───────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Redis 7    │
                    │ (RQ worker)  │
                    └──────────────┘
```

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router, TypeScript, Tailwind CSS) |
| **Backend** | FastAPI + SQLAlchemy + Alembic |
| **Database** | PostgreSQL 16 |
| **Auth** | Azure AD (OAuth2/OIDC) + JWT with sliding sessions |
| **Cache/Queue** | Redis 7 + RQ (async job processing) |
| **Reverse Proxy** | Nginx |
| **Deployment** | Docker Compose (prod + dev) |
| **CI/CD** | GitHub Actions |
| **Security scanning** | Trivy, Ruff, Black, OSV, Bandit, pip-audit |

For detailed architecture documentation see [`docs/architecture/overview.md`](docs/architecture/overview.md).

---

## Quick Start (Local Development)

### Prerequisites

- Docker & Docker Compose
- Python 3.12+
- Node.js LTS + pnpm

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/nveerman1/team-evaluatie-app.git
cd team-evaluatie-app

# 2. Copy environment configuration
cp backend/.env.example backend/.env

# 3. Start database and Redis
docker compose -f ops/docker/compose.dev.yml up -d

# 4. Set up the backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head

# 5. (Optional) Seed demo data
python -m scripts.seed --mode demo --reset --seed 42

# 6. Start the backend
uvicorn app.main:app --reload

# 7. In a new terminal, start the frontend
cd frontend
pnpm install
pnpm dev
```

**Access the application:**

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs (Swagger): http://localhost:8000/docs

**Dev login** (development only, disabled in production):

After seeding, use these email addresses on the dev-login screen:
- `admin@school.nl` → admin dashboard
- `docent@school.nl` → teacher view
- `student1@school.nl` → student view

---

## Production Deployment

For complete VPS setup instructions (Docker Compose, Nginx, SSL/TLS, backups):

➡️ **[`docs/deployment/production-deployment.md`](docs/deployment/production-deployment.md)**

Quick reference:

```bash
# Configure production environment
cp backend/.env.production.example backend/.env

# Deploy with Docker Compose
docker compose -f ops/docker/compose.prod.yml up -d

# Run database migrations
docker compose -f ops/docker/compose.prod.yml exec backend alembic upgrade head
```

---

## Security

- **Authentication**: Azure AD (production) with JWT access tokens; dev-login disabled in production
- **Sessions**: Sliding window renewal (`SESSION_RENEW_IF_EXPIRES_WITHIN_MINUTES`) + absolute limit (`SESSION_MAX_HOURS`)
- **Authorization**: Role-based access control (Admin / Teacher / Student) with school-level multi-tenant isolation
- **Input validation**: Pydantic schemas with strict validation on all API endpoints
- **Security headers**: CSP, HSTS, X-Frame-Options, X-Content-Type-Options (managed by Nginx in production)
- **CI scanning**: Bandit, pip-audit, Trivy, Ruff, Black run on every push

For detailed security documentation:

- [`docs/security/security-guide.md`](docs/security/security-guide.md) — Security best practices
- [`docs/security/hardening.md`](docs/security/hardening.md) — Production hardening guide
- [`docs/security/azure-ad-setup.md`](docs/security/azure-ad-setup.md) — Azure AD configuration
- [`docs/security/session-management.md`](docs/security/session-management.md) — Cookie & session management

---

## Development Workflow

### Running Tests

```bash
cd backend
pytest
pytest --cov=app --cov-report=html   # with coverage
```

### Database Migrations (Alembic)

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
alembic downgrade -1   # rollback one step
```

See [`docs/contributing/seeding.md`](docs/contributing/seeding.md) for database seeding instructions.

### Code Quality

```bash
cd backend
black .          # format
ruff check .     # lint
mypy app         # type check
bandit -r app/   # security lint
```

### Branch Strategy

- `main` — production-ready, protected
- Feature branches → pull request → `main`

See [`docs/deployment/ci-cd.md`](docs/deployment/ci-cd.md) for CI/CD pipeline details.

---

## Documentation

### 🏗️ Architecture

- [`docs/architecture/overview.md`](docs/architecture/overview.md) — Multi-tenant architecture, data model, RBAC
- [`docs/architecture/api-docs.md`](docs/architecture/api-docs.md) — REST API reference
- [`docs/architecture/template-data.md`](docs/architecture/template-data.md) — Template data architecture

### 🚀 Deployment & Operations

- [`docs/deployment/overview.md`](docs/deployment/overview.md) — Deployment methods
- [`docs/deployment/production-deployment.md`](docs/deployment/production-deployment.md) — Complete VPS guide
- [`docs/deployment/operations.md`](docs/deployment/operations.md) — Day-to-day operations
- [`docs/deployment/rollback.md`](docs/deployment/rollback.md) — Emergency rollback procedures
- [`docs/deployment/ci-cd.md`](docs/deployment/ci-cd.md) — GitHub Actions workflows

### 🔐 Security & Authentication

- [`docs/security/security-guide.md`](docs/security/security-guide.md) — Security overview & hardening
- [`docs/security/azure-ad-setup.md`](docs/security/azure-ad-setup.md) — Office 365 authentication
- [`docs/security/session-management.md`](docs/security/session-management.md) — JWT & cookie sessions
- [`docs/security/hardening.md`](docs/security/hardening.md) — Production hardening checklist

### ✨ Features

- [`docs/features/competencies.md`](docs/features/competencies.md) — Competency tracking architecture
- [`docs/features/async-summaries.md`](docs/features/async-summaries.md) — AI feedback summary setup
- [`docs/features/attendance.md`](docs/features/attendance.md) — RFID attendance system
- [`docs/features/cron-jobs.md`](docs/features/cron-jobs.md) — Scheduled tasks

### 🛠️ Contributing

- [`docs/contributing/testing.md`](docs/contributing/testing.md) — Testing guide
- [`docs/contributing/seeding.md`](docs/contributing/seeding.md) — Database seeding
- [`docs/contributing/styling-guide.md`](docs/contributing/styling-guide.md) — Frontend styling conventions

---

## License

This project is licensed under the MIT License.

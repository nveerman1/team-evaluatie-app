![CI](https://github.com/nveerman1/team-evaluatie-app/actions/workflows/ci.yml/badge.svg?branch=main)

# Team Evaluatie App

Een multi-tenant webapplicatie voor peer evaluaties, projectbeoordelingen en competentiemonitoring met AI-powered feedback summaries.

## Features

### Authentication & Security
- **Multi-method Authentication**:
  - **Azure AD (Office 365)**: Production authentication using Microsoft OAuth
  - **Dev-login**: Development-only authentication (controlled via environment flags)
- **Role-Based Access Control (RBAC)**: Admin, teacher and student rollen met granulaire toegangscontrole
- **JWT with Claims**: Tokens include role and school_id for efficient authorization
- **School-scoped Access**: All data isolated per school (multi-tenant)
- **Audit logging**: Alle muterende acties worden gelogd voor compliance

#### Dev-login Configuration

Dev-login provides an easy way to test as different users in local development. It is **completely disabled in production** for security.

**Backend** (in `.env`):
```bash
ENABLE_DEV_LOGIN=true  # Enable in development, false in production
```

**Frontend** (in `.env.local`):
```bash
NEXT_PUBLIC_ENABLE_DEV_LOGIN=true  # Show dev-login UI in development
```

**Security Notes**:
- In production, set both flags to `false` (or omit them)
- The backend endpoint returns 404 when disabled (doesn't leak existence)
- The frontend UI is hidden when disabled
- Dev-login is blocked by nginx X-User-Email header stripping in production

**Local Testing**:
1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to http://localhost:3000
4. Use dev-login with test emails:
   - `admin@school.nl` → redirects to `/teacher`
   - `docent@school.nl` → redirects to `/teacher`
   - `student1@school.nl` → redirects to `/student`

See [AZURE_AD_SETUP.md](AZURE_AD_SETUP.md) for detailed authentication configuration.

### Multi-Tenant & Multi-Course Architecture
- **Multi-school support**: Volledig gescheiden data per school
- **Multiple courses**: Ondersteuning voor O&O, XPLR, Biologie, Nederlands, Engels, etc.
- **Teacher-course mapping**: Docenten worden expliciet gekoppeld aan vakken
- **School-scoped data**: All queries automatically scoped to user's school

### Evaluation Types
- **Peer Evaluation**: Wederzijdse beoordelingen tussen studenten
- **Project Assessment**: Teamprojectbeoordelingen door docenten
- **Competency Monitor**: Competentiemeting met self-assessment en peer feedback

### Project-Based Team Management
- **Project-specific teams**: Team toewijzingen geïsoleerd per project
- **Automatic allocation**: Evaluaties worden automatisch gevuld met alle projectteams
- **Frozen rosters**: Historische teamsamenstelling bewaard voor gesloten evaluaties
- **No global team numbers**: User.team_number gefaseerd uit - teams zijn project-specifiek
- **Bulk operations**: Teams maken, auto-verdeel, CSV import/export
- **Version control**: Team wijzigingen kunnen worden geversioneerd

Zie [docs/architecture.md](docs/architecture.md#project-based-team-management) voor details.

### Student Evaluatie Wizard
- **Stap 1**: Zelfbeoordeling
- **Stap 2**: Peer-reviews
- **Stap 3**: Overzicht met GCF/OMZA scores en AI-samenvatting
  - GCF (Group Contribution Factor) scores
  - OMZA (categorie-gebaseerde scores)
  - AI-gegenereerde samenvatting van peer-feedback
  - Anonieme feedback quotes
- **Stap 4**: Reflectie

### AI Feedback Summaries
Automatisch gegenereerde samenvattingen van peer-feedback met:
- **Asynchrone verwerking** met RQ (Redis Queue) voor schaalbaarheid
- **Robuuste worker** met automatische herstart bij verbindingsproblemen
- Ollama voor lokale LLM verwerking
- Volledige anonimisering van namen en PII
- Caching voor efficiëntie
- Fallback naar regel-gebaseerde summaries
- Real-time status updates en polling
- Retry mechanisme bij fouten

📚 Zie [docs/ASYNC_SUMMARY_GENERATION.md](docs/ASYNC_SUMMARY_GENERATION.md) voor gedetailleerde setup instructies.

📚 Zie [docs/REDIS_WORKER_STABILITY.md](docs/REDIS_WORKER_STABILITY.md) voor worker troubleshooting en monitoring.

Voorbereiding voor integratie met Somtoday:
- OAuth2 authenticatie
- Import van klassen en studenten
- Export van cijfers
- Zie [docs/architecture.md](docs/architecture.md) voor details

📚 Zie [docs/FEEDBACK_SUMMARY.md](docs/FEEDBACK_SUMMARY.md) voor gedetailleerde setup instructies.

## Configuration

### Backend CORS Settings

The backend CORS (Cross-Origin Resource Sharing) configuration can be customized via environment variables. This is important for allowing the frontend to communicate with the backend API.

**Default configuration:**
- `http://localhost:3000`
- `http://127.0.0.1:3000`

**To configure for production or other environments:**

Set the `CORS_ORIGINS` environment variable with a comma-separated list of allowed origins:

```bash
CORS_ORIGINS="http://localhost:3000,https://your-production-domain.com"
```

This setting is defined in `backend/app/core/config.py` and used in `backend/app/main.py`.

**Common issues:**
- If you see `[API NETWORK ERROR]` in the browser console, it may be due to CORS blocking the request
- Ensure the frontend URL is included in `CORS_ORIGINS`
- After changing CORS configuration, restart the backend server

### AI Feedback Summary Settings

For AI-powered feedback summaries, configure Ollama:

```bash
OLLAMA_BASE_URL=http://localhost:11434  # Default
OLLAMA_MODEL=llama3.1                   # Default: llama3.1
OLLAMA_TIMEOUT=10.0                     # Default: 10 seconds
```

See [docs/FEEDBACK_SUMMARY.md](docs/FEEDBACK_SUMMARY.md) for detailed setup instructions.

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (optional)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/nveerman1/team-evaluatie-app.git
   cd team-evaluatie-app
   ```

2. **Start the database**
   ```bash
   make up
   # or: docker compose -f ops/docker/compose.dev.yml up -d
   ```

3. **Setup backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements-dev.txt
   
   # Run migrations
   alembic upgrade head
   
   # Optional: Seed demo data
   python scripts/seed_demo_data.py
   
   # Optional: Seed 3de Blok test data
   python scripts/seed_3de_blok.py
   
   # Optional: Seed competency scans test data
   python scripts/seed_competency_scans.py
   
   # Optional: Seed competency scans with self-scores (for course 1)
   # Creates 6 scans: 3 with 10 competencies, 2 with ALL competencies + goals + reflections,
   # 1 with extreme scores (very low, very high, and strong growth)
   python scripts/seed_competency_scans_with_scores.py
   
   # Start backend
   uvicorn app.main:app --reload
   ```

4. **Setup frontend**
   ```bash
   cd frontend
   npm install  # or: pnpm install
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

### Demo Credentials

**Development Mode Only (NODE_ENV=development):**

After running the seed script:
- **Admin**: admin@demo.school / demo123
- **Teacher**: teacher1@school1.demo / demo123
- **Student**: student.4a.1@school1.demo / demo123

**Production Mode (NODE_ENV=production):**

Use Azure AD (Office 365) authentication. See [AZURE_AD_SETUP.md](AZURE_AD_SETUP.md) for configuration.

## Documentation

- [Azure AD Setup](AZURE_AD_SETUP.md) - Office 365 authentication configuration
- [Architecture](docs/architecture.md) - Multi-tenant architecture, data model, RBAC
- [Migration Notes](MIGRATION_NOTES.md) - Database migration guide
- [Feedback Summary](docs/FEEDBACK_SUMMARY.md) - AI feedback configuration
- [Redis Worker Stability](docs/REDIS_WORKER_STABILITY.md) - RQ worker connection troubleshooting and monitoring
- [API Documentation](http://localhost:8000/docs) - Interactive API docs (when running)

## API Endpoints

### Core Endpoints
- `/api/v1/courses` - Course management (CRUD, teacher assignment)
- `/api/v1/evaluations` - Evaluation management
- `/api/v1/scores` - Score submission and retrieval
- `/api/v1/grades` - Grade calculation and publishing
- `/api/v1/auth` - Authentication
- `/api/v1/rubrics` - Rubric management

### Integration Endpoints
- `/api/v1/integrations/somtoday/*` - Somtoday integration (placeholder)

See [docs/architecture.md](docs/architecture.md) for complete API documentation.

## Development

### Running Tests

```bash
cd backend

# Run all tests
pytest

# Run specific test file
pytest tests/test_job_enhancements.py -v

# Run specific test class
pytest tests/test_job_enhancements.py::TestJobProgressTracking -v
```

Note: The `tests/conftest.py` file automatically sets up the Python path for imports.

### Database Migrations

```bash
cd backend

# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

### Code Quality

```bash
cd backend

# Format code
black .

# Lint code
ruff check .

# Type checking
mypy .

# Security audit
bandit -r app/
pip-audit
```

## Deployment

### Production Deployment

Complete guide for deploying to a TransIP VPS with Docker Compose, Nginx, and SSL.

**Quick Start:**

```bash
# 1. Setup VPS with Docker
# 2. Clone repository
git clone https://github.com/nveerman1/team-evaluatie-app.git
cd team-evaluatie-app

# 3. Configure environment
cp .env.prod.example .env.prod
# Edit .env.prod with your settings

# 4. Deploy
docker compose -f ops/docker/compose.prod.yml up -d

# 5. Setup SSL (after DNS is configured)
docker compose -f ops/docker/compose.prod.yml run --rm certbot certonly ...
```

**Documentation:**

- 📘 [Production Deployment Guide](docs/PRODUCTION_DEPLOYMENT.md) - Complete deployment runbook
- 🔧 [Operations Guide](docs/OPERATIONS.md) - Day-to-day operations and maintenance
- 🔄 [Rollback Procedures](docs/ROLLBACK.md) - Emergency rollback guide
- 🔒 [Security Hardening](docs/SECURITY_HARDENING.md) - Security best practices

**Architecture:**

- **Frontend**: Next.js (standalone) behind Nginx
- **Backend**: FastAPI with Gunicorn + Uvicorn workers
- **Database**: PostgreSQL 16 with automated backups
- **Cache/Queue**: Redis 7 for RQ worker jobs
- **Reverse Proxy**: Nginx with SSL/TLS (Let's Encrypt)
- **Container Orchestration**: Docker Compose

**Key Features:**

- ✅ Multi-stage Docker builds for optimal image size
- ✅ Health checks and automatic restarts
- ✅ Resource limits and monitoring
- ✅ Automated database backups with rotation
- ✅ SSL/HTTPS with auto-renewal (Certbot)
- ✅ Security headers and rate limiting
- ✅ Automated deployment scripts
- ✅ GitHub Actions CI/CD pipeline
- ✅ Comprehensive logging and monitoring

See [docs/PRODUCTION_DEPLOYMENT.md](docs/PRODUCTION_DEPLOYMENT.md) for detailed instructions.

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License.

See [docs/FEEDBACK_SUMMARY.md](docs/FEEDBACK_SUMMARY.md) for detailed setup instructions.

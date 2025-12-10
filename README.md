![CI](https://github.com/nveerman1/team-evaluatie-app/actions/workflows/ci.yml/badge.svg?branch=main)

# Team Evaluatie App

Een multi-tenant webapplicatie voor peer evaluaties, projectbeoordelingen en competentiemonitoring met AI-powered feedback summaries.

## Features

### Multi-Tenant & Multi-Course Architecture
- **Multi-school support**: Volledig gescheiden data per school
- **Multiple courses**: Ondersteuning voor O&O, XPLR, Biologie, Nederlands, Engels, etc.
- **Teacher-course mapping**: Docenten worden expliciet gekoppeld aan vakken
- **Role-Based Access Control (RBAC)**: Admin, teacher en student rollen met granulaire toegangscontrole
- **Audit logging**: Alle muterende acties worden gelogd voor compliance

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
- Ollama voor lokale LLM verwerking
- Volledige anonimisering van namen en PII
- Caching voor efficiëntie
- Fallback naar regel-gebaseerde summaries

### Somtoday Integration (Preparation)
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

After running the seed script:
- **Admin**: admin@demo.school / demo123
- **Teacher**: teacher1@school1.demo / demo123
- **Student**: student.4a.1@school1.demo / demo123

## Documentation

- [Architecture](docs/architecture.md) - Multi-tenant architecture, data model, RBAC
- [Migration Notes](MIGRATION_NOTES.md) - Database migration guide
- [Feedback Summary](docs/FEEDBACK_SUMMARY.md) - AI feedback configuration
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
pytest
```

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

See deployment documentation in `ops/` directory.

## Contributing

1. Create a feature branch
2. Make your changes
3. Write tests
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License.

See [docs/FEEDBACK_SUMMARY.md](docs/FEEDBACK_SUMMARY.md) for detailed setup instructions.

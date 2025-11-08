![CI](https://github.com/nveerman1/team-evaluatie-app/actions/workflows/ci.yml/badge.svg?branch=main)

# Team Evaluatie App

Een webapplicatie voor peer evaluaties met AI-powered feedback summaries.

## Features

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
OLLAMA_TIMEOUT=60.0                     # Default: 60 seconds
```

See [docs/FEEDBACK_SUMMARY.md](docs/FEEDBACK_SUMMARY.md) for detailed setup instructions.

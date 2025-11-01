![CI](https://github.com/nveerman1/team-evaluatie-app/actions/workflows/ci.yml/badge.svg?branch=main)

# Team Evaluatie App

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

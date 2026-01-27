# Deployment Guide

This guide provides an overview of deployment options for the Team Evaluatie App, with links to detailed documentation for each deployment method.

## Table of Contents

1. [Deployment Architecture](#deployment-architecture)
2. [Production Deployment](#production-deployment)
3. [Development Environment](#development-environment)
4. [Docker Deployment](#docker-deployment)
5. [Manual Deployment](#manual-deployment)
6. [Post-Deployment](#post-deployment)

---

## Deployment Architecture

The Team Evaluatie App uses a containerized architecture with the following components:

```
┌─────────────────────────────────────────────────┐
│                  Nginx (Reverse Proxy)          │
│              SSL/TLS, Rate Limiting             │
└─────────┬────────────────────────┬──────────────┘
          │                        │
    ┌─────▼─────────┐      ┌──────▼────────┐
    │   Frontend    │      │   Backend     │
    │   (Next.js)   │      │   (FastAPI)   │
    │   Port 3000   │      │   Port 8000   │
    └───────────────┘      └───────┬───────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
            ┌───────▼────┐  ┌──────▼─────┐ ┌────▼────┐
            │ PostgreSQL │  │   Redis    │ │ Worker  │
            │  Database  │  │ Cache/Queue│ │   (RQ)  │
            └────────────┘  └────────────┘ └─────────┘
```

### Technology Stack

- **Frontend**: Next.js 15 (standalone build)
- **Backend**: FastAPI with Gunicorn + Uvicorn workers
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 8
- **Background Jobs**: RQ (Redis Queue) worker
- **Reverse Proxy**: Nginx with SSL/TLS
- **Container Orchestration**: Docker Compose

---

## Production Deployment

For production deployment to a VPS (Virtual Private Server) with Docker Compose, Nginx, and SSL:

### Quick Start

```bash
# 1. Clone repository on VPS
git clone https://github.com/nveerman1/team-evaluatie-app.git
cd team-evaluatie-app

# 2. Configure environment
cp .env.prod.example .env.prod
# Edit .env.prod with your settings

# 3. Deploy
docker compose -f ops/docker/compose.prod.yml up -d

# 4. Setup SSL (after DNS is configured)
docker compose -f ops/docker/compose.prod.yml run --rm certbot certonly ...
```

### Detailed Documentation

- **[Production Deployment Runbook](./PRODUCTION_DEPLOYMENT.md)** - Complete step-by-step guide
  - VPS setup and configuration
  - Docker installation
  - Environment configuration
  - SSL/HTTPS setup with Let's Encrypt
  - Database initialization and migrations
  - Service health checks

- **[Operations Guide](./OPERATIONS.md)** - Day-to-day operations
  - Starting/stopping services
  - Database backups and restores
  - Log management
  - Monitoring and alerts
  - Scaling guidelines

- **[Rollback Procedures](./ROLLBACK.md)** - Emergency rollback guide
  - Quick rollback steps
  - Database restoration
  - Docker image rollback
  - Troubleshooting failed deployments

- **[CI/CD Guide](./ci_cd.md)** - Automated deployment
  - GitHub Actions workflows
  - Automated testing and security scans
  - Automated production deployments

### Key Features

- ✅ **Zero-downtime deployments**: Rolling updates with health checks
- ✅ **Automated backups**: Daily database backups with rotation
- ✅ **SSL/HTTPS**: Automatic certificate management with Let's Encrypt
- ✅ **Security**: Rate limiting, security headers, firewall rules
- ✅ **Monitoring**: Health endpoints, Docker healthchecks, log aggregation
- ✅ **Scalability**: Horizontal scaling via Docker Compose replicas

---

## Development Environment

For local development with hot-reloading and debugging:

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Docker & Docker Compose (optional, for database only)

### Quick Start

```bash
# 1. Start database (using Docker)
make up
# or: docker compose -f ops/docker/compose.dev.yml up -d

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements-dev.txt

# Run migrations
alembic upgrade head

# Seed demo data (optional)
python scripts/seed_demo_data.py

# Start backend
uvicorn app.main:app --reload

# 3. Frontend setup (in new terminal)
cd frontend
npm install  # or: pnpm install
npm run dev

# 4. Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Configuration

Create `.env` files for local development:

**Backend** (`backend/.env`):
```env
DATABASE_URL=postgresql://team_eval:dev_password@localhost:5432/team_eval
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-dev-secret-key
ENABLE_DEV_LOGIN=true
NODE_ENV=development
```

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENABLE_DEV_LOGIN=true
```

---

## Docker Deployment

### Development with Docker

Full stack in Docker for development:

```bash
# Start all services
docker compose -f ops/docker/compose.dev.yml up -d

# View logs
docker compose -f ops/docker/compose.dev.yml logs -f

# Stop all services
docker compose -f ops/docker/compose.dev.yml down
```

Services:
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **Database**: localhost:5432
- **Redis**: localhost:6379

### Production with Docker

```bash
# Build and start production stack
docker compose -f ops/docker/compose.prod.yml up -d --build

# View logs
docker compose -f ops/docker/compose.prod.yml logs -f backend frontend

# Restart specific service
docker compose -f ops/docker/compose.prod.yml restart backend

# Stop all services
docker compose -f ops/docker/compose.prod.yml down
```

### Docker Images

Multi-stage builds optimize image sizes:

- **Backend**: Python slim base (~200MB)
- **Frontend**: Node alpine + Next.js standalone (~150MB)
- **Database**: PostgreSQL 16 official image
- **Redis**: Redis 8 alpine image
- **Nginx**: Nginx stable alpine image

---

## Manual Deployment

For deployment without Docker (e.g., traditional server setup):

### Backend Deployment

```bash
# 1. Install Python dependencies
cd backend
pip install -r requirements.txt

# 2. Configure environment
cp .env.production.example .env
# Edit .env with production settings

# 3. Run database migrations
alembic upgrade head

# 4. Start with Gunicorn
gunicorn app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

### Frontend Deployment

```bash
# 1. Build frontend
cd frontend
npm ci --production
npm run build

# 2. Start production server
npm start
# Or use standalone output:
node .next/standalone/server.js
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/team-evaluatie-app
server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Systemd Services

Create systemd service files for automatic startup:

**Backend** (`/etc/systemd/system/team-eval-backend.service`):
```ini
[Unit]
Description=Team Evaluatie App Backend
After=network.target postgresql.service

[Service]
Type=notify
User=deploy
WorkingDirectory=/opt/team-evaluatie-app/backend
Environment="PATH=/opt/team-evaluatie-app/backend/venv/bin"
ExecStart=/opt/team-evaluatie-app/backend/venv/bin/gunicorn \
    app.main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

**Frontend** (`/etc/systemd/system/team-eval-frontend.service`):
```ini
[Unit]
Description=Team Evaluatie App Frontend
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/team-evaluatie-app/frontend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl enable team-eval-backend
sudo systemctl enable team-eval-frontend
sudo systemctl start team-eval-backend
sudo systemctl start team-eval-frontend
```

---

## Post-Deployment

### Health Checks

Verify deployment success:

```bash
# Check backend health
curl https://yourdomain.com/api/v1/health

# Check frontend
curl https://yourdomain.com/

# Check SSL certificate
curl -vI https://yourdomain.com 2>&1 | grep -i "SSL certificate"
```

### Initial Setup

1. **Create admin user** (via backend console or seed script)
2. **Configure Azure AD** for authentication (see [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md))
3. **Setup monitoring** (optional: Prometheus, Grafana)
4. **Configure backups** (database, uploaded files)
5. **Test email delivery** (if using email notifications)

### Monitoring

Monitor application health and performance:

```bash
# Docker logs
docker compose -f ops/docker/compose.prod.yml logs -f --tail=100

# Backend logs
docker compose -f ops/docker/compose.prod.yml logs backend

# Database connections
docker compose -f ops/docker/compose.prod.yml exec db \
  psql -U team_eval -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory usage
docker compose -f ops/docker/compose.prod.yml exec redis redis-cli INFO memory
```

### Database Migrations

Apply new migrations after updates:

```bash
# Using Docker
docker compose -f ops/docker/compose.prod.yml exec backend \
  alembic upgrade head

# Manual deployment
cd backend
alembic upgrade head
```

### Backup and Restore

**Backup:**
```bash
# Database backup
docker compose -f ops/docker/compose.prod.yml exec db \
  pg_dump -U team_eval team_eval > backup_$(date +%Y%m%d).sql

# Or use automated backup script
./scripts/backup.sh
```

**Restore:**
```bash
# Restore database
docker compose -f ops/docker/compose.prod.yml exec -T db \
  psql -U team_eval team_eval < backup_20260123.sql
```

---

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check service status
docker compose -f ops/docker/compose.prod.yml ps

# View service logs
docker compose -f ops/docker/compose.prod.yml logs backend

# Check for port conflicts
sudo netstat -tulpn | grep -E ':(80|443|3000|8000|5432|6379)'
```

#### Database Connection Issues

```bash
# Test database connection
docker compose -f ops/docker/compose.prod.yml exec backend \
  python -c "from app.db.session import engine; print(engine.url)"

# Check database status
docker compose -f ops/docker/compose.prod.yml exec db \
  psql -U team_eval -c "SELECT version();"
```

#### SSL Certificate Issues

```bash
# Renew certificate
docker compose -f ops/docker/compose.prod.yml run --rm certbot renew

# Check certificate expiry
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com < /dev/null 2>/dev/null | \
  openssl x509 -noout -dates
```

---

## Related Documentation

- **[Production Deployment](./PRODUCTION_DEPLOYMENT.md)** - Complete production setup guide
- **[Operations Guide](./OPERATIONS.md)** - Day-to-day operations and maintenance
- **[Rollback Procedures](./ROLLBACK.md)** - Emergency rollback guide
- **[CI/CD Guide](./ci_cd.md)** - Automated deployment with GitHub Actions
- **[Security Guide](../SECURITY.md)** - Security best practices
- **[Architecture Guide](./architecture.md)** - System architecture overview
- **[Code Structure](./code_structure.md)** - Codebase organization

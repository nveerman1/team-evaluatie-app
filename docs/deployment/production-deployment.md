# Production Deployment Runbook

Complete guide for deploying Team Evaluatie App to production on a TransIP VPS.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial VPS Setup](#initial-vps-setup)
3. [Application Deployment](#application-deployment)
4. [SSL/HTTPS Configuration](#ssl-https-configuration)
5. [Database Management](#database-management)
6. [Monitoring & Logs](#monitoring--logs)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Requirements

- **VPS**: TransIP Ubuntu 22.04 LTS (minimum 2 CPU, 4GB RAM, 40GB disk)
- **Domain**: Domain name pointing to VPS IP (A record)
- **Access**: SSH access with sudo privileges
- **Local**: Git, Docker (for testing)

### Services Overview

- **Frontend**: Next.js (port 3000 internally)
- **Backend**: FastAPI with Gunicorn+Uvicorn (port 8000 internally)
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7
- **Worker**: RQ worker for async jobs
- **Reverse Proxy**: Nginx (ports 80, 443)

---

## Initial VPS Setup

### Step 1: Connect to VPS

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y
```

### Step 2: Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Enable Docker to start on boot
systemctl enable docker
systemctl start docker

# Verify installation
docker --version
docker compose version
```

### Step 3: Create Application User (Optional but Recommended)

```bash
# Create deploy user
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Switch to deploy user
su - deploy
```

### Step 4: Configure Firewall

```bash
# Install ufw if not present
sudo apt install ufw -y

# Configure firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Enable firewall
sudo ufw enable
sudo ufw status
```

### Step 5: Install Additional Tools

```bash
# Install useful tools
sudo apt install -y git curl vim htop fail2ban unattended-upgrades

# Configure fail2ban for SSH protection
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### Step 6: Setup Automatic Security Updates

```bash
# Enable unattended upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Edit configuration if needed
sudo vim /etc/apt/apt.conf.d/50unattended-upgrades
```

---

## Application Deployment

### Step 1: Clone Repository

```bash
# Navigate to installation directory
cd /opt

# Clone repository
sudo git clone https://github.com/nveerman1/team-evaluatie-app.git
sudo chown -R deploy:deploy team-evaluatie-app  # If using deploy user

# Navigate to project
cd team-evaluatie-app
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.prod.example .env.prod

# Edit environment file
vim .env.prod
```

**CRITICAL: Update these values in `.env.prod`:**

```bash
# Generate secure secrets
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'

# Update in .env.prod:
SECRET_KEY=<generated-secret-key>
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>

# Set your domain
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com

# Configure Azure AD (see AZURE_AD_SETUP.md)
AZURE_AD_CLIENT_ID=...
AZURE_AD_TENANT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_REDIRECT_URI=https://yourdomain.com/api/v1/auth/azure/callback

# Enable production settings
NODE_ENV=production
APP_ENV=production
COOKIE_SECURE=true

# Security Note (as of 2026-01-14):
# NODE_ENV=production enables critical security features:
# - Disables API documentation (/docs, /redoc, /openapi.json)
# - Enables hardened Content-Security-Policy (no unsafe-eval)
# - Enforces stricter security header configurations
```

### Step 3: Create Backup Directory

```bash
# Create backup directory
sudo mkdir -p /var/backups/tea
sudo chown deploy:deploy /var/backups/tea
```

### Step 4: Initial Deployment (HTTP Only)

```bash
# Start services (initially on HTTP for SSL setup)
docker compose -f ops/docker/compose.prod.yml up -d

# Check status
docker compose -f ops/docker/compose.prod.yml ps

# View logs
docker compose -f ops/docker/compose.prod.yml logs -f
```

### Step 5: Run Database Migrations

```bash
# Run initial migrations
bash scripts/migrate.sh

# Verify database
docker exec tea_db psql -U tea -d tea_production -c "\dt"
```

### Step 6: Create Initial Admin User

```bash
# Access backend container
docker exec -it tea_backend bash

# Run seed script or create user manually
python scripts/seed_demo_data.py  # For development data
# Or create admin manually via API/direct DB insert
```

---

## SSL/HTTPS Configuration

### Step 1: Update Nginx Site Configuration

```bash
# Edit nginx site config
vim ops/nginx/site.conf

# Replace 'yourdomain.com' with your actual domain
# Use find and replace in vim:
:%s/yourdomain.com/your-actual-domain.com/g
```

### Step 2: Obtain SSL Certificate with Certbot

```bash
# Stop nginx temporarily
docker compose -f ops/docker/compose.prod.yml stop nginx

# Run Certbot
docker compose -f ops/docker/compose.prod.yml run --rm certbot \
  certonly \
  --standalone \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com

# Certificates will be stored in the certbot-certs volume
```

### Step 3: Enable HTTPS in Nginx

```bash
# Edit nginx config
vim ops/nginx/site.conf

# Uncomment the HTTPS server block (entire section marked with # before it)
# Comment out the temporary HTTP proxy section
# Uncomment the HTTP to HTTPS redirect

# Restart nginx
docker compose -f ops/docker/compose.prod.yml restart nginx
```

### Step 4: Setup Automatic Certificate Renewal

```bash
# Test renewal
docker compose -f ops/docker/compose.prod.yml run --rm certbot renew --dry-run

# Setup cron job for auto-renewal
crontab -e

# Add this line (runs every day at 3 AM):
0 3 * * * cd /opt/team-evaluatie-app && docker compose -f ops/docker/compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot && docker compose -f ops/docker/compose.prod.yml exec nginx nginx -s reload
```

### Step 5: Enable HSTS (After Testing)

```bash
# Edit SSL config
vim ops/nginx/ssl.conf

# Uncomment HSTS header (only after confirming HTTPS works):
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# Reload nginx
docker compose -f ops/docker/compose.prod.yml exec nginx nginx -s reload
```

---

## Database Management

### Migrations

```bash
# Check migration status
bash scripts/migrate.sh --check

# Run migrations
bash scripts/migrate.sh

# Rollback one migration
bash scripts/migrate.sh --rollback 1
```

### Backups

```bash
# Manual backup
bash scripts/backup_db.sh

# Quick backup (no compression)
bash scripts/backup_db.sh --quick

# List backups
bash scripts/backup_db.sh --list

# Setup automated daily backups
crontab -e

# Add: Daily backup at 2 AM
0 2 * * * cd /opt/team-evaluatie-app && bash scripts/backup_db.sh >> /var/log/tea-backup.log 2>&1
```

### Restore

```bash
# Restore from latest backup
bash scripts/restore_db.sh --latest

# Restore from specific backup
bash scripts/restore_db.sh /var/backups/tea/2024-01/tea_backup_20240115_020000.sql.gz
```

---

## Monitoring & Logs

### View Logs

```bash
# View all logs
docker compose -f ops/docker/compose.prod.yml logs -f

# View specific service logs
docker compose -f ops/docker/compose.prod.yml logs -f backend
docker compose -f ops/docker/compose.prod.yml logs -f frontend
docker compose -f ops/docker/compose.prod.yml logs -f worker

# View last 100 lines
docker compose -f ops/docker/compose.prod.yml logs --tail=100
```

### Check Service Health

```bash
# Check container status
docker compose -f ops/docker/compose.prod.yml ps

# Check service health
docker inspect tea_backend --format='{{.State.Health.Status}}'
docker inspect tea_frontend --format='{{.State.Health.Status}}'

# Test health endpoints
curl http://localhost:8000/health  # Backend
curl http://localhost:3000/api/health  # Frontend (may need custom endpoint)
```

### Monitor Resources

```bash
# Docker stats
docker stats

# System resources
htop

# Disk usage
df -h
docker system df
```

### Log Rotation

Docker automatically limits log files (configured in compose.prod.yml):
- Max size: 10MB per file
- Max files: 3-5 per service

For additional log management:

```bash
# Clean old logs
docker compose -f ops/docker/compose.prod.yml logs --since 7d > /dev/null

# Prune old containers/images
docker system prune -a --volumes -f
```

---

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose -f ops/docker/compose.prod.yml logs

# Check specific service
docker logs tea_backend --tail=50

# Verify environment variables
docker compose -f ops/docker/compose.prod.yml config

# Recreate containers
docker compose -f ops/docker/compose.prod.yml up -d --force-recreate
```

### Database Connection Issues

```bash
# Check if database is running
docker compose -f ops/docker/compose.prod.yml ps db

# Check database logs
docker logs tea_db

# Test connection from backend
docker exec tea_backend python -c "from app.infra.database import engine; engine.connect(); print('OK')"

# Check PostgreSQL directly
docker exec tea_db psql -U tea -d tea_production -c "SELECT version();"
```

### SSL Certificate Issues

```bash
# Check certificate expiry
docker compose -f ops/docker/compose.prod.yml run --rm certbot certificates

# Renew certificate manually
docker compose -f ops/docker/compose.prod.yml run --rm certbot renew

# Test nginx config
docker compose -f ops/docker/compose.prod.yml exec nginx nginx -t

# Reload nginx
docker compose -f ops/docker/compose.prod.yml exec nginx nginx -s reload
```

### Worker Not Processing Jobs

```bash
# Check worker logs
docker logs tea_worker -f

# Check Redis connection
docker exec tea_worker python -c "import redis; r=redis.from_url('redis://:pass@redis:6379/0'); print(r.ping())"

# Restart worker
docker compose -f ops/docker/compose.prod.yml restart worker
```

### High CPU/Memory Usage

```bash
# Check resource usage
docker stats

# Scale backend workers (adjust in Dockerfile CMD or compose override)
# Reduce Gunicorn workers if needed

# Check for memory leaks
docker compose -f ops/docker/compose.prod.yml logs | grep -i "memory\|oom"

# Restart services
docker compose -f ops/docker/compose.prod.yml restart
```

### Site is Slow

```bash
# Check database performance
docker exec tea_db psql -U tea -d tea_production -c "SELECT * FROM pg_stat_activity;"

# Check Redis
docker exec tea_redis redis-cli --pass <password> info stats

# Enable PostgreSQL query logging (temporarily)
# Add to docker-compose-prod.yml under db service:
# command: postgres -c log_statement=all
```

---

## Common Commands Reference

```bash
# Start all services
docker compose -f ops/docker/compose.prod.yml up -d

# Stop all services
docker compose -f ops/docker/compose.prod.yml down

# Restart specific service
docker compose -f ops/docker/compose.prod.yml restart backend

# View logs
docker compose -f ops/docker/compose.prod.yml logs -f

# Run migrations
bash scripts/migrate.sh

# Create backup
bash scripts/backup_db.sh

# Deploy updates
bash scripts/deploy.sh

# Access backend shell
docker exec -it tea_backend bash

# Access database shell
docker exec -it tea_db psql -U tea -d tea_production
```

---

## Emergency Procedures

### Rollback Deployment

```bash
# Option 1: Using deploy script
bash scripts/deploy.sh --rollback

# Option 2: Manual rollback
git checkout <previous-commit>
docker compose -f ops/docker/compose.prod.yml up -d --force-recreate

# Option 3: Restore from backup
bash scripts/restore_db.sh --latest
```

### Site Down - Emergency Recovery

```bash
# 1. Check all services
docker compose -f ops/docker/compose.prod.yml ps

# 2. Check logs for errors
docker compose -f ops/docker/compose.prod.yml logs --tail=100

# 3. Restart all services
docker compose -f ops/docker/compose.prod.yml restart

# 4. If still down, recreate containers
docker compose -f ops/docker/compose.prod.yml down
docker compose -f ops/docker/compose.prod.yml up -d

# 5. Check health endpoints
curl https://yourdomain.com/health
curl https://yourdomain.com/api/v1/health
```

---

## Next Steps

After successful deployment:

1. ✅ Test all critical functionality
2. ✅ Setup monitoring (uptime checks, error tracking)
3. ✅ Configure automated backups
4. ✅ Document your specific configuration
5. ✅ Train team on operations procedures
6. ✅ Setup CI/CD (see `.github/workflows/deploy.yml`)
7. ✅ Configure Sentry or similar error tracking
8. ✅ Setup performance monitoring (New Relic, DataDog, etc.)

## Deployment Verification

After deployment, verify the following to ensure production build is running correctly:

### 1. Health Check Endpoints

```bash
# Backend health check
curl https://app.technasiummbh.nl/api/v1/health
# Expected: {"status":"ok"} or similar 200 response

# Nginx health check
curl https://app.technasiummbh.nl/health
# Expected: OK
```

### 2. Verify No CSP Violations

1. Open browser DevTools (F12)
2. Navigate to https://app.technasiummbh.nl
3. Check Console tab for CSP errors
4. **Should NOT see**: "Executing inline script violates CSP directive"
5. **Should see**: Application loading successfully without CSP blocks

### 3. Verify Production Build (No Turbopack/HMR)

1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to https://app.technasiummbh.nl
4. **Should NOT see**: Requests to `/_next/webpack-hmr` or similar HMR endpoints
5. **Should NOT see**: "Connection closed" messages in console
6. **Should see**: Only production bundle requests (e.g., `/_next/static/chunks/...`)

### 4. Verify CSP Headers

```bash
# Check CSP header in response
curl -I https://app.technasiummbh.nl

# Expected headers should include:
# Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'; ...
# Note: 'unsafe-inline' is required for Next.js 16+ to bootstrap properly
```

### 5. Verify Frontend Container is Running Production Build

```bash
# Check frontend logs for production indicators
docker compose -f ops/docker/compose.prod.yml logs frontend | head -20

# Should see: NODE_ENV=production
# Should NOT see: Turbopack or HMR references
```

For more details, see:
- [OPERATIONS.md](./OPERATIONS.md) - Day-to-day operations
- [ROLLBACK.md](./ROLLBACK.md) - Rollback procedures
- [SECURITY_HARDENING.md](./SECURITY_HARDENING.md) - Security best practices

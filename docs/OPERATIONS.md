# Operations Guide

Day-to-day operations guide for Team Evaluatie App in production.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Deployment Updates](#deployment-updates)
3. [Database Operations](#database-operations)
4. [Monitoring](#monitoring)
5. [Performance Tuning](#performance-tuning)
6. [Scaling](#scaling)

---

## Daily Operations

### Morning Checks (5 minutes)

```bash
# 1. Check service health
cd /opt/team-evaluatie-app
docker compose -f ops/docker/compose.prod.yml ps

# 2. Check disk space
df -h
docker system df

# 3. Review logs for errors
docker compose -f ops/docker/compose.prod.yml logs --since 24h | grep -i "error\|exception\|fail"

# 4. Check backup status
ls -lh /var/backups/tea/$(date +%Y-%m)/ | tail -5

# 5. Check SSL certificate expiry
docker compose -f ops/docker/compose.prod.yml run --rm certbot certificates
```

### Weekly Tasks

```bash
# Monday: Review resource usage
docker stats --no-stream

# Wednesday: Clean up Docker
docker system prune -f

# Friday: Test backup restoration
bash scripts/backup_db.sh
bash scripts/restore_db.sh --latest  # In test environment!

# Weekly: Review application logs
docker compose -f ops/docker/compose.prod.yml logs --since 7d > weekly_logs.txt
grep -i "error\|warning" weekly_logs.txt
```

### Monthly Tasks

- Review and rotate logs
- Update dependencies (security patches)
- Review monitoring metrics and alerts
- Database performance review
- Backup retention cleanup
- Security audit

---

## Deployment Updates

### Manual Deployment (Recommended for Production)

```bash
# 1. SSH into VPS
ssh deploy@your-vps-ip

# 2. Navigate to application
cd /opt/team-evaluatie-app

# 3. Pull latest changes
git fetch origin
git checkout main
git pull origin main

# 4. Review changes
git log --oneline -5
git diff HEAD~1 HEAD

# 5. Run deployment script
bash scripts/deploy.sh

# The script will:
# - Create pre-deployment backup
# - Build new Docker images
# - Run database migrations
# - Deploy updated services
# - Verify deployment
```

### Quick Update (No Code Changes)

```bash
# For configuration or environment changes only
docker compose -f ops/docker/compose.prod.yml restart

# Or restart specific service
docker compose -f ops/docker/compose.prod.yml restart backend
```

### Using GitHub Actions (Automated)

1. Go to GitHub repository → Actions
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Choose options (skip backup, skip build)
5. Monitor deployment progress

### Deployment with Minimal Downtime

```bash
# For zero-downtime deployments (future enhancement):
# 1. Deploy new version alongside old
# 2. Switch traffic gradually
# 3. Monitor for errors
# 4. Complete cutover or rollback
```

---

## Database Operations

### Running Migrations

```bash
# Check migration status
bash scripts/migrate.sh --check

# Run migrations (with backup)
bash scripts/migrate.sh

# Migrations are automatically run during deployment
# But can be run manually if needed
```

### Creating Migration

```bash
# Access backend container
docker exec -it tea_backend bash

# Create new migration
alembic revision --autogenerate -m "description of changes"

# Review generated migration file
cat migrations/versions/latest_migration.py

# Exit container
exit

# Commit migration file to git
git add backend/migrations/versions/*.py
git commit -m "Add migration: description"
git push
```

### Database Backup

```bash
# Manual backup
bash scripts/backup_db.sh

# List recent backups
bash scripts/backup_db.sh --list

# Backups are stored in:
ls -lh /var/backups/tea/

# Automated backups run daily at 2 AM (configured in crontab)
```

### Database Restore

```bash
# ⚠️ WARNING: This will DESTROY current data!

# Restore from latest backup
bash scripts/restore_db.sh --latest

# Restore from specific backup
bash scripts/restore_db.sh /var/backups/tea/2024-01/tea_backup_20240115_020000.sql.gz
```

### Database Maintenance

```bash
# Access PostgreSQL
docker exec -it tea_db psql -U tea -d tea_production

# Vacuum database (reclaim space)
VACUUM ANALYZE;

# Check database size
SELECT pg_size_pretty(pg_database_size('tea_production'));

# Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

# Check active connections
SELECT * FROM pg_stat_activity;

# Exit
\q
```

---

## Monitoring

### Application Health

```bash
# Check all services
docker compose -f ops/docker/compose.prod.yml ps

# Check individual service health
curl http://localhost:8000/health  # Backend
curl https://yourdomain.com/health  # Via nginx

# Check worker status (via Redis)
docker exec tea_redis redis-cli --pass <redis-password> INFO stats
```

### Log Monitoring

```bash
# View live logs
docker compose -f ops/docker/compose.prod.yml logs -f

# Search for errors
docker compose -f ops/docker/compose.prod.yml logs | grep -i "error"

# Backend logs
docker logs tea_backend --tail=100 -f

# Worker logs (for async jobs)
docker logs tea_worker --tail=100 -f

# Nginx access logs
docker logs tea_nginx --tail=50

# Filter by time
docker compose -f ops/docker/compose.prod.yml logs --since 1h
docker compose -f ops/docker/compose.prod.yml logs --since "2024-01-15T10:00:00"
```

### Resource Monitoring

```bash
# Real-time container stats
docker stats

# Disk usage
df -h
du -sh /var/lib/docker

# Docker disk usage
docker system df -v

# Network connections
netstat -tulpn | grep -E ":(80|443|8000|3000|5432|6379)"
```

### External Monitoring Setup

#### Uptime Monitoring (UptimeRobot, Pingdom, etc.)

1. Create monitor for: `https://yourdomain.com/health`
2. Alert on: HTTP status != 200
3. Check interval: 5 minutes

#### Error Tracking (Sentry)

Already configured if `SENTRY_DSN` is set in `.env.prod`

#### Log Aggregation (Optional)

For advanced logging, consider:
- **Loki + Promtail**: Lightweight log aggregation
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Grafana Cloud**: Managed solution

---

## Performance Tuning

### Backend Performance

```bash
# Adjust Gunicorn workers in backend/Dockerfile
# Current: 4 workers
# Formula: (2 x CPU cores) + 1
# For 2 CPU: 5 workers
# For 4 CPU: 9 workers

# Edit backend/Dockerfile:
CMD ["gunicorn", "app.main:app", \
     "--workers", "9", \  # Adjust based on CPU
     ...
]

# Rebuild and deploy
docker compose -f ops/docker/compose.prod.yml up -d --build backend
```

### Database Performance

```bash
# Access PostgreSQL
docker exec -it tea_db psql -U tea -d tea_production

# Check slow queries
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# Enable pg_stat_statements (if not enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

# Check missing indexes
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n_distinct DESC;

# Adjust PostgreSQL settings (in compose.prod.yml)
# Add under db service environment:
POSTGRES_SHARED_BUFFERS=256MB      # 25% of RAM
POSTGRES_EFFECTIVE_CACHE_SIZE=1GB  # 50% of RAM
POSTGRES_WORK_MEM=16MB             # RAM / max_connections
```

### Redis Performance

```bash
# Check Redis stats
docker exec tea_redis redis-cli --pass <password> INFO stats

# Check memory usage
docker exec tea_redis redis-cli --pass <password> INFO memory

# Adjust max memory (in compose.prod.yml)
# Current: 512MB
# Increase if needed for more caching

# Check slow commands
docker exec tea_redis redis-cli --pass <password> SLOWLOG GET 10
```

### Frontend Performance

```bash
# Next.js is pre-built with optimizations
# Static assets are cached (see nginx config)

# Check bundle size
docker exec tea_frontend ls -lh .next/static/

# For further optimization:
# 1. Enable Brotli compression (nginx)
# 2. Add CDN (Cloudflare, Fastly)
# 3. Optimize images (Next.js Image component)
```

---

## Scaling

### Vertical Scaling (Upgrade VPS)

1. Backup database
2. Create snapshot of VPS (if available)
3. Upgrade VPS plan (more CPU/RAM)
4. Adjust resource limits in compose.prod.yml
5. Redeploy

### Horizontal Scaling (Multiple Instances)

For higher load, consider:

**Option 1: Multiple Workers**

```yaml
# In compose.prod.yml, add more worker instances
worker:
  deploy:
    replicas: 3  # Run 3 worker instances
```

**Option 2: Multiple Backend Instances**

```yaml
backend:
  deploy:
    replicas: 3  # Run 3 backend instances
  # Nginx will load balance automatically
```

**Option 3: Separate Database Server**

1. Provision separate VPS for PostgreSQL
2. Update DATABASE_URL in .env.prod
3. Configure PostgreSQL for remote connections
4. Update firewall rules

**Option 4: CDN for Frontend**

1. Setup Cloudflare (free tier)
2. Point DNS to Cloudflare
3. Enable caching rules
4. Benefits: DDoS protection, global CDN

### Load Balancing

For multiple VPS instances:

```nginx
# In nginx config
upstream backend {
    server backend-1:8000;
    server backend-2:8000;
    server backend-3:8000;
}
```

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Service won't start | `docker compose -f ops/docker/compose.prod.yml up -d --force-recreate` |
| High memory usage | `docker stats` → reduce worker count or scale up VPS |
| Disk full | `docker system prune -a --volumes -f` |
| Database slow | Run `VACUUM ANALYZE`, add indexes, increase resources |
| SSL certificate expired | `docker compose -f ops/docker/compose.prod.yml run --rm certbot renew` |
| Worker not processing jobs | `docker logs tea_worker` → restart worker |
| 502 Bad Gateway | Backend is down → check logs, restart backend |
| High CPU usage | Check for infinite loops, optimize queries, add caching |

---

## Contact & Support

For issues or questions:

1. Check logs: `docker compose -f ops/docker/compose.prod.yml logs`
2. Review documentation: `docs/` directory
3. Check GitHub issues
4. Contact development team

---

## Regular Maintenance Schedule

### Daily
- ✅ Check service health (automated)
- ✅ Review error logs (automated)

### Weekly
- ✅ Review resource usage
- ✅ Clean up Docker resources
- ✅ Test backups

### Monthly
- ✅ Update dependencies (security patches)
- ✅ Database maintenance (VACUUM)
- ✅ Review monitoring metrics
- ✅ Security audit

### Quarterly
- ✅ Performance review and tuning
- ✅ Backup restoration test (full)
- ✅ Disaster recovery drill
- ✅ Update runbooks

---

**Remember**: Always test changes in a staging environment before applying to production!

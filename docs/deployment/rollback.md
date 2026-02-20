# Rollback Procedures

Emergency rollback guide for Team Evaluatie App production deployments.

## Table of Contents

1. [Quick Rollback](#quick-rollback)
2. [Rollback Types](#rollback-types)
3. [Decision Matrix](#decision-matrix)
4. [Detailed Procedures](#detailed-procedures)
5. [Post-Rollback](#post-rollback)

---

## Quick Rollback

**Use this for emergencies:**

```bash
# SSH to VPS
ssh deploy@your-vps-ip

# Navigate to application
cd /opt/team-evaluatie-app

# Run rollback
bash scripts/deploy.sh --rollback

# Verify services
docker compose -f ops/docker/compose.prod.yml ps
curl https://yourdomain.com/health
```

---

## Rollback Types

### Type 1: Code-Only Rollback
No database changes, only application code.

- **Risk**: Low
- **Downtime**: ~30 seconds
- **Data Loss**: None

### Type 2: Code + Database Rollback
Database schema was changed (migrations ran).

- **Risk**: Medium to High
- **Downtime**: 2-5 minutes
- **Data Loss**: Possible (data added since deployment)

### Type 3: Full System Rollback
Complete restoration from backup.

- **Risk**: High
- **Downtime**: 10-30 minutes
- **Data Loss**: Yes (to backup point)

---

## Decision Matrix

| Scenario | Rollback Type | Priority |
|----------|---------------|----------|
| Application crash, no DB changes | Type 1 | 🔴 Immediate |
| Performance issues, no DB changes | Type 1 | 🟡 Can wait |
| Application + DB migration issues | Type 2 | 🔴 Immediate |
| Data corruption detected | Type 3 | 🔴 Immediate |
| Security breach | Type 3 + Investigation | 🔴 Critical |

---

## Detailed Procedures

### Type 1: Code-Only Rollback

**When to use:**
- Application code bug
- Configuration error
- No database migrations were run
- Frontend/backend crashes

**Steps:**

```bash
# 1. Identify previous working commit
git log --oneline -10

# 2. Checkout previous version
git checkout <previous-commit-hash>
# Example: git checkout abc1234

# 3. Rebuild and redeploy (script method)
bash scripts/deploy.sh --no-backup

# OR manual method:
docker compose -f ops/docker/compose.prod.yml build
docker compose -f ops/docker/compose.prod.yml up -d --force-recreate

# 4. Verify services
docker compose -f ops/docker/compose.prod.yml ps
docker compose -f ops/docker/compose.prod.yml logs --tail=50

# 5. Test critical functionality
curl https://yourdomain.com/health
curl https://yourdomain.com/api/v1/health

# 6. Monitor for 5-10 minutes
docker compose -f ops/docker/compose.prod.yml logs -f
```

**Time estimate:** 2-5 minutes

### Type 2: Code + Database Rollback

**When to use:**
- Database migration caused issues
- Schema changes breaking application
- Migration rollback is safe

**Steps:**

```bash
# 1. Stop application traffic (optional but recommended)
# Option A: Maintenance page via nginx
docker compose -f ops/docker/compose.prod.yml stop frontend backend

# Option B: Block traffic temporarily
sudo ufw deny 80
sudo ufw deny 443

# 2. Create emergency backup IMMEDIATELY
bash scripts/backup_db.sh --quick

# 3. Check migration status
bash scripts/migrate.sh --check

# 4. Rollback migrations
bash scripts/migrate.sh --rollback 1  # Rollback 1 migration
# Or: bash scripts/migrate.sh --rollback 2  # Rollback 2 migrations

# 5. Checkout previous code version
git checkout <previous-commit-hash>

# 6. Rebuild and redeploy
docker compose -f ops/docker/compose.prod.yml build
docker compose -f ops/docker/compose.prod.yml up -d --force-recreate

# 7. Restore traffic
sudo ufw allow 80
sudo ufw allow 443

# 8. Verify functionality
curl https://yourdomain.com/health
docker compose -f ops/docker/compose.prod.yml logs -f

# 9. Test database queries
docker exec tea_backend python -c "from app.infra.database import engine; print('DB OK' if engine.connect() else 'DB FAIL')"
```

**Time estimate:** 5-15 minutes

**⚠️ WARNING:**
- Data added after migration may be lost
- Test thoroughly before marking as complete
- Document what was rolled back

### Type 3: Full System Rollback

**When to use:**
- Complete system failure
- Data corruption
- Migration cannot be rolled back safely
- Security incident requiring known-good state

**Steps:**

```bash
# 1. STOP ALL SERVICES IMMEDIATELY
docker compose -f ops/docker/compose.prod.yml down

# 2. Block all traffic
sudo ufw deny 80
sudo ufw deny 443

# 3. Identify backup to restore
bash scripts/backup_db.sh --list

# Example output:
# 2024-01-15 10:00:00 - tea_backup_20240115_100000.sql.gz - 250M
# 2024-01-14 02:00:00 - tea_backup_20240114_020000.sql.gz - 248M

# 4. Choose backup (most recent before incident)
BACKUP_FILE="/var/backups/tea/2024-01/tea_backup_20240114_020000.sql.gz"

# 5. Restore database
bash scripts/restore_db.sh "$BACKUP_FILE"

# 6. Checkout code version matching backup
# Check git log for commit at backup time
git log --since="2024-01-14 00:00:00" --until="2024-01-14 04:00:00" --oneline
git checkout <matching-commit>

# 7. Rebuild containers
docker compose -f ops/docker/compose.prod.yml build --no-cache

# 8. Start services
docker compose -f ops/docker/compose.prod.yml up -d

# 9. Verify all services
docker compose -f ops/docker/compose.prod.yml ps
docker compose -f ops/docker/compose.prod.yml logs --tail=100

# 10. Test critical functionality
# - Login
# - View data
# - Create test record
# - Delete test record

# 11. Restore traffic (gradually)
sudo ufw allow 80
sudo ufw allow 443

# 12. Monitor intensively
docker compose -f ops/docker/compose.prod.yml logs -f
```

**Time estimate:** 15-45 minutes

**⚠️ CRITICAL:**
- All data since backup is LOST
- Document data loss window
- Communicate with users
- Investigate root cause

---

## Rollback Scenarios & Solutions

### Scenario 1: 502 Bad Gateway After Deployment

```bash
# Quick diagnosis
docker compose -f ops/docker/compose.prod.yml ps
docker logs tea_backend --tail=50

# If backend is unhealthy:
git checkout HEAD~1  # Previous commit
docker compose -f ops/docker/compose.prod.yml up -d --force-recreate backend
```

### Scenario 2: Database Migration Failed Mid-Way

```bash
# DON'T PANIC!
# 1. Check migration status
bash scripts/migrate.sh --check

# 2. If migration partially applied:
# Option A: Complete the migration
docker exec tea_backend alembic upgrade head

# Option B: Rollback the partial migration
bash scripts/migrate.sh --rollback 1

# 3. If rollback fails, restore from backup
bash scripts/restore_db.sh --latest
```

### Scenario 3: Worker Processing Jobs Incorrectly

```bash
# 1. Stop worker immediately
docker compose -f ops/docker/compose.prod.yml stop worker

# 2. Clear problematic jobs from Redis
docker exec tea_redis redis-cli --pass <password> FLUSHDB

# 3. Rollback code
git checkout HEAD~1
docker compose -f ops/docker/compose.prod.yml up -d --force-recreate worker

# 4. Verify
docker logs tea_worker -f
```

### Scenario 4: Frontend Rendering Issues

```bash
# Frontend only, backend working
# Quick fix:
git checkout HEAD~1
docker compose -f ops/docker/compose.prod.yml build frontend
docker compose -f ops/docker/compose.prod.yml up -d frontend

# Test
curl https://yourdomain.com
```

### Scenario 5: Critical Security Vulnerability

```bash
# IMMEDIATE RESPONSE

# 1. Take site offline
docker compose -f ops/docker/compose.prod.yml down
sudo ufw deny 80
sudo ufw deny 443

# 2. Create forensic backup
bash scripts/backup_db.sh --quick
cp .env.prod .env.prod.backup
docker compose -f ops/docker/compose.prod.yml logs > incident_logs.txt

# 3. Analyze threat
# - Check logs for suspicious activity
# - Identify compromised data
# - Document timeline

# 4. Restore from known-good backup
bash scripts/restore_db.sh <pre-incident-backup>

# 5. Deploy patched version
git checkout <secure-version>
docker compose -f ops/docker/compose.prod.yml build --no-cache
docker compose -f ops/docker/compose.prod.yml up -d

# 6. Verify security
# - Check for backdoors
# - Rotate all secrets
# - Update .env.prod
# - Regenerate SSL certificates if needed

# 7. Gradual restoration
sudo ufw allow 80
sudo ufw allow 443

# 8. Monitor closely
docker compose -f ops/docker/compose.prod.yml logs -f
```

---

## Post-Rollback

### Immediate Actions (0-30 minutes)

```bash
# 1. Verify system stability
docker compose -f ops/docker/compose.prod.yml ps
docker stats --no-stream

# 2. Test critical paths
# - User login
# - Data retrieval
# - Data modification
# - File uploads (if applicable)

# 3. Monitor logs intensively
docker compose -f ops/docker/compose.prod.yml logs -f

# 4. Check external monitors
# - Uptime monitors
# - Error tracking (Sentry)
# - User reports
```

### Short-term Actions (1-4 hours)

```bash
# 1. Document incident
vim /var/log/tea-incident-$(date +%Y%m%d).log
# Record:
# - What failed
# - When it was detected
# - Actions taken
# - Current status
# - Data loss (if any)

# 2. Notify stakeholders
# - Users (if appropriate)
# - Management
# - Development team

# 3. Continue monitoring
# - Check every 15 minutes
# - Watch resource usage
# - Monitor error rates

# 4. Create incident report
# - Timeline
# - Root cause (preliminary)
# - Impact assessment
# - Data loss summary
```

### Long-term Actions (1-7 days)

1. **Root Cause Analysis**
   - What went wrong?
   - Why did it happen?
   - How was it detected?
   - Why wasn't it caught earlier?

2. **Prevention Measures**
   - Add tests for failure scenario
   - Improve monitoring/alerts
   - Update deployment checklist
   - Enhance rollback procedures

3. **Process Improvements**
   - Update runbooks
   - Add pre-deployment checks
   - Improve staging environment
   - Enhance CI/CD pipeline

4. **Training**
   - Share lessons learned
   - Update documentation
   - Practice rollback procedures
   - Conduct post-mortem review

---

## Rollback Checklist

Before marking rollback as complete:

- [ ] All services running and healthy
- [ ] Health endpoints responding correctly
- [ ] Database accessible and consistent
- [ ] No error spikes in logs
- [ ] Users can login
- [ ] Critical functionality tested
- [ ] External monitors showing OK
- [ ] Resource usage normal
- [ ] Backup created post-rollback
- [ ] Incident documented
- [ ] Team notified
- [ ] Root cause analysis scheduled

---

## Emergency Contacts

Maintain list of contacts for escalation:

```
# Example structure (create your own)
Primary: Your Name - +31 6 12345678
Backup: Colleague - +31 6 87654321
Database Expert: DBA Name - +31 6 11111111
Security: Security Lead - +31 6 99999999
```

---

## Prevention is Better Than Cure

To minimize rollback necessity:

1. **Staging Environment**: Test all changes first
2. **Automated Tests**: Catch issues before deployment
3. **Gradual Rollouts**: Deploy to subset of users first
4. **Feature Flags**: Toggle features without deployment
5. **Monitoring**: Detect issues immediately
6. **Backups**: Always have recent backups
7. **Documentation**: Keep runbooks updated
8. **Practice**: Regular rollback drills

---

**Remember**: Stay calm, follow procedures, document everything!

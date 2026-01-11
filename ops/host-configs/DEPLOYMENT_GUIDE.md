# =============================================================================
# Production Hardening v2 - Deployment Guide
# =============================================================================
#
# This document provides step-by-step instructions for applying the Production
# Hardening v2 changes to the Team Evaluatie App VPS deployment.
#
# Prerequisites:
# - SSH access to VPS
# - Repository cloned at /srv/team-evaluatie-app
# - Docker and Docker Compose installed
# - Application currently running
#
# =============================================================================

## Phase 1: Pre-Deployment Preparation

### 1.1 Backup Current State

```bash
# SSH into VPS
ssh user@your-vps-ip

# Navigate to app directory
cd /srv/team-evaluatie-app

# Backup current configuration
sudo cp -r ops/docker ops/docker.backup.$(date +%Y%m%d)
sudo cp -r ops/nginx ops/nginx.backup.$(date +%Y%m%d)

# Backup .env.prod (if it exists)
sudo cp .env.prod .env.prod.backup.$(date +%Y%m%d)

# Create database backup
./ops/host-configs/backup-postgres.sh
```

### 1.2 Pull Latest Changes

```bash
# Fetch latest changes from repository
cd /srv/team-evaluatie-app
git fetch origin

# Checkout the hardening branch (replace with actual branch name)
git checkout copilot/implement-production-hardening-v2
git pull origin copilot/implement-production-hardening-v2
```

### 1.3 Review Changes

```bash
# Review Docker Compose changes
git diff main..copilot/implement-production-hardening-v2 ops/docker/compose.prod.yml

# Review Nginx changes
git diff main..copilot/implement-production-hardening-v2 ops/nginx/

# Review new host configurations
ls -la ops/host-configs/
```

## Phase 2: Apply Repository Changes

### 2.1 Update Nginx Configuration

```bash
# Validate nginx configuration syntax (dry run)
docker exec tea_nginx nginx -t

# If validation passes, reload nginx
docker exec tea_nginx nginx -s reload

# Check nginx logs for errors
docker logs tea_nginx --tail 50
```

### 2.2 Update Docker Compose Configuration

```bash
# Stop the application gracefully
docker compose -f ops/docker/compose.prod.yml down

# Pull latest images (if needed)
docker compose -f ops/docker/compose.prod.yml pull

# Start with new configuration
docker compose -f ops/docker/compose.prod.yml up -d

# Watch logs for startup
docker compose -f ops/docker/compose.prod.yml logs -f
```

### 2.3 Verify Container Health

```bash
# Check container status
docker compose -f ops/docker/compose.prod.yml ps

# All containers should show "healthy" status
# Wait ~60 seconds for all health checks to pass

# Check specific container logs
docker logs tea_backend --tail 50
docker logs tea_frontend --tail 50
docker logs tea_nginx --tail 50
```

## Phase 3: Configure Host-Level Security

### 3.1 Setup Nginx Log Access for Fail2ban

```bash
# Verify nginx logs are mounted to volume
docker volume inspect ops_nginx-logs

# Check log files are being written
sudo ls -lah /var/lib/docker/volumes/ops_nginx-logs/_data/

# You should see access.log, error.log, etc.
```

### 3.2 Install and Configure Fail2ban

```bash
# Install fail2ban
sudo apt-get update
sudo apt-get install -y fail2ban

# Copy jail configuration
sudo cp /srv/team-evaluatie-app/ops/host-configs/fail2ban-nginx.conf \
    /etc/fail2ban/jail.d/nginx-tea.conf

# Copy filter configurations
sudo cp /srv/team-evaluatie-app/ops/host-configs/fail2ban-filter-auth.conf \
    /etc/fail2ban/filter.d/nginx-tea-auth.conf

sudo cp /srv/team-evaluatie-app/ops/host-configs/fail2ban-filter-404.conf \
    /etc/fail2ban/filter.d/nginx-tea-404.conf

sudo cp /srv/team-evaluatie-app/ops/host-configs/fail2ban-filter-exploits.conf \
    /etc/fail2ban/filter.d/nginx-tea-exploits.conf

sudo cp /srv/team-evaluatie-app/ops/host-configs/fail2ban-filter-dos.conf \
    /etc/fail2ban/filter.d/nginx-tea-dos.conf

# Test fail2ban configuration
sudo fail2ban-client -d

# Start fail2ban
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

# Check status
sudo fail2ban-client status
sudo fail2ban-client status nginx-tea-auth
```

### 3.3 Configure Log Rotation

```bash
# Copy logrotate configuration
sudo cp /srv/team-evaluatie-app/ops/host-configs/logrotate-nginx.conf \
    /etc/logrotate.d/nginx-tea

# Test logrotate configuration
sudo logrotate -d /etc/logrotate.d/nginx-tea

# Force a test rotation (optional)
sudo logrotate -f /etc/logrotate.d/nginx-tea

# Verify logrotate will run daily (should be automatic via cron.daily)
ls -la /etc/cron.daily/logrotate
```

### 3.4 Configure UFW Firewall

**IMPORTANT: Follow these steps carefully to avoid locking yourself out!**

#### Option A: Staging Mode (Testing - Restricted Access)

```bash
# 1. FIRST: Secure SSH access (choose one option)

# Option 1: Allow SSH from your IP only (recommended)
sudo ufw allow from YOUR_IP_ADDRESS to any port 22 proto tcp comment 'SSH from trusted IP'

# Option 2: Allow SSH from anywhere (less secure but safer during setup)
sudo ufw allow 22/tcp comment 'SSH'

# 2. Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 3. Allow HTTPS only from your IP for testing
sudo ufw allow from YOUR_IP_ADDRESS to any port 443 proto tcp comment 'HTTPS staging'

# 4. Deny HTTP during staging
sudo ufw deny 80/tcp comment 'HTTP denied during staging'

# 5. Enable UFW (will prompt for confirmation)
sudo ufw enable

# 6. Verify rules
sudo ufw status numbered
```

#### Option B: Production Mode (Public Access)

```bash
# 1. FIRST: Secure SSH access (see above)

# 2. Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 3. Allow HTTPS from anywhere
sudo ufw allow 443/tcp comment 'HTTPS production'

# 4. Allow HTTP from anywhere (for ACME and redirect)
sudo ufw allow 80/tcp comment 'HTTP for ACME and redirect'

# 5. Enable UFW
sudo ufw enable

# 6. Verify rules
sudo ufw status verbose
```

### 3.5 Setup Automated Backups

```bash
# Make backup script executable
chmod +x /srv/team-evaluatie-app/ops/host-configs/backup-postgres.sh

# Test backup manually
/srv/team-evaluatie-app/ops/host-configs/backup-postgres.sh

# Verify backup was created
ls -lah /srv/team-evaluatie-app/backups/postgres/

# Add to crontab for daily backups at 2 AM
sudo crontab -e

# Add this line:
0 2 * * * /srv/team-evaluatie-app/ops/host-configs/backup-postgres.sh >> /var/log/tea-backup.log 2>&1

# For offsite backups (optional), configure OneDrive/S3 mount first
# Then set environment variables in the script or .env
```

### 3.6 Setup Health Monitoring

```bash
# Make health check script executable
chmod +x /srv/team-evaluatie-app/ops/host-configs/health-check.sh

# Test health check manually
/srv/team-evaluatie-app/ops/host-configs/health-check.sh

# Add to crontab for continuous monitoring (every 5 minutes)
sudo crontab -e

# Add this line:
*/5 * * * * /srv/team-evaluatie-app/ops/host-configs/health-check.sh >> /var/log/tea-health.log 2>&1

# To receive email alerts, configure mail on the system:
sudo apt-get install -y mailutils
```

## Phase 4: Verification

### 4.1 Verify Container Security

```bash
# Check that only nginx ports are published
docker ps --format "table {{.Names}}\t{{.Ports}}"

# Expected: Only tea_nginx should show 0.0.0.0:80->80 and 0.0.0.0:443->443
```

### 4.2 Verify Network Isolation

```bash
# Inspect network configuration
docker network inspect ops_public
docker network inspect ops_private

# Verify:
# - ops_public: only nginx and frontend
# - ops_private: db, redis, backend, worker
```

### 4.3 Verify Security Headers

```bash
# Test that security headers appear exactly once
curl -I https://app.technasiummbh.nl/api/v1/health

# Check for headers (each should appear only once):
# - Strict-Transport-Security
# - X-Frame-Options
# - X-Content-Type-Options
# - X-XSS-Protection
# - Referrer-Policy
# - Permissions-Policy
# - Content-Security-Policy

# Count header occurrences
curl -I https://app.technasiummbh.nl/api/v1/health 2>&1 | grep -i "x-frame-options" | wc -l
# Expected output: 1
```

### 4.4 Verify Rate Limiting

```bash
# Test general rate limiting (should allow 10 req/s)
for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" https://app.technasiummbh.nl/; done

# Expected: First 10 succeed (200), then some 429 (Too Many Requests)

# Test auth rate limiting (stricter - should allow 3 req/s)
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" https://app.technasiummbh.nl/api/v1/auth/me; done

# Expected: First 3-5 succeed, then 429
```

### 4.5 Verify Header Stripping

```bash
# Attempt to inject X-User-Email header (should be stripped)
curl -H "X-User-Email: attacker@evil.com" \
     -H "X-User-Id: 999" \
     https://app.technasiummbh.nl/api/v1/auth/me

# Check backend logs - should NOT see the injected headers
docker logs tea_backend --tail 20 | grep -i "x-user-email"
```

### 4.6 Verify Docs Access Control

```bash
# Try to access docs from unauthorized IP
curl -I https://app.technasiummbh.nl/docs

# Expected: 403 Forbidden (if IP restrictions are active)

# To allow access from your IP, edit ops/nginx/site.conf:
# Uncomment the "allow YOUR_IP;" line and add your IP
# Then reload nginx: docker exec tea_nginx nginx -s reload
```

### 4.7 Verify Resource Limits

```bash
# Check container resource usage
docker stats --no-stream

# Verify limits are being enforced:
# - db: max 2GB RAM
# - redis: max 768MB RAM
# - backend: max 1GB RAM
# - worker: max 512MB RAM
# - frontend: max 1.5GB RAM
# - nginx: max 512MB RAM
```

### 4.8 Verify Fail2ban

```bash
# Check fail2ban status
sudo fail2ban-client status

# Check specific jails
sudo fail2ban-client status nginx-tea-auth
sudo fail2ban-client status nginx-tea-404
sudo fail2ban-client status nginx-tea-exploits

# Generate a test ban (optional - be careful!)
# Try failed auth 6 times:
for i in {1..6}; do curl https://app.technasiummbh.nl/api/v1/auth/login -d '{}' -H 'Content-Type: application/json'; sleep 1; done

# Check if your IP was banned (from another machine)
sudo fail2ban-client status nginx-tea-auth

# Unban yourself if needed
sudo fail2ban-client set nginx-tea-auth unbanip YOUR_IP
```

### 4.9 Verify UFW Firewall

```bash
# Check UFW status
sudo ufw status verbose

# Verify rules are active:
# - SSH allowed (port 22)
# - HTTPS allowed (port 443)
# - HTTP allowed (port 80) - if in production mode

# Test from external machine
curl -I https://app.technasiummbh.nl
curl -I http://app.technasiummbh.nl  # Should redirect to HTTPS
```

## Phase 5: Monitoring & Maintenance

### 5.1 Daily Tasks

```bash
# Check application health
docker compose -f /srv/team-evaluatie-app/ops/docker/compose.prod.yml ps

# Check disk usage
df -h

# Check recent logs
docker logs tea_nginx --tail 50
docker logs tea_backend --tail 50
```

### 5.2 Weekly Tasks

```bash
# Review fail2ban bans
sudo fail2ban-client status nginx-tea-auth

# Review backup status
ls -lah /srv/team-evaluatie-app/backups/postgres/ | tail -20

# Check health log for patterns
tail -100 /var/log/tea-health.log
```

### 5.3 Monthly Tasks

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker images
cd /srv/team-evaluatie-app
docker compose -f ops/docker/compose.prod.yml pull
docker compose -f ops/docker/compose.prod.yml up -d

# Test backup restore (on staging)
# See backup-postgres.sh RECOVERY_INSTRUCTIONS.txt
```

## Phase 6: Rollback Procedures

### 6.1 Rollback Docker Compose Changes

```bash
# Stop current deployment
docker compose -f ops/docker/compose.prod.yml down

# Restore old configuration
sudo cp -r ops/docker.backup.YYYYMMDD/* ops/docker/

# Start with old configuration
docker compose -f ops/docker/compose.prod.yml up -d
```

### 6.2 Rollback Nginx Configuration

```bash
# Restore old nginx config
sudo cp -r ops/nginx.backup.YYYYMMDD/* ops/nginx/

# Reload nginx
docker exec tea_nginx nginx -t
docker exec tea_nginx nginx -s reload
```

### 6.3 Disable Fail2ban (if causing issues)

```bash
# Stop fail2ban
sudo systemctl stop fail2ban

# Disable fail2ban
sudo systemctl disable fail2ban

# Remove fail2ban rules from iptables
sudo fail2ban-client stop
```

### 6.4 Emergency UFW Disable

```bash
# If you're locked out or need immediate access:
# From console/VPS panel (not SSH):
sudo ufw disable

# Or reset all rules:
sudo ufw reset
```

## Support & Troubleshooting

### Common Issues

1. **Containers unhealthy after update**
   - Check logs: `docker logs <container_name>`
   - Verify env variables: `docker exec <container> env`
   - Check network connectivity: `docker exec backend ping db`

2. **Nginx fails to start**
   - Validate config: `docker exec tea_nginx nginx -t`
   - Check for syntax errors in site.conf
   - Review nginx error log: `docker logs tea_nginx`

3. **Can't access application**
   - Check UFW rules: `sudo ufw status`
   - Verify containers running: `docker ps`
   - Test locally: `curl http://localhost`

4. **Rate limiting too strict**
   - Edit ops/nginx/nginx.conf rate limit zones
   - Adjust burst values in ops/nginx/site.conf
   - Reload nginx: `docker exec tea_nginx nginx -s reload`

5. **Fail2ban banning legitimate users**
   - Unban IP: `sudo fail2ban-client set nginx-tea-auth unbanip IP`
   - Adjust thresholds in /etc/fail2ban/jail.d/nginx-tea.conf
   - Restart fail2ban: `sudo systemctl restart fail2ban`

### Contact

For additional support:
- GitHub Issues: https://github.com/nveerman1/team-evaluatie-app/issues
- Documentation: /srv/team-evaluatie-app/docs/

## Completion Checklist

- [ ] Pre-deployment backup completed
- [ ] Repository changes pulled and reviewed
- [ ] Nginx configuration updated and validated
- [ ] Docker Compose updated with new configuration
- [ ] All containers healthy after restart
- [ ] Network isolation verified (public/private)
- [ ] Security headers verified (no duplicates)
- [ ] Rate limiting tested and working
- [ ] Header stripping verified
- [ ] Docs access control configured
- [ ] Nginx logs mounted and accessible
- [ ] Fail2ban installed and configured
- [ ] Logrotate configured for nginx logs
- [ ] UFW firewall configured (staging or production)
- [ ] Automated backups configured
- [ ] Health monitoring configured
- [ ] All verification tests passed
- [ ] Rollback procedure documented and understood

=============================================================================
End of Deployment Guide
=============================================================================

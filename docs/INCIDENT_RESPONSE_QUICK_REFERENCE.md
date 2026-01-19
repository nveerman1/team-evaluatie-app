# INCIDENT RESPONSE QUICK REFERENCE GUIDE

## 🚨 IMMEDIATE ACTIONS (First 30 Minutes)

### 1. Contain the Incident

**If Active Attack Detected:**
```bash
# Stop public traffic at VPS provider level (if not already done)
# OR block at firewall
iptables -A INPUT -p tcp --dport 80 -j DROP
iptables -A INPUT -p tcp --dport 443 -j DROP

# OR stop nginx (preserves containers)
docker exec tea_nginx nginx -s stop
```

**If RCE Suspected in Frontend Container:**
```bash
# Isolate frontend container from network
docker network disconnect app-network tea_frontend

# Check for active malicious processes
docker exec tea_frontend ps aux

# Kill suspicious processes (replace PID)
docker exec tea_frontend kill <PID>
```

### 2. Collect Evidence (DO THIS BEFORE ANY CHANGES)

```bash
# Create forensics directory
mkdir -p /tmp/incident-forensics-$(date +%Y%m%d-%H%M)
cd /tmp/incident-forensics-$(date +%Y%m%d-%H%M)

# Collect all container logs
docker logs tea_nginx > nginx.log 2>&1
docker logs tea_backend > backend.log 2>&1
docker logs tea_frontend > frontend.log 2>&1
docker logs tea_worker > worker.log 2>&1
docker logs tea_db > db.log 2>&1

# Copy nginx logs
docker cp tea_nginx:/var/log/nginx/access.log ./nginx_access.log
docker cp tea_nginx:/var/log/nginx/error.log ./nginx_error.log

# Snapshot container filesystems
docker export tea_frontend > frontend_fs.tar
docker export tea_backend > backend_fs.tar

# Current environment
docker inspect tea_frontend > frontend_inspect.json
docker inspect tea_backend > backend_inspect.json

# Database snapshot
docker exec tea_db pg_dump -U tea tea_production > db_dump.sql

# System state
docker ps -a > docker_ps.txt
docker network ls > docker_networks.txt
netstat -tulpn > netstat.txt
iptables -L -n -v > iptables.txt

# Archive everything
cd /tmp
tar -czf incident-forensics-$(date +%Y%m%d-%H%M).tar.gz incident-forensics-$(date +%Y%m%d-%H%M)/

echo "Evidence collected in: /tmp/incident-forensics-$(date +%Y%m%d-%H%M).tar.gz"
```

### 3. Verify Security Fixes Are Applied

**Check Nginx Configuration:**
```bash
# Verify X-User-Email header is being stripped
docker exec tea_nginx grep -A5 "CRITICAL SECURITY FIX" /etc/nginx/conf.d/default.conf

# Expected output should show:
# proxy_set_header X-User-Email "";

# Test the fix
curl -H "X-User-Email: attacker@evil.com" https://app.technasiummbh.nl/api/v1/auth/me
# Expected: HTTP 401 Unauthorized (NOT authenticated)
```

**Check NODE_ENV:**
```bash
# Verify backend is running in production mode
docker exec tea_backend env | grep NODE_ENV
# Expected: NODE_ENV=production

# Check backend logs for confirmation
docker logs tea_backend 2>&1 | grep -i "node_env"
```

---

## 🔍 FORENSIC ANALYSIS

### Find Evidence of X-User-Email Attack

```bash
# Check nginx access logs for X-User-Email header
docker exec tea_nginx grep -i "x-user-email" /var/log/nginx/access.log

# Check backend logs for dev-login warnings
docker logs tea_backend 2>&1 | grep -i "dev-login"

# Check for SECURITY ALERT messages (if fix was partially applied)
docker logs tea_backend 2>&1 | grep "SECURITY ALERT"
```

### Timeline Reconstruction

```bash
# Find first suspicious request
docker exec tea_nginx awk '/Jan\/10\/2026/ && /401|403/ {print}' /var/log/nginx/access.log | head -20

# Find authentication successes around same time
docker logs tea_backend 2>&1 | grep -E "2026-01-10" | grep -i "auth"

# Find RCE evidence in frontend
docker logs tea_frontend 2>&1 | grep -E "(wget|curl|sh|bash|nc|netcat)"
```

### Identify Attacker IP Addresses

```bash
# Get all IPs from access log
docker exec tea_nginx awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -20

# Get IPs with auth failures
docker exec tea_nginx awk '/401|403/ {print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn

# Check for non-Dutch IPs (application is NL-based)
# Use online GeoIP lookup or:
for ip in $(docker exec tea_nginx awk '{print $1}' /var/log/nginx/access.log | sort -u | head -10); do
    echo "$ip: $(curl -s "http://ip-api.com/json/$ip" | jq -r '.country')"
done
```

---

## 🔒 SECURITY REMEDIATION

### Apply Critical Fixes (If Not Already Done)

```bash
# 1. Update Nginx configuration to strip X-User-Email
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
git pull origin main  # Get security fixes

# 2. Restart nginx to apply config
docker compose -f ops/docker/compose.prod.yml restart nginx

# 3. Verify the fix
docker exec tea_nginx nginx -t
curl -v -H "X-User-Email: test@test.com" https://localhost/api/v1/auth/me 2>&1 | grep -i "x-user-email"
# Should NOT see X-User-Email in backend logs
```

### Rotate All Secrets

```bash
# Generate new SECRET_KEY
python3 -c 'import secrets; print("SECRET_KEY=" + secrets.token_urlsafe(32))' >> .env.prod.new

# Generate new Redis password
python3 -c 'import secrets; print("REDIS_PASSWORD=" + secrets.token_urlsafe(24))' >> .env.prod.new

# Backup old env
cp .env.prod .env.prod.backup.$(date +%Y%m%d)

# Apply new secrets (EDIT .env.prod.new first!)
# mv .env.prod.new .env.prod

# Restart all services (invalidates all JWT tokens)
docker compose -f ops/docker/compose.prod.yml down
docker compose -f ops/docker/compose.prod.yml up -d

# Users will need to re-authenticate
```

### Check for Backdoors and Persistence

```bash
# Check frontend container for malicious files
docker exec tea_frontend find /app -type f -name "*.sh" -o -name "*.php" -o -name "*.py"
docker exec tea_frontend find /tmp -type f

# Check for suspicious cron jobs
docker exec tea_frontend cat /etc/crontab 2>/dev/null || echo "No crontab"

# Check for modified system files
docker exec tea_frontend find /app -type f -mtime -7 -ls

# Check running processes
docker exec tea_frontend ps aux | grep -vE "(node|npm)"

# Check network connections
docker exec tea_frontend netstat -tulpn | grep -v "0.0.0.0:3000"

# If backdoors found, redeploy from clean image
docker compose -f ops/docker/compose.prod.yml up -d --force-recreate --no-deps frontend
```

### Audit User Accounts

```bash
# Connect to database
docker exec -it tea_db psql -U tea -d tea_production

# Find recently created/modified users
SELECT id, email, role, created_at, updated_at, archived 
FROM users 
WHERE created_at > '2026-01-10 00:00:00' 
   OR updated_at > '2026-01-10 00:00:00'
ORDER BY updated_at DESC;

# Disable suspicious accounts
UPDATE users SET archived = true WHERE email = 'suspicious@email.com';

# Exit database
\q
```

---

## 📊 MONITORING SETUP

### Enable Security Monitoring

```bash
# Copy monitoring script to system cron
sudo cp scripts/security-monitor.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/security-monitor.sh

# Set alert email
echo "SECURITY_ALERT_EMAIL=security@technasiummbh.nl" >> /etc/environment

# Add to crontab (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/security-monitor.sh >> /var/log/security-monitor.log 2>&1") | crontab -

# Test the script
/usr/local/bin/security-monitor.sh
```

### Setup Log Aggregation

```bash
# Install and configure log shipping (e.g., to Elastic, Splunk, or Syslog)
# Example: Ship to remote syslog
docker logs -f tea_backend | logger -t tea_backend -n syslog.example.com &
docker logs -f tea_frontend | logger -t tea_frontend -n syslog.example.com &
docker logs -f tea_nginx | logger -t tea_nginx -n syslog.example.com &
```

---

## 📝 POST-INCIDENT ACTIONS

### 1. Notification (GDPR Compliance)

**If personal data accessed:**
```
Within 72 hours, notify:
- Dutch Data Protection Authority (Autoriteit Persoonsgegevens)
  https://www.autoriteitpersoonsgegevens.nl/
  
- Affected individuals (students, teachers) if high risk
  Email template: See GDPR_BREACH_NOTIFICATION.md
```

### 2. Root Cause Analysis

```bash
# Answer these questions:
# 1. Was NODE_ENV=development in production? 
docker logs tea_backend 2>&1 | grep "NODE_ENV" | head -1

# 2. When was nginx last reloaded with config?
docker logs tea_nginx 2>&1 | grep "reload"

# 3. Were there any deployment changes before incident?
git log --oneline --since="2026-01-09"

# 4. How did attacker discover X-User-Email header?
# Check access logs for /api/v1/auth/me requests before attack

# 5. What was the secondary exploit after auth bypass?
# Analyze frontend logs for command execution
docker logs tea_frontend 2>&1 | grep -E "(exec|spawn|eval)"
```

### 3. Security Improvements

```bash
# 1. Remove dev-login feature entirely (optional, more secure)
# Edit backend/app/api/v1/deps.py and remove lines 49-61

# 2. Implement WAF rules (Cloudflare or ModSecurity)
# See INCIDENT_INVESTIGATION_REPORT.md section on WAF

# 3. Setup SIEM alerting
# Configure Sentry, Datadog, or similar

# 4. Schedule penetration testing
# Contact security firm for external audit
```

---

## 📞 CONTACTS

**Emergency Contacts:**
- Security Team: security@technasiummbh.nl
- DevOps Team: devops@technasiummbh.nl
- Management: management@technasiummbh.nl

**External:**
- VPS Provider Support: [Your VPS provider]
- Incident Response Firm: [Optional - external IR firm]
- Legal Counsel: [School legal team]
- Dutch Data Protection Authority: https://www.autoriteitpersoonsgegevens.nl/

---

## ✅ RECOVERY CHECKLIST

Before restoring normal operations:

- [ ] Evidence collected and preserved
- [ ] Nginx header stripping verified (X-User-Email blocked)
- [ ] NODE_ENV verified as production
- [ ] All secrets rotated (SECRET_KEY, REDIS_PASSWORD, etc.)
- [ ] User accounts audited for unauthorized changes
- [ ] Backdoors searched and removed
- [ ] Containers redeployed from clean images
- [ ] Security monitoring enabled
- [ ] Log aggregation configured
- [ ] Incident documented in security log
- [ ] Root cause identified
- [ ] GDPR notification submitted (if required)
- [ ] Post-incident review scheduled
- [ ] Security improvements planned

---

## 🔗 RELATED DOCUMENTS

- **INCIDENT_INVESTIGATION_REPORT.md** - Full investigation findings
- **SECURITY_FINDINGS.md** - Previous security audit
- **SECURITY.md** - Security best practices
- **ops/nginx/site.conf** - Nginx configuration (with fixes)
- **backend/app/api/v1/deps.py** - Authentication code (with fixes)

---

**Last Updated:** January 10, 2026  
**Version:** 1.0  
**Owner:** Security Team

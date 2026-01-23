# Incident Response Runbook - RCE Mitigation

**Date Created**: January 10, 2026  
**Last Updated**: January 10, 2026  
**Incident Type**: Remote Command Execution (RCE) via React Server Components  

---

## 🚨 IMMEDIATE ACTIONS (First 30 Minutes)

### 1. Isolate Affected Systems

```bash
# Stop the compromised container (if still running)
docker stop tea_frontend

# Or stop all services
cd ops/docker
docker compose -f compose.prod.yml down
```

### 2. Preserve Evidence

```bash
# Create forensics directory
mkdir -p /tmp/incident-$(date +%Y%m%d-%H%M%S)
cd /tmp/incident-$(date +%Y%m%d-%H%M%S)

# Capture container logs
docker logs tea_frontend > frontend-logs.txt 2>&1
docker logs tea_backend > backend-logs.txt 2>&1
docker logs tea_nginx > nginx-logs.txt 2>&1

# Capture container state (if running)
docker inspect tea_frontend > frontend-inspect.json
docker ps -a > docker-ps-all.txt

# Capture network connections
docker exec tea_frontend netstat -antp > frontend-netstat.txt 2>&1 || echo "netstat failed"

# Copy nginx logs
cp /var/log/nginx/access.log nginx-access-$(date +%Y%m%d).log
cp /var/log/nginx/error.log nginx-error-$(date +%Y%m%d).log

# Capture process list
docker exec tea_frontend ps aux > frontend-processes.txt 2>&1 || echo "ps failed"

# Create tarball
cd ..
tar -czf incident-evidence-$(date +%Y%m%d-%H%M%S).tar.gz incident-$(date +%Y%m%d-%H%M%S)/
```

### 3. Notify Stakeholders

- [ ] Notify security team
- [ ] Notify DevOps team
- [ ] Notify management
- [ ] Document incident start time
- [ ] Create incident tracking ticket

---

## 🔍 INVESTIGATION (First 2 Hours)

### Check for Persistence Mechanisms

```bash
# Check for malicious cron jobs
docker exec tea_frontend crontab -l
docker exec tea_frontend cat /etc/crontab

# Check for suspicious files in /tmp
docker exec tea_frontend ls -la /tmp/
docker exec tea_frontend find /tmp -type f -ls

# Check for modified system files
docker exec tea_frontend find /usr/bin /usr/sbin -mtime -7 2>/dev/null

# Check for backdoor scripts
docker exec tea_frontend find / -name "*.sh" -mtime -7 2>/dev/null

# Check systemd services (if applicable)
docker exec tea_frontend ls -la /etc/systemd/system/ 2>/dev/null

# Check for listening ports
docker exec tea_frontend netstat -tulpn 2>/dev/null
```

### Analyze Attack Vector

```bash
# Search logs for suspicious patterns
grep -E "wget|curl|nc|mkfifo|bash -i|/bin/sh|/bin/bash" /tmp/incident-*/frontend-logs.txt

# Check for connections to known malicious IP
grep "91.92.241.10" /tmp/incident-*/frontend-logs.txt
grep "91.92.241.10" /tmp/incident-*/nginx-access-*.log

# Search for RSC exploit patterns
grep "_next/data" /tmp/incident-*/nginx-access-*.log | grep -v "200\|304"

# Check for authentication bypass attempts
grep "X-User-Email" /tmp/incident-*/nginx-access-*.log
```

### Verify Current Versions

```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/frontend

# Check package.json versions
cat package.json | grep -E "next|react"

# Expected vulnerable versions:
# "next": "15.5.9"
# "react": "19.1.0"
# "react-dom": "19.1.0"

# Expected SAFE versions after mitigation:
# "next": "15.0.3"
# "react": "^18.3.1" (React 18 LTS - not affected by React 19 RSC vuln)
# "react-dom": "^18.3.1"
```

### Check for Data Breach

```bash
# Check if attacker accessed environment variables (secrets)
docker logs tea_frontend | grep -i "env\|secret\|password\|token"

# Check database logs for unusual queries
docker exec tea_db psql -U tea -d tea_production -c "SELECT * FROM pg_stat_activity;"

# Check Redis for suspicious activity
docker exec tea_redis redis-cli -a "$REDIS_PASSWORD" INFO

# Review application logs for unauthorized access
docker logs tea_backend | grep -E "401|403|Unauthorized|Forbidden"
```

---

## 🛠️ REMEDIATION (Hours 2-6)

### 1. Deploy Patched Versions

```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/frontend

# Backup current package.json
cp package.json package.json.backup

# Update to patched versions (ALREADY DONE in this PR)
# package.json should show:
# "next": "15.1.4"
# "react": "19.0.0"
# "react-dom": "19.0.0"

# Install dependencies
npm install

# Audit dependencies
npm audit
npm audit fix

# Build new image
cd ../
docker compose -f ops/docker/compose.prod.yml build frontend

# Tag as incident-response
docker tag tea-frontend:latest tea-frontend:incident-response-$(date +%Y%m%d)
```

### 2. Deploy Security Hardening

The following changes have been applied in this PR:

**Docker Compose Security (`ops/docker/compose.prod.yml`)**:
- ✅ `security_opt: no-new-privileges:true`
- ✅ `cap_drop: ALL`
- ✅ `cap_add: NET_BIND_SERVICE` (minimal)
- ✅ `tmpfs: /tmp` with noexec, nosuid
- ✅ Reduced resource limits (memory, CPU, PIDs)

**Nginx RSC Protection (`ops/nginx/site.conf`)**:
- ✅ Dedicated rate limiting zone for RSC endpoints
- ✅ `/_next/data/` endpoint protection
- ✅ Request body size limits (512KB)
- ✅ Enhanced logging for RSC requests

**Nginx Rate Limiting (`ops/nginx/nginx.conf`)**:
- ✅ Added `zone=rsc:10m rate=5r/s`

### 3. Rotate All Secrets

```bash
# Generate new secrets
python -c 'import secrets; print(secrets.token_urlsafe(32))'

# Update .env.prod file
# - SECRET_KEY (JWT signing)
# - POSTGRES_PASSWORD
# - REDIS_PASSWORD
# - Any API keys

# DO NOT commit .env.prod to git!

# Apply new environment variables
docker compose -f ops/docker/compose.prod.yml down
docker compose -f ops/docker/compose.prod.yml up -d
```

### 4. Redeploy Application

```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/ops/docker

# Pull latest changes (this PR)
git pull origin <branch-name>

# Rebuild images with security patches
docker compose -f compose.prod.yml build --no-cache

# Start services
docker compose -f compose.prod.yml up -d

# Verify services are healthy
docker compose -f compose.prod.yml ps
docker compose -f compose.prod.yml logs -f
```

### 5. Verify Mitigation

```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app

# Run verification script
./scripts/verify-rce-mitigation.sh

# Expected output:
# ✓ Package versions: SAFE
# ✓ no-new-privileges enabled
# ✓ Capabilities dropped
# ✓ tmpfs configured
# ✓ Resource limits configured
# ✓ RSC rate limiting zone configured
# ✓ RSC endpoint protection configured

# Test rate limiting manually
for i in {1..20}; do
  curl -s -w "%{http_code}\n" https://your-domain.com/_next/data/test -o /dev/null
done

# Expected: First ~5-10 requests succeed, then 429 Too Many Requests
```

---

## 📊 MONITORING (Ongoing)

### Set Up Alerts

Configure monitoring for:

1. **High CPU usage in frontend container** (>80% for >5 min)
2. **Unusual outbound network traffic** (>10MB/min)
3. **Process spawning** (more than 50 processes)
4. **Rate limit violations** (>100 429 errors/min)
5. **Connections to suspicious IPs** (91.92.241.10, etc.)
6. **Failed authentication attempts** (>10/min)

### Log Monitoring Queries

```bash
# Monitor RSC endpoint traffic
tail -f /var/log/nginx/rsc_access.log

# Monitor for wget/curl/nc in logs
docker logs tea_frontend -f | grep -E "wget|curl|nc|mkfifo|bash -i"

# Monitor rate limiting
docker logs tea_nginx -f | grep "429"

# Monitor authentication
docker logs tea_backend -f | grep "Unauthorized"
```

### Health Checks

```bash
# Check all containers are healthy
docker ps | grep healthy

# Check application endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/v1/health

# Check resource usage
docker stats --no-stream
```

---

## 🔒 POST-INCIDENT ACTIONS (Week 1)

### Day 1-2: Immediate Hardening

- [x] Deploy patched React/Next.js versions
- [x] Implement Docker security hardening
- [x] Add RSC endpoint protection
- [ ] Rotate all secrets and credentials
- [ ] Update firewall rules
- [ ] Review and update access controls

### Day 3-5: Investigation & Documentation

- [ ] Complete forensic analysis
- [ ] Determine full scope of compromise
- [ ] Document attack timeline
- [ ] Identify any data accessed/exfiltrated
- [ ] Update incident response procedures
- [ ] Share lessons learned with team

### Day 6-7: Long-term Improvements

- [ ] Implement WAF (Web Application Firewall)
- [ ] Set up SIEM (Security Information Event Management)
- [ ] Configure IDS/IPS (Intrusion Detection/Prevention)
- [ ] Implement network segmentation
- [ ] Set up secrets management (Vault, AWS Secrets Manager)
- [ ] Schedule security audit/penetration testing

---

## 📋 VERIFICATION CHECKLIST

Before marking incident as resolved:

### Technical Verification

- [ ] All patched versions deployed and verified
- [ ] No malicious processes running
- [ ] No suspicious files in /tmp or elsewhere
- [ ] No malicious cron jobs or systemd services
- [ ] No backdoor network listeners
- [ ] All secrets rotated
- [ ] Security hardening applied and verified
- [ ] Rate limiting tested and working
- [ ] Monitoring and alerting configured

### Administrative Verification

- [ ] Incident timeline documented
- [ ] Forensic evidence preserved
- [ ] Stakeholders notified
- [ ] Post-incident report written
- [ ] Lessons learned documented
- [ ] Incident response procedures updated
- [ ] Team debriefing conducted

---

## 🆘 ESCALATION CONTACTS

**Severity Level**: CRITICAL

**Primary Contacts**:
- Security Team: security@your-org.com
- DevOps Team: devops@your-org.com
- Management: management@your-org.com

**External Resources**:
- Cybersecurity Firm: [Contact Info]
- Legal Counsel: [Contact Info]
- Law Enforcement (if needed): [Contact Info]

---

## 📚 REFERENCE MATERIALS

### CVE Information

- **CVE-2025-55182**: React Server Components unauthenticated RCE
- **Affected Versions**: React 19.0.0-19.1.0, Next.js 15.0.0-15.5.9
- **Patched Versions**: React 19.0.1+/19.1.1+, Next.js 15.0.1+/15.1.4+/15.5.10+

### Attack Indicators

**Known Malicious IPs**:
- 91.92.241.10

**Attack Patterns**:
- Exploitation of `/_next/data/` endpoints
- Commands: `rm /tmp/*`, `wget`, `chmod +x`, `mkfifo`, `nc` (netcat)
- Reverse shell establishment
- Persistence attempts (cron, systemd, backdoors)

### Documentation

- Root Cause Analysis: `RCE_ROOT_CAUSE_ANALYSIS.md`
- Verification Script: `scripts/verify-rce-mitigation.sh`
- Security Findings: `SECURITY_FINDINGS.md`
- Previous Incident Reports: `INCIDENT_INVESTIGATION_REPORT.md`

---

## 🔄 RECOVERY TIME OBJECTIVES

- **Detection to Isolation**: < 30 minutes
- **Isolation to Patching**: < 2 hours
- **Patching to Redeployment**: < 4 hours
- **Total Recovery Time**: < 6 hours
- **Full Investigation**: < 48 hours

---

**Document Version**: 1.0  
**Last Reviewed**: January 10, 2026  
**Next Review**: After incident closure

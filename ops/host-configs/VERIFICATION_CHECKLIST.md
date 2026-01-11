# Production Hardening v2 - Verification Checklist

## Overview
This document provides exact commands and expected outputs for verifying that all Production Hardening v2 changes have been successfully applied.

---

## 1. Container Configuration Verification

### 1.1 Verify Only Nginx Ports are Published
```bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Expected Output:**
```
NAMES               PORTS
tea_nginx           0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
tea_frontend        (empty)
tea_backend         (empty)
tea_worker          (empty)
tea_db              (empty)
tea_redis           (empty)
```

**Status:** ❌ FAIL if any service other than nginx shows published ports

### 1.2 Verify All Containers Are Healthy
```bash
docker compose -f /srv/team-evaluatie-app/ops/docker/compose.prod.yml ps
```

**Expected Output:**
All containers should show `Up` status and `healthy` in the State column.

```bash
docker inspect tea_backend --format='{{.State.Health.Status}}'
docker inspect tea_frontend --format='{{.State.Health.Status}}'
docker inspect tea_nginx --format='{{.State.Health.Status}}'
docker inspect tea_db --format='{{.State.Health.Status}}'
docker inspect tea_redis --format='{{.State.Health.Status}}'
```

**Expected Output:** Each should return `healthy`

### 1.3 Verify Network Isolation
```bash
# Check public network
docker network inspect ops_public --format='{{range .Containers}}{{.Name}} {{end}}'
```
**Expected Output:** `tea_nginx tea_frontend tea_certbot`

```bash
# Check private network
docker network inspect ops_private --format='{{range .Containers}}{{.Name}} {{end}}'
```
**Expected Output:** `tea_backend tea_worker tea_db tea_redis`

### 1.4 Verify Container Security Options
```bash
# Check backend security options
docker inspect tea_backend --format='{{.HostConfig.SecurityOpt}}'
```
**Expected Output:** `[no-new-privileges:true]`

```bash
# Check backend capabilities
docker inspect tea_backend --format='{{.HostConfig.CapDrop}}'
```
**Expected Output:** `[ALL]`

```bash
# Check frontend read-only filesystem
docker inspect tea_frontend --format='{{.HostConfig.ReadonlyRootfs}}'
```
**Expected Output:** `true`

### 1.5 Verify Resource Limits
```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

**Expected Limits (check with docker inspect):**
```bash
docker inspect tea_backend --format='Memory: {{.HostConfig.Memory}} CPUs: {{.HostConfig.NanoCpus}}'
docker inspect tea_db --format='Memory: {{.HostConfig.Memory}} CPUs: {{.HostConfig.NanoCpus}}'
docker inspect tea_redis --format='Memory: {{.HostConfig.Memory}} CPUs: {{.HostConfig.NanoCpus}}'
```

**Expected:**
- backend: Memory: 1073741824 (1GB) CPUs: 1000000000 (1.0)
- db: Memory: 2147483648 (2GB) CPUs: 1500000000 (1.5)
- redis: Memory: 805306368 (768MB) CPUs: 500000000 (0.5)

---

## 2. Nginx Configuration Verification

### 2.1 Verify Nginx Configuration Syntax
```bash
docker exec tea_nginx nginx -t
```

**Expected Output:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 2.2 Verify Rate Limiting Zones
```bash
docker exec tea_nginx cat /etc/nginx/nginx.conf | grep -A1 "limit_req_zone"
```

**Expected Output:**
```
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=20r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=3r/s;
limit_req_zone $binary_remote_addr zone=rsc:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=health:10m rate=30r/s;
```

### 2.3 Verify Connection Limiting
```bash
docker exec tea_nginx cat /etc/nginx/nginx.conf | grep "limit_conn"
```

**Expected Output:**
```
limit_conn_zone $binary_remote_addr zone=addr:10m;
limit_conn addr 15;
```

### 2.4 Verify Timeouts
```bash
docker exec tea_nginx cat /etc/nginx/nginx.conf | grep -E "(client_body_timeout|client_header_timeout|send_timeout)"
```

**Expected Output:**
```
client_body_timeout 30s;
client_header_timeout 30s;
send_timeout 60s;
```

### 2.5 Verify Logs Are Mounted
```bash
docker volume inspect ops_nginx-logs
ls -lah /var/lib/docker/volumes/ops_nginx-logs/_data/
```

**Expected:** Directory exists and contains access.log, error.log files

---

## 3. Security Headers Verification

### 3.1 Test Security Headers on HTTPS
```bash
curl -I https://app.technasiummbh.nl/api/v1/health
```

**Expected Headers (each should appear EXACTLY ONCE):**
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=()...`
- `Content-Security-Policy: ...`

### 3.2 Count Security Header Occurrences
```bash
# Each command should return "1"
curl -I https://app.technasiummbh.nl/api/v1/health 2>&1 | grep -i "^strict-transport-security:" | wc -l
curl -I https://app.technasiummbh.nl/api/v1/health 2>&1 | grep -i "^x-frame-options:" | wc -l
curl -I https://app.technasiummbh.nl/api/v1/health 2>&1 | grep -i "^x-content-type-options:" | wc -l
curl -I https://app.technasiummbh.nl/api/v1/health 2>&1 | grep -i "^content-security-policy:" | wc -l
```

**Expected Output for each:** `1`

**Status:** ❌ FAIL if any header appears 0 times or more than 1 time

### 3.3 Verify Backend Security Headers Are Disabled
```bash
docker exec tea_backend env | grep ENABLE_BACKEND_SECURITY_HEADERS
```

**Expected Output:** `ENABLE_BACKEND_SECURITY_HEADERS=false` or not set (defaults to false in production)

---

## 4. Rate Limiting Verification

### 4.1 Test General Rate Limiting (10 req/s)
```bash
# Send 15 requests rapidly
for i in {1..15}; do curl -s -o /dev/null -w "%{http_code}\n" https://app.technasiummbh.nl/ & done; wait
```

**Expected:** Mix of `200` (success) and `429` (rate limited)

### 4.2 Test Auth Rate Limiting (3 req/s - strictest)
```bash
# Send 10 requests rapidly to auth endpoint
for i in {1..10}; do curl -s -o /dev/null -w "%{http_code}\n" https://app.technasiummbh.nl/api/v1/auth/me & done; wait
```

**Expected:** First few return `200` or `401`, later ones return `429`

### 4.3 Test API Rate Limiting (20 req/s)
```bash
# Send 30 requests rapidly
for i in {1..30}; do curl -s -o /dev/null -w "%{http_code}\n" https://app.technasiummbh.nl/api/v1/health & done; wait
```

**Expected:** Mix of `200` and some `429` after ~20 requests

### 4.4 Verify Rate Limit Response
```bash
curl -v https://app.technasiummbh.nl/api/v1/health  # First request
curl -v https://app.technasiummbh.nl/api/v1/health  # Second request (immediately after burst)
```

**Expected on rate limited response:**
- HTTP status: `429 Too Many Requests`
- No custom rate limit headers expected unless configured

---

## 5. Header Stripping Verification

### 5.1 Test X-User-* Header Injection
```bash
curl -H "X-User-Email: attacker@evil.com" \
     -H "X-User-Id: 999" \
     -H "X-User-Role: admin" \
     -H "X-Forwarded-User: attacker" \
     https://app.technasiummbh.nl/api/v1/auth/me -v 2>&1 | grep -i "x-user"
```

**Expected:** No X-User-* headers in the response or forwarded to backend

### 5.2 Check Backend Logs for Header Injection
```bash
# Make request with injected headers
curl -H "X-User-Email: test-injection@evil.com" https://app.technasiummbh.nl/api/v1/health

# Check backend logs - should NOT see the injected header
docker logs tea_backend --tail 50 | grep -i "test-injection@evil.com"
```

**Expected Output:** Empty (no match)

**Status:** ❌ CRITICAL FAIL if injected headers are logged

---

## 6. Access Control Verification

### 6.1 Test Docs Endpoint Access
```bash
curl -I https://app.technasiummbh.nl/docs
```

**Expected Output:** 
- `HTTP/2 403` (Forbidden) - if IP restrictions are active
- OR `HTTP/2 200` - if your IP is allowed

### 6.2 Test Redoc Endpoint Access
```bash
curl -I https://app.technasiummbh.nl/redoc
```

**Expected Output:**
- `HTTP/2 403` (Forbidden) - if IP restrictions are active
- OR `HTTP/2 200` - if your IP is allowed

---

## 7. Host-Level Security Verification

### 7.1 Verify UFW Status
```bash
sudo ufw status verbose
```

**Expected Output (Staging Mode):**
```
Status: active
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       YOUR_IP
443/tcp                    ALLOW       YOUR_IP
80/tcp                     DENY        Anywhere
```

**Expected Output (Production Mode):**
```
Status: active
To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       YOUR_IP (or LIMIT)
443/tcp                    ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
```

### 7.2 Verify Fail2ban Installation
```bash
sudo systemctl status fail2ban
sudo fail2ban-client status
```

**Expected Output:**
```
Status
|- Number of jail:      4
`- Jail list:   nginx-tea-auth, nginx-tea-404, nginx-tea-exploits, nginx-tea-dos
```

### 7.3 Verify Fail2ban Jails
```bash
sudo fail2ban-client status nginx-tea-auth
sudo fail2ban-client status nginx-tea-404
sudo fail2ban-client status nginx-tea-exploits
```

**Expected:** Each jail should be active and monitoring the log file

### 7.4 Verify Logrotate Configuration
```bash
sudo logrotate -d /etc/logrotate.d/nginx-tea
```

**Expected:** No errors, shows rotation schedule and log file paths

### 7.5 Verify Backup Script
```bash
ls -lah /srv/team-evaluatie-app/ops/host-configs/backup-postgres.sh
/srv/team-evaluatie-app/ops/host-configs/backup-postgres.sh
ls -lah /srv/team-evaluatie-app/backups/postgres/
```

**Expected:** 
- Script is executable (has x permission)
- Backup runs successfully
- Backup file is created in backups/postgres/

### 7.6 Verify Cron Jobs
```bash
sudo crontab -l
```

**Expected Output (if configured):**
```
0 2 * * * /srv/team-evaluatie-app/ops/host-configs/backup-postgres.sh >> /var/log/tea-backup.log 2>&1
*/5 * * * * /srv/team-evaluatie-app/ops/host-configs/health-check.sh >> /var/log/tea-health.log 2>&1
```

---

## 8. Application Functionality Verification

### 8.1 Test Health Endpoints
```bash
curl https://app.technasiummbh.nl/health
curl https://app.technasiummbh.nl/api/v1/health
```

**Expected Output:** Both return `200 OK`

### 8.2 Test Frontend Access
```bash
curl -I https://app.technasiummbh.nl/
```

**Expected Output:** `HTTP/2 200 OK`

### 8.3 Test HTTP to HTTPS Redirect
```bash
curl -I http://app.technasiummbh.nl/
```

**Expected Output:** `HTTP/1.1 301 Moved Permanently` with `Location: https://...`

### 8.4 Test API Endpoint
```bash
curl https://app.technasiummbh.nl/api/v1/health
```

**Expected Output:** JSON response with status

### 8.5 Verify Database Connectivity
```bash
docker exec tea_db pg_isready -U tea -d tea_production
```

**Expected Output:** `tea_production:5432 - accepting connections`

### 8.6 Verify Redis Connectivity
```bash
docker exec tea_redis redis-cli -a "${REDIS_PASSWORD}" ping
```

**Expected Output:** `PONG`

---

## 9. Performance Verification

### 9.1 Check Container Resource Usage
```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

**Expected:** All containers within their configured limits

### 9.2 Check Disk Usage
```bash
df -h
```

**Expected:** Root partition and /var/lib/docker have adequate free space (>20%)

### 9.3 Check Log File Sizes
```bash
du -sh /var/lib/docker/volumes/ops_nginx-logs/_data/
docker logs tea_backend 2>&1 | wc -l
```

**Expected:** Log files are reasonable size (not filling disk)

---

## 10. SSL/TLS Verification

### 10.1 Test SSL Certificate
```bash
echo | openssl s_client -servername app.technasiummbh.nl -connect app.technasiummbh.nl:443 2>/dev/null | openssl x509 -noout -dates
```

**Expected Output:** Valid not before/after dates showing certificate is active

### 10.2 Test TLS Version
```bash
echo | openssl s_client -servername app.technasiummbh.nl -connect app.technasiummbh.nl:443 2>/dev/null | grep "Protocol"
```

**Expected Output:** `Protocol  : TLSv1.2` or `TLSv1.3`

### 10.3 Test HSTS Header
```bash
curl -I https://app.technasiummbh.nl/ | grep -i strict-transport-security
```

**Expected Output:** `strict-transport-security: max-age=31536000; includeSubDomains; preload`

---

## Summary Checklist

Use this checklist to track verification progress:

### Container Configuration
- [ ] Only nginx ports published
- [ ] All containers healthy
- [ ] Network isolation (public/private) correct
- [ ] Security options applied (no-new-privileges, cap_drop)
- [ ] Frontend read-only filesystem active
- [ ] Resource limits configured

### Nginx Configuration
- [ ] Configuration syntax valid
- [ ] Rate limiting zones configured
- [ ] Connection limiting configured
- [ ] Timeouts configured
- [ ] Logs mounted to host volume

### Security Headers
- [ ] All required headers present on HTTPS
- [ ] Each header appears exactly once
- [ ] Backend security headers disabled in production

### Rate Limiting
- [ ] General rate limiting works (10 r/s)
- [ ] Auth rate limiting works (3 r/s)
- [ ] API rate limiting works (20 r/s)
- [ ] 429 responses returned when limit exceeded

### Header Stripping
- [ ] X-User-Email stripped
- [ ] X-User-Id stripped
- [ ] X-User-Role stripped
- [ ] X-Forwarded-User stripped

### Access Control
- [ ] /docs endpoint restricted (or accessible)
- [ ] /redoc endpoint restricted (or accessible)

### Host-Level Security
- [ ] UFW firewall configured and active
- [ ] Fail2ban installed and running
- [ ] All fail2ban jails active
- [ ] Logrotate configured
- [ ] Backup script working
- [ ] Cron jobs configured (if applicable)

### Application Functionality
- [ ] Health endpoints responding
- [ ] Frontend accessible
- [ ] HTTP redirects to HTTPS
- [ ] API endpoints working
- [ ] Database connectivity verified
- [ ] Redis connectivity verified

### Performance
- [ ] Container resource usage within limits
- [ ] Disk usage acceptable
- [ ] Log files not growing excessively

### SSL/TLS
- [ ] SSL certificate valid
- [ ] TLS 1.2/1.3 in use
- [ ] HSTS header present

---

## Final Sign-Off

**Date:** _________________

**Verified by:** _________________

**All tests passed:** ☐ YES  ☐ NO (see notes)

**Notes:**

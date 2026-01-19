# Security Hardening Verification Checklist

This document provides verification steps for the security hardening measures implemented after the RCE incident.

## Prerequisites

- Production environment running with `docker compose -f ops/docker/compose.prod.yml`
- Access to the VPS/server
- `curl` and `docker` commands available

---

## TASK 1: Verify Nginx Header Stripping

### Goal
Confirm that identity-related headers cannot be spoofed from the internet.

### Test 1: Verify X-User-Email header is stripped (Backend API)

```bash
# Attempt to send X-User-Email header to backend
curl -v https://app.technasiummbh.nl/api/v1/auth/me \
  -H "X-User-Email: admin@example.com" \
  -H "X-User-Id: 999" \
  -H "X-User-Role: admin" \
  -H "X-Forwarded-User: attacker@evil.com"

# Expected: 401 Unauthorized (no authentication cookie/token)
# The headers should be stripped by nginx before reaching the backend
```

### Test 2: Verify headers are stripped on frontend requests

```bash
# Send headers to frontend
curl -v https://app.technasiummbh.nl/ \
  -H "X-User-Email: admin@example.com" \
  -H "X-User-Id: 999" \
  -H "X-User-Role: admin" \
  -H "X-Forwarded-User: attacker@evil.com"

# Expected: Normal response, but headers should not be processed
```

### Test 3: Check nginx configuration directly

```bash
# SSH into the VPS and inspect nginx config
docker exec tea_nginx cat /etc/nginx/conf.d/default.conf | grep -A10 "proxy_pass"

# Expected: All proxy_pass blocks should have:
# proxy_set_header X-User-Email "";
# proxy_set_header X-User-Id "";
# proxy_set_header X-User-Role "";
# proxy_set_header X-Forwarded-User "";
```

### Test 4: Verify nginx config syntax

```bash
docker exec tea_nginx nginx -t

# Expected: 
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

## TASK 2: Verify Dev-Login Disabled in Production

### Goal
Confirm that X-User-Email authentication is completely unavailable in production.

### Test 1: Check NODE_ENV is set to production

```bash
docker exec tea_backend printenv NODE_ENV

# Expected: production
```

### Test 2: Attempt dev-login in production

```bash
# Try to authenticate with X-User-Email header
curl -v https://app.technasiummbh.nl/api/v1/auth/me \
  -H "X-User-Email: test@technasiummbh.nl"

# Expected: 401 Unauthorized
# Message: "Not authenticated. Please log in."
```

### Test 3: Verify the correct dependency is loaded

```bash
# Check backend logs for any dev-login warnings
docker logs tea_backend --tail=100 | grep -i "dev-login\|X-User-Email"

# Expected: No dev-login warnings (only present in development)
```

### Test 4: Verify Azure AD authentication still works

```bash
# Navigate to login page
curl -v https://app.technasiummbh.nl/api/v1/auth/azure?school_id=1

# Expected: 302 redirect to Microsoft login
```

---

## TASK 3: Verify Frontend Container Hardening

### Goal
Confirm that the frontend container has maximum security restrictions.

### Test 1: Verify no-new-privileges

```bash
docker inspect tea_frontend --format='{{.HostConfig.SecurityOpt}}'

# Expected: [no-new-privileges:true]
```

### Test 2: Verify all capabilities dropped

```bash
docker inspect tea_frontend --format='{{.HostConfig.CapDrop}}'

# Expected: [ALL]
```

### Test 3: Verify read-only filesystem

```bash
docker inspect tea_frontend --format='{{.HostConfig.ReadonlyRootfs}}'

# Expected: true
```

### Test 4: Verify tmpfs mounts with security flags

```bash
docker inspect tea_frontend --format='{{json .HostConfig.Tmpfs}}' | jq

# Expected output should include:
# {
#   "/tmp": "rw,noexec,nosuid,nodev,size=100m",
#   "/app/.next/cache": "rw,noexec,nosuid,nodev,size=50m"
# }
```

### Test 5: Verify container starts and runs correctly

```bash
# Check container status
docker ps | grep tea_frontend

# Expected: Container should be "Up" and healthy

# Check health status
docker inspect tea_frontend --format='{{.State.Health.Status}}'

# Expected: healthy
```

### Test 6: Verify write operations fail in read-only areas

```bash
# Try to write to read-only filesystem
docker exec tea_frontend sh -c "touch /app/test.txt"

# Expected: Error - Read-only file system

# Verify /tmp is writable
docker exec tea_frontend sh -c "touch /tmp/test.txt && rm /tmp/test.txt"

# Expected: Success (no error)
```

### Test 7: Verify noexec on tmpfs

```bash
# Try to execute a binary from /tmp
docker exec tea_frontend sh -c "echo '#!/bin/sh' > /tmp/test.sh && chmod +x /tmp/test.sh && /tmp/test.sh"

# Expected: Permission denied or similar error due to noexec
```

---

## Combined Security Verification

### Test 1: Full authentication flow test

```bash
# 1. Attempt header injection attack
curl -v https://app.technasiummbh.nl/api/v1/auth/me \
  -H "X-User-Email: admin@example.com" \
  -H "X-User-Id: 1" \
  -H "X-User-Role: admin"

# Expected: 401 Unauthorized

# 2. Use proper Azure AD authentication (manual browser test)
# Navigate to: https://app.technasiummbh.nl
# Click login
# Complete Azure AD OAuth flow
# Expected: Successful login and redirect to dashboard
```

### Test 2: Complete container security audit

```bash
# Run a comprehensive security check on all containers
for container in tea_frontend tea_backend tea_nginx; do
    echo "=== Checking $container ==="
    echo "Read-only filesystem:"
    docker inspect $container --format='{{.HostConfig.ReadonlyRootfs}}'
    echo "Security options:"
    docker inspect $container --format='{{.HostConfig.SecurityOpt}}'
    echo "Capabilities dropped:"
    docker inspect $container --format='{{.HostConfig.CapDrop}}'
    echo "---"
done
```

### Test 3: Monitor logs for security alerts

```bash
# Check backend logs for security alerts
docker logs tea_backend --tail=200 | grep -i "security\|alert\|unauthorized"

# Check nginx access logs for suspicious patterns
docker exec tea_nginx tail -100 /var/log/nginx/access.log

# Check nginx error logs
docker exec tea_nginx tail -100 /var/log/nginx/error.log
```

---

## Verification Summary

After completing all tests, verify the following:

- [ ] Nginx strips X-User-Email, X-User-Id, X-User-Role, X-Forwarded-User on ALL proxy locations
- [ ] Nginx configuration is valid and reloads without errors
- [ ] Dev-login (X-User-Email) returns 401 in production
- [ ] Azure AD authentication works correctly
- [ ] NODE_ENV is set to "production" in backend
- [ ] Frontend container has `no-new-privileges:true`
- [ ] Frontend container has all capabilities dropped (cap_drop: ALL)
- [ ] Frontend container filesystem is read-only
- [ ] /tmp is mounted with noexec,nosuid,nodev flags
- [ ] /app/.next/cache is mounted with noexec,nosuid,nodev flags
- [ ] Container starts successfully and passes health checks
- [ ] Write operations fail in read-only areas
- [ ] Execute operations fail on tmpfs (noexec verified)

---

## Rollback Procedure (If Issues Found)

If verification reveals issues:

```bash
# Rollback to previous version
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app
git checkout <previous-commit-sha>

# Rebuild and restart containers
docker compose -f ops/docker/compose.prod.yml down
docker compose -f ops/docker/compose.prod.yml build --no-cache
docker compose -f ops/docker/compose.prod.yml up -d

# Verify services are healthy
docker compose -f ops/docker/compose.prod.yml ps
```

---

## Notes

1. **Nginx Header Stripping**: This is defense-in-depth. The backend also validates authentication, but nginx ensures headers never reach the application.

2. **Dev-Login Removal**: The X-User-Email header is not accepted in the production dependency injection, making it impossible to use in production even if nginx were bypassed.

3. **Read-Only Filesystem**: Next.js standalone mode with pre-built assets allows for a completely read-only filesystem at runtime, significantly reducing attack surface.

4. **Tmpfs Security**: All temporary filesystems use noexec to prevent execution of uploaded or generated binaries.

## Security Contact

If any verification test fails or security concerns are identified:
- Review SECURITY_INCIDENT_EXECUTIVE_SUMMARY.md
- Contact: Security Team
- Emergency: Follow incident response procedures in INCIDENT_RESPONSE_RUNBOOK.md

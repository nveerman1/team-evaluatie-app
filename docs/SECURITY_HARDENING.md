# Security Hardening Guide

Comprehensive security hardening checklist for Team Evaluatie App production deployment.

## Table of Contents

1. [Pre-Deployment Security](#pre-deployment-security)
2. [VPS Hardening](#vps-hardening)
3. [Application Security](#application-security)
4. [Network Security](#network-security)
5. [Database Security](#database-security)
6. [Secrets Management](#secrets-management)
7. [Monitoring & Auditing](#monitoring--auditing)
8. [Incident Response](#incident-response)

---

## Pre-Deployment Security

### ✅ Security Checklist

Before going live, verify:

- [ ] All secrets are randomized (no defaults)
- [ ] `.env.prod` is never committed to Git
- [ ] SSL certificates are valid and auto-renewing
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] HSTS header is enabled
- [ ] Security headers are configured
- [ ] CORS origins are explicitly listed (no wildcards)
- [ ] Cookie security is enabled (secure, httponly, samesite)
- [ ] Database passwords are strong (32+ characters)
- [ ] Redis password is set
- [ ] SSH key authentication is used (no passwords)
- [ ] Firewall is configured (only 22, 80, 443)
- [ ] Fail2ban is installed and active
- [ ] Automatic security updates are enabled
- [ ] Backup encryption is considered
- [ ] Audit logging is enabled

---

## VPS Hardening

### 1. SSH Hardening

```bash
# Edit SSH config
sudo vim /etc/ssh/sshd_config

# Recommended settings:
Port 22  # Consider non-standard port (e.g., 2222) for extra security
PermitRootLogin no  # Disable root login
PasswordAuthentication no  # Only SSH keys
PubkeyAuthentication yes
MaxAuthTries 3
MaxSessions 2
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy  # Only specific users

# Restart SSH
sudo systemctl restart sshd
```

### 2. Firewall (UFW)

```bash
# Reset firewall (if needed)
sudo ufw --force reset

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (FIRST!)
sudo ufw allow 22/tcp
# If using non-standard port:
# sudo ufw allow 2222/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Rate limiting for SSH
sudo ufw limit 22/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

### 3. Fail2ban (SSH Protection)

```bash
# Install
sudo apt install fail2ban -y

# Create local config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit config
sudo vim /etc/fail2ban/jail.local

# Recommended settings:
[DEFAULT]
bantime = 3600        # Ban for 1 hour
findtime = 600        # 10 minute window
maxretry = 3          # 3 attempts

[sshd]
enabled = true
port = 22
logpath = /var/log/auth.log
maxretry = 3

# Start and enable
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### 4. Automatic Security Updates

```bash
# Install unattended-upgrades
sudo apt install unattended-upgrades -y

# Configure
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Edit config
sudo vim /etc/apt/apt.conf.d/50unattended-upgrades

# Enable automatic security updates:
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::Automatic-Reboot "false";  # Don't auto-reboot
Unattended-Upgrade::Mail "your-email@example.com";  # Get notifications

# Enable automatic updates
sudo vim /etc/apt/apt.conf.d/20auto-upgrades

APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
```

### 5. Disable Unnecessary Services

```bash
# List running services
systemctl list-units --type=service --state=running

# Disable unused services (examples)
sudo systemctl disable bluetooth
sudo systemctl disable avahi-daemon

# Remove unnecessary packages
sudo apt autoremove -y
```

### 6. System Hardening

```bash
# Disable IPv6 (if not used)
sudo vim /etc/sysctl.conf
# Add:
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1

# Apply
sudo sysctl -p

# Kernel hardening
sudo vim /etc/sysctl.conf
# Add:
# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# Disable IP source routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Ignore ICMP ping requests (optional)
# net.ipv4.icmp_echo_ignore_all = 1

# Apply
sudo sysctl -p
```

---

## Application Security

### 1. Environment Variables

```bash
# Ensure .env.prod has correct permissions
chmod 600 /opt/team-evaluatie-app/.env.prod

# Owned by application user only
sudo chown deploy:deploy /opt/team-evaluatie-app/.env.prod

# Verify no sensitive data in git
cd /opt/team-evaluatie-app
git grep -i "password\|secret\|key" | grep -v ".example"
# Should return no results (or only commented examples)
```

### 2. JWT Security

In `.env.prod`:

```bash
# Generate strong secret key (32+ characters)
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')

# Reasonable token expiration
ACCESS_TOKEN_EXPIRE_MINUTES=60  # 1 hour (not too long)

# Strong JWT algorithm
JWT_ALGORITHM=HS256  # Already configured
```

### 3. Cookie Security

In `.env.prod`:

```bash
# MUST be true in production
COOKIE_SECURE=true

# Set cookie domain
COOKIE_DOMAIN=.yourdomain.com

# Prevent CSRF
COOKIE_SAMESITE=Lax

# Reasonable expiration
COOKIE_MAX_AGE=604800  # 7 days
```

### 4. CORS Configuration

In `.env.prod`:

```bash
# NEVER use wildcards in production!
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Add specific subdomains if needed
# CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
```

### 5. Rate Limiting

Already configured in:
- `backend/app/api/middleware/rate_limit.py`
- `ops/nginx/nginx.conf`

Adjust limits if needed:

```nginx
# In nginx.conf
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;  # API calls
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;  # Auth endpoints
```

### 6. Input Validation

Backend (FastAPI) automatically validates input via Pydantic models.

Additional checks:
- SQL injection: ✅ Protected (using SQLAlchemy ORM)
- XSS: ✅ Protected (React escapes by default + hardened CSP)
- CSRF: ✅ Protected (SameSite cookies)
- File uploads: ✅ Rate limited (5 req/min as of 2026-01-14)
- SSRF: ✅ Protected (URL validation with hostname allowlists)

**New Security Features (2026-01-14):**

1. **API Documentation Disabled in Production**
   - Requires `NODE_ENV=production` in `.env.prod`
   - Disables `/docs`, `/redoc`, and `/openapi.json` endpoints
   - Prevents API reconnaissance and Swagger UI vulnerabilities

2. **Hardened Content-Security-Policy**
   - Production: Removes `unsafe-eval` from script-src
   - Allows `wasm-unsafe-eval` for WebAssembly only
   - Development: Keeps unsafe directives for Next.js hot reload

3. **File Upload Rate Limiting**
   - CSV imports: 5 requests per minute
   - Prevents DoS attacks on resource-intensive operations
   - Complements existing 10MB file size and 10,000 row limits

4. **Ollama SSRF Protection**
   - Only allows localhost, 127.0.0.1, ::1, and 'ollama' hostnames
   - Validates URL protocol (HTTP/HTTPS only)
   - Prevents internal network scanning

### 7. Dependency Security

```bash
# Scan Python dependencies
cd /opt/team-evaluatie-app/backend
pip install pip-audit
pip-audit

# Scan npm dependencies
cd /opt/team-evaluatie-app/frontend
npm audit

# Update vulnerable packages
pip install --upgrade <package>
npm update <package>

# Setup Dependabot (GitHub)
# Already configured in .github/dependabot.yml
```

---

## Network Security

### 1. Nginx Security Headers

Already configured in `ops/nginx/site.conf`:

```nginx
# Security headers (verify these are present)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### 2. Content Security Policy (CSP)

Adjust CSP in `ops/nginx/site.conf`:

```nginx
# Start with restrictive policy, relax as needed
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none';" always;
```

### 3. SSL/TLS Configuration

Already configured in `ops/nginx/ssl.conf`:

- TLS 1.2 and 1.3 only ✅
- Strong cipher suites ✅
- OCSP stapling ✅
- Session resumption ✅

Optional: Generate DH parameters for forward secrecy:

```bash
# Generate dhparam (takes 5-10 minutes)
docker exec tea_nginx openssl dhparam -out /etc/nginx/dhparam.pem 2048

# Add to ssl.conf (uncomment line)
ssl_dhparam /etc/nginx/dhparam.pem;
```

### 4. Hide Server Information

```nginx
# In nginx.conf (already configured)
server_tokens off;  # Hide nginx version
```

In Docker:

```dockerfile
# Backend Dockerfile (already configured)
# No version info in error pages
```

---

## Database Security

### 1. Strong Passwords

```bash
# Generate strong database password
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'

# Update in .env.prod
POSTGRES_PASSWORD=<generated-password>
```

### 2. Database Access Control

In `ops/docker/compose.prod.yml`:

```yaml
# Database is NOT exposed to host (secure by default)
db:
  # ports:  # Commented out - only accessible within Docker network
  #   - "5432:5432"
```

For remote database access (if needed):

```bash
# Only allow specific IP addresses
# In postgresql.conf:
listen_addresses = 'localhost,10.0.0.5'  # Specific IPs only

# In pg_hba.conf:
host all all 10.0.0.5/32 scram-sha-256  # Specific IP with password
```

### 3. Database Backup Encryption

```bash
# Encrypt backups (optional but recommended)
# Modify backup script to use GPG encryption:

# In backup_db.sh, after pg_dump:
gpg --symmetric --cipher-algo AES256 "${BACKUP_PATH}/${BACKUP_FILE}"
rm "${BACKUP_PATH}/${BACKUP_FILE}"  # Remove unencrypted version

# To restore:
gpg --decrypt backup.sql.gz.gpg | gunzip | psql ...
```

### 4. Database Auditing

Enable PostgreSQL audit logging:

```yaml
# In compose.prod.yml, under db service:
command: >
  postgres
  -c log_statement=mod  # Log INSERT, UPDATE, DELETE
  -c log_connections=on
  -c log_disconnections=on
  -c log_duration=on
```

---

## Secrets Management

### 1. Environment File Security

```bash
# Correct permissions
chmod 600 /opt/team-evaluatie-app/.env.prod
chown deploy:deploy /opt/team-evaluatie-app/.env.prod

# Verify not in git
cat /opt/team-evaluatie-app/.gitignore | grep ".env.prod"
# Should show: .env.prod
```

### 2. Docker Secrets (Alternative)

For enhanced security, use Docker secrets:

```bash
# Create secrets
echo "my-secret-password" | docker secret create postgres_password -
echo "my-redis-password" | docker secret create redis_password -

# Use in compose file:
secrets:
  postgres_password:
    external: true
  redis_password:
    external: true

services:
  db:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
```

### 3. Azure AD Secrets

```bash
# Never commit Azure AD secrets to git
# Store securely in .env.prod only
# Rotate client secrets regularly (every 12 months)

# To rotate:
# 1. Generate new secret in Azure Portal
# 2. Update .env.prod with new secret
# 3. Restart services
# 4. Verify login works
# 5. Delete old secret from Azure Portal
```

### 4. Secret Rotation Schedule

- **JWT Secret**: Rotate every 6 months
- **Database Password**: Rotate every 12 months
- **Redis Password**: Rotate every 12 months
- **Azure AD Client Secret**: Rotate every 12 months (or when compromised)
- **SSL Certificates**: Auto-renewed by Certbot every 60 days

---

## Monitoring & Auditing

### 1. Audit Logging

Backend already logs important actions:
- Authentication attempts
- Data modifications
- Admin actions

Check logs:

```bash
docker compose -f ops/docker/compose.prod.yml logs backend | grep -i "audit"
```

### 2. Security Monitoring

```bash
# Monitor failed login attempts
docker compose -f ops/docker/compose.prod.yml logs backend | grep -i "failed\|unauthorized"

# Monitor nginx access logs
docker logs tea_nginx | grep -E "40[13]|50[023]"

# Check fail2ban status
sudo fail2ban-client status sshd
```

### 3. Intrusion Detection (Optional)

For advanced security:

```bash
# Install AIDE (Advanced Intrusion Detection Environment)
sudo apt install aide -y
sudo aideinit
sudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Run daily checks
echo "0 4 * * * /usr/bin/aide --check" | sudo crontab -
```

### 4. Vulnerability Scanning

```bash
# Scan Docker images for vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image tea-backend:latest

docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image tea-frontend:latest

# Schedule weekly scans
echo "0 3 * * 0 cd /opt/team-evaluatie-app && docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image tea-backend:latest > /var/log/tea-security-scan.log" | crontab -
```

---

## CI/CD Security

### 1. GitHub Actions Security (Updated 2026-01-14)

**Supply Chain Security:**
All GitHub Actions are now pinned to full commit SHAs to prevent supply chain attacks:

```yaml
# .github/workflows/deploy.yml and ci.yml
- name: Checkout code
  uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

- name: Set up Python
  uses: actions/setup-python@0b93645e9fea7318ecaed2b359559ac225c90a2b  # v5.3.0

- name: Set up Node.js
  uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0
```

**Why This Matters:**
- Version tags (e.g., `@v4`) can be moved by attackers who compromise the action repository
- Commit SHAs are immutable and cannot be changed
- Comments preserve version information for maintainability

**Maintenance:**
- Review and update actions quarterly
- Use Dependabot to monitor for updates
- Verify commit SHAs match expected versions before updating

### 2. Secrets Management

```bash
# Never commit secrets to repository
git grep -i "password\|secret\|key" | grep -v ".example"

# Use GitHub Secrets for CI/CD
# Settings > Secrets and variables > Actions
# Add: VPS_HOST, VPS_USER, VPS_SSH_KEY, GHCR_TOKEN
```

### 3. Deployment Security

```bash
# Verify SSH key permissions
chmod 600 ~/.ssh/deploy_key

# Use deploy-specific SSH keys (not personal keys)
# Rotate keys regularly (every 6 months)

# Review deployment logs for suspicious activity
# GitHub Actions > Recent workflow runs
```

---

## Incident Response

### 1. Incident Response Plan

**Detection:**
- Monitor logs for suspicious activity
- Setup alerts for failed auth attempts
- Monitor resource usage spikes

**Containment:**
```bash
# Immediate response to security incident:

# 1. Take site offline
docker compose -f ops/docker/compose.prod.yml down
sudo ufw deny 80
sudo ufw deny 443

# 2. Create forensic backup
bash scripts/backup_db.sh --quick
docker compose -f ops/docker/compose.prod.yml logs > /tmp/incident-logs-$(date +%Y%m%d).txt

# 3. Preserve evidence
# Don't modify logs or data until analyzed
```

**Recovery:**
```bash
# 1. Identify and fix vulnerability
# 2. Rotate all secrets
# 3. Restore from clean backup
# 4. Deploy patched version
# 5. Monitor closely
```

### 2. Security Contacts

Maintain list of security contacts:
- Primary security contact
- Incident response team
- Data protection officer (if applicable)
- Legal counsel

### 3. Data Breach Protocol

If personal data is compromised:
1. Document incident thoroughly
2. Notify affected users (GDPR requirement)
3. Report to authorities if required
4. Implement corrective measures
5. Update security procedures

---

## Security Checklist (Regular Reviews)

### Weekly
- [ ] Review application logs for errors
- [ ] Check failed login attempts
- [ ] Verify backups are running
- [ ] Check SSL certificate expiry

### Monthly
- [ ] Update system packages
- [ ] Review user access (remove inactive users)
- [ ] Check firewall rules
- [ ] Review audit logs
- [ ] Run vulnerability scans

### Quarterly
- [ ] Rotate sensitive credentials
- [ ] Security audit
- [ ] Penetration testing (if budget allows)
- [ ] Review and update security policies
- [ ] Disaster recovery drill

### Annually
- [ ] Comprehensive security review
- [ ] Update all passwords
- [ ] Review and update documentation
- [ ] Security training for team
- [ ] Third-party security audit

---

## Additional Security Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **CIS Benchmarks**: https://www.cisecurity.org/cis-benchmarks/
- **Docker Security**: https://docs.docker.com/engine/security/
- **FastAPI Security**: https://fastapi.tiangolo.com/tutorial/security/
- **Next.js Security**: https://nextjs.org/docs/advanced-features/security-headers

---

**Remember**: Security is an ongoing process, not a one-time task!

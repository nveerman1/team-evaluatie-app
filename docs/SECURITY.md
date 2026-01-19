# Security Guide - Team Evaluatie App

This document provides security guidelines for deploying and operating the Team Evaluatie App.

## Table of Contents
- [Security Overview](#security-overview)
- [Production Hardening Checklist](#production-hardening-checklist)
- [Environment Configuration](#environment-configuration)
- [Rate Limiting](#rate-limiting)
- [CORS Configuration](#cors-configuration)
- [Security Headers](#security-headers)
- [Authentication & Authorization](#authentication--authorization)
- [Secret Management](#secret-management)
- [Logging & Monitoring](#logging--monitoring)
- [Dependency Management](#dependency-management)
- [Security Testing](#security-testing)

## Security Overview

The Team Evaluatie App implements multiple layers of security:

1. **Authentication**: Azure AD OAuth (production) + JWT tokens
2. **Authorization**: Role-based access control (RBAC) with school-level isolation
3. **Rate Limiting**: Redis-backed sliding window rate limiting
4. **Security Headers**: CSP, HSTS, X-Frame-Options, etc.
5. **CORS**: Restrictive cross-origin resource sharing
6. **Input Validation**: Pydantic schemas with strict validation
7. **Secure Sessions**: HttpOnly, Secure, SameSite cookies

## Production Hardening Checklist

Before deploying to production, ensure all items are completed:

### Critical Security Settings

- [ ] **Set SECRET_KEY**: Generate a strong random key (min 32 chars)
  ```bash
  python -c 'import secrets; print(secrets.token_urlsafe(32))'
  ```
- [ ] **Set NODE_ENV=production**: Disables dev-login and enables production security
- [ ] **Enable COOKIE_SECURE=true**: Requires HTTPS for session cookies
- [ ] **Configure CORS_ORIGINS**: Set to your actual frontend domain(s)
- [ ] **Configure Azure AD**: Set all AZURE_AD_* environment variables
- [ ] **Use strong DATABASE_URL**: Never use default passwords
- [ ] **Secure Redis**: Set REDIS_URL with authentication if exposed

### Infrastructure Security

- [ ] **Use HTTPS**: TLS/SSL certificates (Let's Encrypt, Cloudflare, etc.)
- [ ] **Configure Firewall**: Restrict access to backend ports (5432, 6379, 8000)
- [ ] **Enable Database Encryption**: PostgreSQL SSL connections
- [ ] **Implement Backups**: Automated database backups with encryption
- [ ] **Set up Monitoring**: Application logs, error tracking, uptime monitoring
- [ ] **Configure Reverse Proxy**: nginx/Caddy with security headers and rate limiting

### Application Security

- [ ] **Review User Permissions**: Verify RBAC rules for all endpoints
- [ ] **Test Rate Limits**: Verify rate limiting works on auth/public endpoints
- [ ] **Validate Input**: Review all user inputs for injection risks
- [ ] **Check File Uploads**: If enabled, validate file types/sizes/content
- [ ] **Test External Tokens**: Verify expiration and single-use enforcement
- [ ] **Audit Logging**: Enable audit logs for sensitive operations
- [ ] **Error Handling**: Ensure production errors don't leak sensitive info

### Dependency Security

- [ ] **Update Dependencies**: Run `npm audit` and `pip-audit` regularly
- [ ] **Review Package.json**: No unused or deprecated packages
- [ ] **Pin Versions**: Use lock files (package-lock.json, requirements.txt)
- [ ] **Scan Containers**: Use vulnerability scanners on Docker images
- [ ] **Monitor CVEs**: Subscribe to security advisories for key dependencies

## Environment Configuration

### Required Environment Variables (Production)

```bash
# Application
NODE_ENV=production
APP_ENV=production

# Security - CRITICAL: Change these!
SECRET_KEY=<generate-with-secrets-token-urlsafe-32>
COOKIE_SECURE=true
COOKIE_DOMAIN=.yourdomain.com  # Include leading dot for subdomains
COOKIE_SAMESITE=Lax

# CORS - Set to your frontend domain(s)
CORS_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com

# URLs
FRONTEND_URL=https://app.yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# Database - Use strong passwords!
DATABASE_URL=postgresql+psycopg2://user:password@host:5432/dbname

# Redis - Enable authentication in production
REDIS_URL=redis://:password@host:6379/0

# Azure AD (OAuth)
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_REDIRECT_URI=https://api.yourdomain.com/api/v1/auth/azure/callback
AZURE_AD_SCOPES=User.Read
AZURE_AD_ALLOWED_DOMAINS=yourdomain.com,yourschool.edu
```

### Development Environment Variables

For development, you can use more relaxed settings:

```bash
# Application
NODE_ENV=development

# Security (dev-only defaults)
SECRET_KEY=dev-secret-key-not-for-production
COOKIE_SECURE=false  # OK for localhost HTTP

# CORS (localhost)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000

# Database (local)
DATABASE_URL=postgresql+psycopg2://app:app@localhost:5432/tea

# Redis (local)
REDIS_URL=redis://localhost:6379/0
```

## Rate Limiting

The application implements Redis-backed rate limiting with different limits per endpoint type:

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Auth endpoints | 5 requests | 60 seconds |
| Public/External endpoints | 10 requests | 60 seconds |
| Queue/Job endpoints | 10 requests | 60 seconds |
| Batch endpoints | 5 requests | 60 seconds |
| Default API endpoints | 100 requests | 60 seconds |

### Rate Limit Headers

All responses include rate limit information:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Window duration in seconds

### Testing Rate Limits

```bash
# Test auth endpoint rate limit (should block after 5 requests in 60s)
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/v1/auth/azure \
    -H "Content-Type: application/json" \
    -d '{"school_id": 1}' \
    -w "\nStatus: %{http_code}\n"
  echo "Request $i"
done

# Expected: First 5 succeed (302 redirect), then 429 Too Many Requests
```

## CORS Configuration

### Current Settings

```python
allow_origins: List of specific origins (no wildcards)
allow_credentials: True (cookies allowed)
allow_methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
allow_headers: ["Content-Type", "Authorization", "X-User-Email"]
expose_headers: ["Content-Type", "X-RateLimit-*"]
```

### Production CORS

For production, set `CORS_ORIGINS` to your exact frontend URLs:

```bash
# Single domain
CORS_ORIGINS=https://app.yourdomain.com

# Multiple domains (comma-separated)
CORS_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com

# ❌ NEVER use wildcards in production
# CORS_ORIGINS=*  # INSECURE!
```

### Development CORS

For local development:

```bash
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## Security Headers

All responses include security headers via middleware:

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Prevent clickjacking |
| X-XSS-Protection | 1; mode=block | Legacy XSS protection |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer info |
| Strict-Transport-Security | max-age=31536000; includeSubDomains; preload | Force HTTPS (prod only) |
| Content-Security-Policy | default-src 'none'; ... | Reduce XSS risk |
| Permissions-Policy | geolocation=(), ... | Disable unused features |

### HSTS (HTTP Strict Transport Security)

HSTS is automatically enabled when `COOKIE_SECURE=true`:
- max-age: 1 year (31536000 seconds)
- includeSubDomains: Applies to all subdomains
- preload: Eligible for browser HSTS preload lists

## Authentication & Authorization

### Production Authentication (Azure AD)

1. **Register Azure AD application**: Follow [AZURE_AD_SETUP.md](AZURE_AD_SETUP.md)
2. **Configure redirect URI**: Must match your backend URL
3. **Set allowed domains**: Restrict to your organization's email domains
4. **Test OAuth flow**: Verify login/logout works correctly

### Development Authentication

In development (`NODE_ENV=development`), you can use the `X-User-Email` header for testing:

```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "X-User-Email: teacher1@school1.demo"
```

**⚠️ WARNING**: This header-based auth is **automatically disabled** in production.

### Authorization (RBAC)

The app uses role-based access control with three roles:
- **admin**: Full access to all resources in their school
- **teacher**: Access to assigned courses and evaluations
- **student**: Access to own evaluations and submissions

All data is automatically scoped by `school_id` for multi-tenant isolation.

## Secret Management

### Secrets to Protect

Never commit these to version control:
- `SECRET_KEY`: JWT signing key
- `DATABASE_URL`: Database credentials
- `REDIS_URL`: Redis password (if using)
- `AZURE_AD_CLIENT_SECRET`: OAuth client secret
- Any API keys for external services

### Best Practices

1. **Use Environment Variables**: Store secrets in `.env` file (not committed)
2. **Use Secret Management Systems**: AWS Secrets Manager, Azure Key Vault, etc.
3. **Rotate Secrets Regularly**: Change keys/passwords periodically
4. **Limit Access**: Only production systems should have production secrets
5. **Audit Secret Access**: Log when secrets are accessed/changed

### Generating Strong Secrets

```bash
# SECRET_KEY (32+ characters)
python -c 'import secrets; print(secrets.token_urlsafe(32))'

# Database password (24+ characters)
python -c 'import secrets; print(secrets.token_urlsafe(24))'

# External invite token (32 bytes = 64 hex chars)
python -c 'import secrets; print(secrets.token_urlsafe(32))'
```

## Logging & Monitoring

### Security-Relevant Logs

The application logs security events:
- Authentication attempts (success/failure)
- Authorization failures (403 errors)
- Rate limit violations
- External token usage
- Schema validation errors
- Database connection errors

### PII Protection in Logs

The application avoids logging:
- Passwords or password hashes
- JWT tokens or session cookies
- Personal student feedback (only metadata)
- Email addresses in error messages

### Production Logging

Configure structured logging in production:

```python
# Log to JSON for easy parsing
import logging.config

LOGGING_CONFIG = {
    "version": 1,
    "formatters": {
        "json": {
            "class": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json"
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"]
    }
}

logging.config.dictConfig(LOGGING_CONFIG)
```

### Monitoring Recommendations

1. **Application Monitoring**: Sentry, DataDog, New Relic
2. **Log Aggregation**: ELK Stack, Splunk, CloudWatch Logs
3. **Uptime Monitoring**: Pingdom, UptimeRobot, StatusCake
4. **Security Scanning**: OWASP ZAP, Burp Suite, Nuclei

## Dependency Management

### Backend (Python)

```bash
# Audit Python dependencies
pip install pip-audit
pip-audit

# Update dependencies
pip install --upgrade -r requirements.txt

# Regenerate lock file
pip freeze > requirements.txt
```

### Frontend (Node.js)

```bash
# Audit npm dependencies
npm audit

# Fix vulnerabilities automatically
npm audit fix

# Update dependencies
npm update

# Check for outdated packages
npm outdated
```

### Recommended Tools

1. **Dependabot**: Automated dependency updates (GitHub)
2. **Snyk**: Vulnerability scanning and monitoring
3. **OWASP Dependency-Check**: Open-source dependency scanner
4. **npm-check**: Interactive npm update tool

### CI/CD Integration

Add security checks to your CI pipeline:

```yaml
# .github/workflows/security.yml
name: Security Checks
on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Python Security Scan
        run: |
          pip install pip-audit bandit
          pip-audit
          bandit -r backend/app/
      
      - name: Node.js Security Scan
        working-directory: frontend
        run: |
          npm audit
          npx snyk test
```

## Security Testing

### Manual Testing Checklist

- [ ] **Authentication Bypass**: Try accessing protected endpoints without auth
- [ ] **IDOR Testing**: Try accessing other users' data via ID manipulation
- [ ] **SQL Injection**: Test input fields with SQL payloads
- [ ] **XSS**: Test input fields with JavaScript payloads
- [ ] **CSRF**: Test state-changing operations without proper tokens
- [ ] **Rate Limiting**: Verify rate limits on auth and public endpoints
- [ ] **Session Management**: Test token expiration and logout
- [ ] **File Upload**: If enabled, test malicious file uploads
- [ ] **External Tokens**: Verify expiration and single-use enforcement

### Automated Security Testing

```bash
# OWASP ZAP baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:8000 \
  -r zap-report.html

# Nuclei vulnerability scanner
nuclei -u http://localhost:8000 \
  -templates ./nuclei-templates \
  -severity critical,high

# SQLMap for SQL injection testing
sqlmap -u "http://localhost:8000/api/v1/endpoint?id=1" \
  --cookie="access_token=..." \
  --batch
```

### Penetration Testing

For production deployments, consider:
1. **Annual Penetration Tests**: Hire professional security testers
2. **Bug Bounty Program**: Incentivize responsible disclosure
3. **Security Audits**: Code review by security experts
4. **Compliance Testing**: GDPR, SOC 2, ISO 27001 (if required)

## Incident Response

### Security Incident Checklist

If you detect a security breach:

1. **Contain**: Isolate affected systems immediately
2. **Assess**: Determine scope and impact of breach
3. **Eradicate**: Remove attacker access, patch vulnerabilities
4. **Recover**: Restore systems from clean backups
5. **Notify**: Inform affected users and authorities (GDPR)
6. **Learn**: Conduct post-mortem and update security measures

### Emergency Contacts

Maintain a list of security contacts:
- Security team lead
- Infrastructure/DevOps lead
- Legal counsel
- Data protection officer (if required)
- Third-party security consultants

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Azure AD Security](https://learn.microsoft.com/en-us/azure/active-directory/develop/security-best-practices)
- [GDPR Compliance](https://gdpr.eu/)

## Contact

For security issues, please email: security@yourdomain.com

**Do not** open public GitHub issues for security vulnerabilities.

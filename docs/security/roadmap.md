# Post-Incident Security Improvements Roadmap

**Date**: January 10, 2026  
**Status**: Recommendations for Long-term Security Enhancement  
**Priority**: Implement after immediate incident response  

---

## 🎯 IMMEDIATE (Completed)

✅ **Emergency Response** - All critical patches applied
- Version downgrades (React 18.3.1, Next.js 15.0.3)
- Docker security hardening
- Nginx RSC protection
- Verification tools created
- Comprehensive documentation

---

## 📅 30-DAY SECURITY ROADMAP

### Week 1: Monitoring & Detection

**1. Enhanced Monitoring Setup** (Priority: HIGH)
```yaml
# Implement monitoring for:
- RSC endpoint traffic patterns
- Container resource usage (CPU, memory, processes)
- Outbound network connections
- Rate limit violations
- Failed authentication attempts
```

**Actions**:
- [ ] Set up Prometheus metrics collection
- [ ] Create Grafana dashboards for security metrics
- [ ] Configure alerting rules (see RCE_DETECTION_QUICK_REF.md)
- [ ] Set up log aggregation (ELK stack or similar)
- [ ] Configure alert escalation paths

**Tools to Consider**:
- Prometheus + Grafana
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog / New Relic
- PagerDuty for alerting

---

**2. CI/CD Security Scanning Enhancement** (Priority: HIGH)

Currently CI includes:
- ✅ Bandit (Python security)
- ✅ pip-audit (Python dependencies)
- ❌ No npm audit (missing)
- ❌ No container scanning
- ❌ No secrets scanning

**Action Items**:

a) **Add npm audit to CI** (frontend/.github/workflows/ci.yml):
```yaml
- name: npm audit
  working-directory: frontend
  run: |
    npm audit --production --audit-level=moderate
    npm audit fix --dry-run
```

b) **Add Trivy container scanning**:
```yaml
- name: Trivy container scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: 'tea-frontend:latest'
    format: 'sarif'
    severity: 'CRITICAL,HIGH'
```

c) **Add secrets scanning with TruffleHog**:
```yaml
- name: TruffleHog OSS
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: main
    head: HEAD
```

d) **Update dependabot configuration**:
```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule:
      interval: "daily"  # Changed from weekly
    open-pull-requests-limit: 10
    
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "daily"  # Changed from weekly
    open-pull-requests-limit: 10
    
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

**3. Incident Response Drills** (Priority: MEDIUM)

- [ ] Schedule quarterly incident response drills
- [ ] Test incident response procedures
- [ ] Verify escalation paths work
- [ ] Practice with verification tools
- [ ] Update procedures based on learnings

---

### Week 2: Infrastructure Hardening

**1. Network Segmentation** (Priority: HIGH)

Current: All containers on single bridge network  
Recommended: Separate networks for isolation

```yaml
# ops/docker/compose.prod.yml
networks:
  frontend-network:
    driver: bridge
  backend-network:
    driver: bridge
    internal: true  # No internet access
  db-network:
    driver: bridge
    internal: true  # No internet access

services:
  frontend:
    networks:
      - frontend-network
      - backend-network
  
  backend:
    networks:
      - backend-network
      - db-network
  
  db:
    networks:
      - db-network  # Frontend cannot reach DB
```

**Benefits**:
- Frontend cannot directly access database
- Backend isolated from internet (only internal calls)
- Limits lateral movement in case of compromise

---

**2. Implement Web Application Firewall (WAF)** (Priority: HIGH)

**Options**:

a) **Nginx ModSecurity** (Self-hosted):
```nginx
# Install ModSecurity module
# Add to nginx.conf
load_module modules/ngx_http_modsecurity_module.so;

http {
    modsecurity on;
    modsecurity_rules_file /etc/nginx/modsecurity/main.conf;
}
```

b) **Cloudflare WAF** (Managed):
- Point DNS to Cloudflare
- Enable WAF rules
- Configure rate limiting
- Enable bot protection

c) **AWS WAF** (If on AWS):
- Create WAF web ACL
- Attach to ALB/CloudFront
- Configure managed rule groups

**Recommended Rules**:
- OWASP Top 10
- Known CVE patterns
- Rate limiting
- Geographic restrictions (if applicable)
- Bot detection

---

**3. Secrets Management** (Priority: HIGH)

Current: Secrets in .env.prod file  
Recommended: External secrets management

**Options**:

a) **Docker Secrets** (Basic):
```yaml
secrets:
  db_password:
    external: true
  redis_password:
    external: true

services:
  backend:
    secrets:
      - db_password
      - redis_password
```

b) **HashiCorp Vault** (Advanced):
- Centralized secrets management
- Automatic rotation
- Audit logging
- Fine-grained access control

c) **AWS Secrets Manager** / **Azure Key Vault** (Cloud):
- Managed service
- Automatic rotation
- IAM integration

**Implementation**:
- [ ] Choose secrets management solution
- [ ] Migrate all secrets from .env.prod
- [ ] Implement secret rotation policies
- [ ] Update deployment procedures
- [ ] Test secret rotation

---

### Week 3: Application Security

**1. Implement Security Headers Middleware** (Priority: MEDIUM)

Backend already has security headers, but verify they're comprehensive:

```python
# backend/app/api/middleware/security_headers.py
# Verify these headers are set:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Content-Security-Policy: (strict)
- Permissions-Policy: (restrictive)
- Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

**Action Items**:
- [ ] Review current CSP policy
- [ ] Tighten CSP if possible (remove unsafe-eval, unsafe-inline)
- [ ] Add report-uri for CSP violations
- [ ] Monitor CSP reports

---

**2. Implement Rate Limiting in Application Layer** (Priority: MEDIUM)

Current: Nginx rate limiting only  
Recommended: Add application-level rate limiting

```python
# backend - Add per-user rate limiting
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/v1/sensitive")
@limiter.limit("10/minute")
async def sensitive_endpoint():
    pass
```

---

**3. CSRF Protection** (Priority: MEDIUM)

Currently: SameSite=Lax provides basic protection  
Recommended: Implement CSRF tokens for state-changing operations

```python
# backend - Add CSRF middleware
from fastapi_csrf_protect import CsrfProtect

@app.post("/api/v1/important")
async def important_action(csrf_protect: CsrfProtect = Depends()):
    await csrf_protect.validate_csrf()
    # ... action ...
```

---

### Week 4: Compliance & Audit

**1. Security Audit Log** (Priority: HIGH)

Implement comprehensive audit logging:

```python
# backend/app/core/audit_log.py
class AuditLog:
    @staticmethod
    async def log_action(
        user_id: int,
        action: str,
        resource: str,
        details: dict,
        ip_address: str,
        user_agent: str
    ):
        # Log to database and/or external system
        pass

# Usage:
await AuditLog.log_action(
    user_id=current_user.id,
    action="delete_evaluation",
    resource=f"evaluation_{eval_id}",
    details={"reason": "admin request"},
    ip_address=request.client.host,
    user_agent=request.headers.get("user-agent")
)
```

**What to Log**:
- User authentication (success/failure)
- Admin actions (create, update, delete)
- Permission changes
- Data exports
- Configuration changes
- API key usage

---

**2. Implement PII Redaction in Logs** (Priority: HIGH)

```python
# backend/app/core/logging_config.py
import re

class PIIRedactingFormatter(logging.Formatter):
    patterns = [
        (re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), '[EMAIL]'),
        (re.compile(r'\b\d{3}-\d{2}-\d{4}\b'), '[SSN]'),
        (re.compile(r'password["\']:\s*["\'][^"\']+["\']'), 'password: "[REDACTED]"'),
    ]
    
    def format(self, record):
        message = super().format(record)
        for pattern, replacement in self.patterns:
            message = pattern.sub(replacement, message)
        return message
```

---

**3. GDPR Compliance Review** (Priority: MEDIUM)

- [ ] Document what personal data is collected
- [ ] Implement data retention policies
- [ ] Create data export functionality
- [ ] Create data deletion functionality
- [ ] Update privacy policy
- [ ] Implement consent management
- [ ] Add audit logging for GDPR requests

---

## 📅 60-DAY SECURITY ROADMAP

### Security Testing & Validation

**1. Penetration Testing** (Priority: HIGH)

- [ ] Hire external penetration testing firm
- [ ] Schedule engagement (2-3 days)
- [ ] Provide scope document
- [ ] Review findings
- [ ] Prioritize and fix vulnerabilities
- [ ] Retest critical findings

**Focus Areas**:
- Authentication bypass attempts
- Authorization flaws
- Injection vulnerabilities (SQL, command, etc.)
- Business logic flaws
- External assessment endpoints
- Rate limiting effectiveness

---

**2. Vulnerability Scanning** (Priority: MEDIUM)

Tools to implement:
- **Snyk**: Dependency scanning
- **OWASP ZAP**: Dynamic application scanning
- **SonarQube**: Static code analysis

```yaml
# Add to CI pipeline
- name: OWASP ZAP Scan
  uses: zaproxy/action-full-scan@v0.9.0
  with:
    target: 'http://localhost:3000'
```

---

**3. Bug Bounty Program** (Priority: LOW)

Consider implementing a bug bounty program:
- Start with private program
- Define scope (in-scope domains, endpoints)
- Set reward structure
- Use platform like HackerOne or Bugcrowd

---

### Advanced Monitoring

**1. Security Information and Event Management (SIEM)** (Priority: HIGH)

Implement centralized security monitoring:

**Options**:
- **Wazuh** (Open source)
- **Splunk** (Enterprise)
- **Elastic Security** (SIEM built on ELK)

**Capabilities**:
- Log aggregation from all sources
- Real-time threat detection
- Compliance reporting
- Forensic analysis
- Alert correlation

---

**2. Intrusion Detection/Prevention System (IDS/IPS)** (Priority: MEDIUM)

**Options**:
- **Suricata** (Open source)
- **Snort** (Open source)
- **AWS GuardDuty** (If on AWS)

Deploy inline to detect/block:
- Malicious traffic patterns
- Known attack signatures
- Anomalous behavior

---

## 📅 90-DAY SECURITY ROADMAP

### Organizational Security

**1. Security Awareness Training** (Priority: HIGH)

- [ ] Conduct security awareness training for all team members
- [ ] Cover topics:
  - Phishing awareness
  - Password security
  - Incident reporting
  - Secure coding practices
  - GDPR/privacy requirements
- [ ] Schedule quarterly refreshers
- [ ] Track completion

---

**2. Security Champions Program** (Priority: MEDIUM)

- [ ] Identify security champions in each team
- [ ] Provide advanced security training
- [ ] Champions lead security reviews
- [ ] Regular security champion meetings
- [ ] Share lessons learned

---

**3. Disaster Recovery & Business Continuity** (Priority: HIGH)

- [ ] Document disaster recovery procedures
- [ ] Define Recovery Time Objective (RTO)
- [ ] Define Recovery Point Objective (RPO)
- [ ] Test backup restoration
- [ ] Test failover procedures
- [ ] Document communication plans
- [ ] Schedule annual DR drills

---

### Advanced Infrastructure

**1. Container Security Scanning** (Priority: HIGH)

Implement continuous container scanning:

```yaml
# Add to CI/CD
- name: Scan frontend image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: tea-frontend:${{ github.sha }}
    format: 'table'
    exit-code: '1'
    severity: 'CRITICAL,HIGH'
```

Also consider:
- Runtime container monitoring (Falco)
- Image signing (Notary, Cosign)
- Registry scanning (Harbor, Quay)

---

**2. Zero Trust Network Architecture** (Priority: MEDIUM)

Gradually move toward zero trust:

- [ ] Implement service mesh (Istio, Linkerd)
- [ ] mTLS between all services
- [ ] Fine-grained network policies
- [ ] Just-in-time access
- [ ] Continuous authentication

---

**3. Immutable Infrastructure** (Priority: LOW)

- [ ] Implement GitOps (ArgoCD, Flux)
- [ ] Infrastructure as Code (Terraform, Pulumi)
- [ ] Immutable server patterns
- [ ] Automated deployments
- [ ] Configuration drift detection

---

## 📊 METRICS & KPIs

Track security posture with metrics:

### Security Metrics
- Mean Time to Detect (MTTD): < 15 minutes
- Mean Time to Respond (MTTR): < 4 hours
- Mean Time to Resolve (MTTRes): < 24 hours
- Percentage of systems patched: > 95%
- Vulnerability aging: < 30 days

### Operational Metrics
- Failed authentication attempts: Track and alert
- Rate limit violations: < 100/day per IP
- Security scan findings: Trend downward
- Dependency vulnerabilities: < 5 high/critical
- Incident response drills: 4 per year

---

## 💰 BUDGET CONSIDERATIONS

### Immediate (< $1,000/month)
- Monitoring tools (Prometheus + Grafana) - Free
- Security scanning in CI (Trivy, npm audit) - Free
- Enhanced logging - Infrastructure cost only

### Short-term ($1,000 - $5,000/month)
- WAF (Cloudflare Pro: $200/month)
- SIEM (Wazuh managed: $500-1000/month)
- Penetration testing ($5,000 one-time)
- Security training ($500/person)

### Long-term ($5,000+/month)
- Advanced SIEM (Splunk: $2,000+/month)
- Bug bounty program ($2,000+/month)
- Security staff augmentation ($5,000+/month)
- Advanced security tools (Snyk, Datadog, etc.)

---

## ✅ IMPLEMENTATION CHECKLIST

### Week 1
- [ ] Set up enhanced monitoring
- [ ] Add npm audit to CI
- [ ] Configure alerting
- [ ] Update dependabot settings
- [ ] Schedule incident response drill

### Week 2
- [ ] Implement network segmentation
- [ ] Evaluate WAF options
- [ ] Start secrets management planning
- [ ] Begin audit logging implementation

### Week 3
- [ ] Deploy WAF
- [ ] Migrate to secrets management
- [ ] Implement application-level rate limiting
- [ ] Review and tighten CSP

### Week 4
- [ ] Complete audit logging
- [ ] Implement PII redaction
- [ ] Conduct GDPR compliance review
- [ ] Schedule penetration testing

### Month 2
- [ ] Conduct penetration testing
- [ ] Implement SIEM
- [ ] Set up IDS/IPS
- [ ] Begin container security scanning

### Month 3
- [ ] Security awareness training
- [ ] Disaster recovery testing
- [ ] Implement service mesh (if applicable)
- [ ] Review and measure security metrics

---

## 📞 SUPPORT & RESOURCES

### Internal Resources
- Security Team: security@your-org.com
- DevOps Team: devops@your-org.com
- Engineering Manager: [Contact]

### External Resources
- OWASP: https://owasp.org
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
- CIS Controls: https://www.cisecurity.org/controls
- SANS Security Resources: https://www.sans.org

### Training Resources
- OWASP Top 10: https://owasp.org/Top10/
- Secure Coding Practices: https://owasp.org/www-project-secure-coding-practices/
- Cloud Security: AWS/Azure/GCP Security Documentation

---

**Document Version**: 1.0  
**Created**: January 10, 2026  
**Next Review**: Monthly  
**Owner**: Security Team

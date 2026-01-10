# RCE Detection & Prevention Quick Reference

**Last Updated**: January 10, 2026  
**Incident**: CVE-2025-55182 React Server Components RCE  

---

## 🚨 QUICK DETECTION COMMANDS

### Check for Active Compromise

```bash
# Check for malicious processes (run on host or in container)
docker exec tea_frontend ps aux | grep -E "wget|curl|nc|mkfifo|bash -i|sh -i" | grep -v grep

# Check for connections to known malicious IP
docker exec tea_frontend netstat -an | grep 91.92.241.10

# Check for suspicious files in /tmp
docker exec tea_frontend ls -latr /tmp/

# Check for recent file modifications
docker exec tea_frontend find / -mtime -1 -type f 2>/dev/null | grep -v node_modules | head -20
```

### Check Logs for Attack Patterns

```bash
# Frontend container logs
docker logs tea_frontend --since 24h | grep -E "wget|curl|nc|mkfifo|chmod"

# Nginx access logs for RSC exploitation
grep "_next/data" /var/log/nginx/access.log | grep -v "200\|304"

# Check for rate limit violations
docker logs tea_nginx | grep "429" | tail -50

# Check for X-User-Email header abuse
grep "X-User-Email" /var/log/nginx/access.log
```

---

## ✅ VERIFY MITIGATIONS APPLIED

### 1. Check Package Versions

```bash
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/frontend
cat package.json | grep -E '"(next|react)":'

# Should show:
# "next": "15.0.3"
# "react": "^18.3.1"
# "react-dom": "^18.3.1"
```

### 2. Verify Docker Security

```bash
# Check running container security settings
docker inspect tea_frontend | jq '.[0].HostConfig | {
  SecurityOpt: .SecurityOpt,
  CapDrop: .CapDrop,
  CapAdd: .CapAdd,
  Memory: .Memory,
  NanoCpus: .NanoCpus,
  PidsLimit: .PidsLimit,
  ReadonlyRootfs: .ReadonlyRootfs
}'

# Expected:
# SecurityOpt: ["no-new-privileges:true"]
# CapDrop: ["ALL"]
# CapAdd: ["NET_BIND_SERVICE"]
# Memory: 1610612736 (1.5GB)
# PidsLimit: 512
```

### 3. Test Rate Limiting

```bash
# Test RSC endpoint rate limiting
for i in {1..15}; do 
  curl -s -w "%{http_code}\n" https://your-domain.com/_next/data/test -o /dev/null
  sleep 0.2
done

# Expected: First ~10 succeed (200/404), then 429 Too Many Requests
```

### 4. Verify Nginx Configuration

```bash
# Check RSC protection is configured
grep -A5 "_next/data" /home/runner/work/team-evaluatie-app/team-evaluatie-app/ops/nginx/site.conf

# Should show rate limiting and request size limits
```

---

## 🛡️ PREVENTION CHECKLIST

### Infrastructure Level

- [x] Next.js downgraded to 15.0.3 (stable)
- [x] React downgraded to 18.3.1 (LTS, no RSC vulnerabilities)
- [x] Docker containers running with no-new-privileges
- [x] All capabilities dropped except NET_BIND_SERVICE
- [x] tmpfs mounted on /tmp with noexec, nosuid
- [x] Resource limits: 1.5GB mem, 0.75 CPU, 512 PIDs
- [x] Nginx RSC rate limiting: 5 req/s
- [x] RSC request body size limit: 512KB
- [x] X-User-Email header stripped by nginx
- [ ] SSL/TLS certificates valid and up to date
- [ ] Firewall rules configured (block outbound to suspicious IPs)
- [ ] Monitoring and alerting configured

### Application Level

- [x] No Server Actions found in codebase
- [x] No child_process/subprocess usage
- [x] dangerouslySetInnerHTML usage reviewed
- [ ] All secrets rotated after incident
- [ ] JWT tokens invalidated
- [ ] User sessions terminated

### Operational Level

- [ ] Incident response plan documented
- [ ] Team trained on security procedures
- [ ] Monitoring dashboards configured
- [ ] Alert escalation paths defined
- [ ] Backup and recovery tested
- [ ] Security audit scheduled

---

## 📊 MONITORING DASHBOARDS

### Key Metrics to Monitor

1. **RSC Endpoint Traffic**
   ```bash
   # Monitor in real-time
   tail -f /var/log/nginx/rsc_access.log
   ```
   - Normal: < 10 requests/minute per IP
   - Suspicious: > 50 requests/minute from single IP
   - Attack: > 100 requests/minute, many 429 errors

2. **Container Resource Usage**
   ```bash
   docker stats --no-stream tea_frontend
   ```
   - Normal: < 40% CPU, < 800MB memory
   - Suspicious: > 60% CPU sustained, > 1.2GB memory
   - Attack: CPU/memory spiking, process count near limit

3. **Outbound Network Traffic**
   ```bash
   docker exec tea_frontend netstat -antp | grep ESTABLISHED
   ```
   - Normal: Connections to backend, redis only
   - Suspicious: Connections to unknown IPs
   - Attack: Multiple connections to same external IP, nc/wget processes

4. **Rate Limit Violations**
   ```bash
   docker logs tea_nginx | grep "429" | tail -20
   ```
   - Normal: < 10 per hour
   - Suspicious: > 50 per hour from same IP
   - Attack: Hundreds of 429s, automated scanning

---

## 🚨 ALERT RULES (Prometheus/Grafana Examples)

```yaml
groups:
  - name: rce_detection
    interval: 30s
    rules:
      
      # High rate of RSC requests
      - alert: HighRSCTraffic
        expr: rate(nginx_http_requests_total{path=~"/_next/data/.*"}[5m]) > 10
        for: 2m
        annotations:
          summary: "Possible RSC exploitation attempt detected"
          description: "High rate of RSC requests: {{ $value }} req/s"
      
      # Frontend CPU spike
      - alert: FrontendCPUSpike
        expr: rate(container_cpu_usage_seconds_total{container="tea_frontend"}[5m]) > 0.6
        for: 5m
        annotations:
          summary: "Frontend container CPU usage high"
          description: "CPU usage: {{ $value }}%"
      
      # Excessive rate limiting
      - alert: ExcessiveRateLimiting
        expr: rate(nginx_http_requests_total{status="429"}[5m]) > 20
        for: 2m
        annotations:
          summary: "High rate of 429 errors - possible attack"
          description: "{{ $value }} rate limit violations per second"
      
      # Suspicious outbound traffic
      - alert: SuspiciousOutboundTraffic
        expr: rate(container_network_transmit_bytes_total{container="tea_frontend"}[1m]) > 5000000
        for: 2m
        annotations:
          summary: "High outbound network traffic from frontend"
          description: "Outbound traffic: {{ $value }} bytes/s"
      
      # Process count approaching limit
      - alert: HighProcessCount
        expr: container_tasks_state{container="tea_frontend",state="running"} > 400
        for: 5m
        annotations:
          summary: "Process count approaching limit in frontend container"
          description: "Running processes: {{ $value }} (limit: 512)"
```

---

## 🔧 REMEDIATION COMMANDS

### Immediate Response

```bash
# Stop compromised container
docker stop tea_frontend

# Capture forensic evidence
mkdir -p /tmp/forensics-$(date +%Y%m%d-%H%M%S)
docker logs tea_frontend > /tmp/forensics-*/frontend.log
docker inspect tea_frontend > /tmp/forensics-*/inspect.json

# Remove container (forces rebuild)
docker rm tea_frontend

# Rebuild with security patches
cd /home/runner/work/team-evaluatie-app/team-evaluatie-app/ops/docker
docker compose -f compose.prod.yml build --no-cache frontend

# Start fresh container
docker compose -f compose.prod.yml up -d frontend
```

### Rotate Secrets

```bash
# Generate new SECRET_KEY
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'

# Update .env.prod
nano /home/runner/work/team-evaluatie-app/team-evaluatie-app/.env.prod

# Restart services with new secrets
docker compose -f compose.prod.yml down
docker compose -f compose.prod.yml up -d
```

### Clear Potential Persistence

```bash
# Check and clear cron jobs
docker exec tea_frontend crontab -r 2>/dev/null || echo "No crontab"

# Clear /tmp
docker exec tea_frontend sh -c "rm -rf /tmp/* /tmp/.*"

# Kill suspicious processes (if any found)
docker exec tea_frontend kill -9 <PID>
```

---

## 📞 ESCALATION

**If you detect active compromise:**

1. **IMMEDIATELY**: Run incident response commands above
2. **NOTIFY**: Security team, DevOps, Management
3. **ISOLATE**: Stop affected containers
4. **PRESERVE**: Capture all logs and forensic evidence
5. **REMEDIATE**: Apply all security patches
6. **MONITOR**: Watch for recurrence for 48-72 hours

**Contacts**:
- Security Team: security@your-org.com
- On-Call DevOps: [Phone/Slack]
- Management: [Contact Info]

---

## 📚 REFERENCES

- Root Cause Analysis: `RCE_ROOT_CAUSE_ANALYSIS.md`
- Incident Response Runbook: `INCIDENT_RESPONSE_RUNBOOK.md`
- Verification Script: `scripts/verify-rce-mitigation.sh`
- CVE-2025-55182: React Server Components RCE

---

**Last Verification**: Run `./scripts/verify-rce-mitigation.sh --check-persistence`  
**Status**: ✅ All mitigations applied  
**Risk Level**: LOW (after mitigations)

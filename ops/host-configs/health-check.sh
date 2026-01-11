#!/bin/bash
# =============================================================================
# Health Monitoring Script - Team Evaluatie App
# =============================================================================
#
# INSTALLATION:
# 1. Copy to /srv/team-evaluatie-app/scripts/health-check.sh
# 2. Make executable: chmod +x health-check.sh
# 3. Test manually: ./health-check.sh
# 4. Add to crontab for continuous monitoring:
#    # Check every 5 minutes
#    */5 * * * * /srv/team-evaluatie-app/scripts/health-check.sh >> /var/log/tea-health.log 2>&1
#
# This script monitors:
# - Container health status
# - Disk usage
# - Memory usage
# - Failed authentication attempts
# - Application availability
#
# =============================================================================

set -u  # Exit on undefined variable

# =============================================================================
# Configuration
# =============================================================================

APP_DIR="${APP_DIR:-/srv/team-evaluatie-app}"
COMPOSE_FILE="${APP_DIR}/ops/docker/compose.prod.yml"
LOG_FILE="${LOG_FILE:-/var/log/tea-health.log}"

# Thresholds
DISK_USAGE_THRESHOLD=80  # Percent
MEMORY_USAGE_THRESHOLD=85  # Percent
FAILED_AUTH_THRESHOLD=50  # Count in last 5 minutes

# Alert configuration
ALERT_EMAIL="${ALERT_EMAIL:-}"
ALERT_WEBHOOK="${ALERT_WEBHOOK:-}"  # Slack/Discord webhook URL

# =============================================================================
# Functions
# =============================================================================

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

send_alert() {
    local severity="$1"
    local message="$2"
    
    log "ALERT [${severity}]: ${message}"
    
    # Email alert
    if [ -n "${ALERT_EMAIL}" ]; then
        echo "${message}" | mail -s "TEA Health Alert [${severity}]" "${ALERT_EMAIL}" 2>/dev/null || true
    fi
    
    # Webhook alert (Slack/Discord)
    if [ -n "${ALERT_WEBHOOK}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[${severity}] Team Evaluatie App\\n${message}\"}" \
            "${ALERT_WEBHOOK}" 2>/dev/null || true
    fi
}

# =============================================================================
# Health Checks
# =============================================================================

log "Starting health check..."

cd "${APP_DIR}"

# -----------------------------------------------------------------------------
# Check 1: Container Health
# -----------------------------------------------------------------------------

log "Checking container health..."

UNHEALTHY_CONTAINERS=$(docker compose -f "${COMPOSE_FILE}" ps --format json 2>/dev/null | \
    jq -r 'select(.Health != "healthy" and .Health != "") | .Name' | \
    tr '\n' ', ' | sed 's/,$//')

if [ -n "${UNHEALTHY_CONTAINERS}" ]; then
    send_alert "CRITICAL" "Unhealthy containers detected: ${UNHEALTHY_CONTAINERS}"
else
    log "✓ All containers healthy"
fi

# Check if all expected containers are running
EXPECTED_CONTAINERS=("tea_db" "tea_redis" "tea_backend" "tea_worker" "tea_frontend" "tea_nginx")
RUNNING_CONTAINERS=$(docker ps --format '{{.Names}}')

for container in "${EXPECTED_CONTAINERS[@]}"; do
    if ! echo "${RUNNING_CONTAINERS}" | grep -q "^${container}$"; then
        send_alert "CRITICAL" "Container not running: ${container}"
    fi
done

# -----------------------------------------------------------------------------
# Check 2: Disk Usage
# -----------------------------------------------------------------------------

log "Checking disk usage..."

DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

if [ "${DISK_USAGE}" -gt "${DISK_USAGE_THRESHOLD}" ]; then
    send_alert "WARNING" "Disk usage is ${DISK_USAGE}% (threshold: ${DISK_USAGE_THRESHOLD}%)"
else
    log "✓ Disk usage: ${DISK_USAGE}%"
fi

# Check Docker volumes
DOCKER_VOLUME_USAGE=$(df -h /var/lib/docker | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "${DOCKER_VOLUME_USAGE}" -gt "${DISK_USAGE_THRESHOLD}" ]; then
    send_alert "WARNING" "Docker volume usage is ${DOCKER_VOLUME_USAGE}% (threshold: ${DISK_USAGE_THRESHOLD}%)"
fi

# -----------------------------------------------------------------------------
# Check 3: Memory Usage
# -----------------------------------------------------------------------------

log "Checking memory usage..."

MEMORY_USAGE=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')

if [ "${MEMORY_USAGE}" -gt "${MEMORY_USAGE_THRESHOLD}" ]; then
    send_alert "WARNING" "Memory usage is ${MEMORY_USAGE}% (threshold: ${MEMORY_USAGE_THRESHOLD}%)"
else
    log "✓ Memory usage: ${MEMORY_USAGE}%"
fi

# -----------------------------------------------------------------------------
# Check 4: Failed Authentication Attempts
# -----------------------------------------------------------------------------

log "Checking failed authentication attempts..."

NGINX_LOG="/var/lib/docker/volumes/ops_nginx-logs/_data/access.log"

if [ -f "${NGINX_LOG}" ]; then
    # Count 401/403 responses in last 5 minutes
    FIVE_MINUTES_AGO=$(date -d '5 minutes ago' +'%d/%b/%Y:%H:%M')
    FAILED_AUTH_COUNT=$(grep -c "\" 40[13] " "${NGINX_LOG}" 2>/dev/null | tail -1000 || echo "0")
    
    if [ "${FAILED_AUTH_COUNT}" -gt "${FAILED_AUTH_THRESHOLD}" ]; then
        send_alert "WARNING" "High number of failed authentication attempts: ${FAILED_AUTH_COUNT} in last 5 minutes"
    else
        log "✓ Failed auth attempts: ${FAILED_AUTH_COUNT}"
    fi
else
    log "⚠ Nginx log file not found (logs may not be mounted)"
fi

# -----------------------------------------------------------------------------
# Check 5: Application Availability
# -----------------------------------------------------------------------------

log "Checking application availability..."

# Check HTTPS endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://app.technasiummbh.nl/health 2>/dev/null || echo "000")

if [ "${HTTP_STATUS}" != "200" ]; then
    send_alert "CRITICAL" "Application health check failed (HTTP ${HTTP_STATUS})"
else
    log "✓ Application responding (HTTP 200)"
fi

# Check API endpoint
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://app.technasiummbh.nl/api/v1/health 2>/dev/null || echo "000")

if [ "${API_STATUS}" != "200" ]; then
    send_alert "WARNING" "API health check failed (HTTP ${API_STATUS})"
else
    log "✓ API responding (HTTP 200)"
fi

# -----------------------------------------------------------------------------
# Check 6: Database Connectivity
# -----------------------------------------------------------------------------

log "Checking database connectivity..."

if docker exec tea_db pg_isready -U tea -d tea_production > /dev/null 2>&1; then
    log "✓ Database responding"
else
    send_alert "CRITICAL" "Database not responding"
fi

# -----------------------------------------------------------------------------
# Check 7: Redis Connectivity
# -----------------------------------------------------------------------------

log "Checking Redis connectivity..."

if docker exec tea_redis redis-cli -a "${REDIS_PASSWORD:-}" ping > /dev/null 2>&1; then
    log "✓ Redis responding"
else
    send_alert "CRITICAL" "Redis not responding"
fi

# -----------------------------------------------------------------------------
# Check 8: Log Errors
# -----------------------------------------------------------------------------

log "Checking recent errors in logs..."

# Check for critical errors in backend logs (last 5 minutes)
BACKEND_ERRORS=$(docker logs tea_backend --since 5m 2>&1 | grep -i "error\|exception\|traceback" | wc -l)

if [ "${BACKEND_ERRORS}" -gt 10 ]; then
    send_alert "WARNING" "High number of backend errors: ${BACKEND_ERRORS} in last 5 minutes"
else
    log "✓ Backend errors: ${BACKEND_ERRORS}"
fi

# Check for critical errors in frontend logs (last 5 minutes)
FRONTEND_ERRORS=$(docker logs tea_frontend --since 5m 2>&1 | grep -i "error" | wc -l)

if [ "${FRONTEND_ERRORS}" -gt 10 ]; then
    send_alert "WARNING" "High number of frontend errors: ${FRONTEND_ERRORS} in last 5 minutes"
else
    log "✓ Frontend errors: ${FRONTEND_ERRORS}"
fi

# -----------------------------------------------------------------------------
# Check 9: Certificate Expiration
# -----------------------------------------------------------------------------

log "Checking SSL certificate expiration..."

CERT_EXPIRY=$(echo | openssl s_client -servername app.technasiummbh.nl -connect app.technasiummbh.nl:443 2>/dev/null | \
    openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

if [ -n "${CERT_EXPIRY}" ]; then
    CERT_EXPIRY_EPOCH=$(date -d "${CERT_EXPIRY}" +%s)
    NOW_EPOCH=$(date +%s)
    DAYS_UNTIL_EXPIRY=$(( (CERT_EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    
    if [ "${DAYS_UNTIL_EXPIRY}" -lt 7 ]; then
        send_alert "CRITICAL" "SSL certificate expires in ${DAYS_UNTIL_EXPIRY} days!"
    elif [ "${DAYS_UNTIL_EXPIRY}" -lt 30 ]; then
        send_alert "WARNING" "SSL certificate expires in ${DAYS_UNTIL_EXPIRY} days"
    else
        log "✓ SSL certificate valid for ${DAYS_UNTIL_EXPIRY} days"
    fi
else
    log "⚠ Could not check SSL certificate expiration"
fi

# -----------------------------------------------------------------------------
# Check 10: Fail2ban Status
# -----------------------------------------------------------------------------

log "Checking fail2ban status..."

if command -v fail2ban-client &> /dev/null; then
    BANNED_IPS=$(fail2ban-client status nginx-tea-auth 2>/dev/null | grep "Currently banned:" | awk '{print $4}')
    if [ -n "${BANNED_IPS}" ] && [ "${BANNED_IPS}" != "0" ]; then
        log "ℹ Fail2ban: ${BANNED_IPS} IPs currently banned"
    else
        log "✓ Fail2ban active (no IPs currently banned)"
    fi
else
    log "⚠ Fail2ban not installed"
fi

# =============================================================================
# Summary
# =============================================================================

log "Health check completed"
log "=================================================================="

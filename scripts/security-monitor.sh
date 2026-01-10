#!/bin/bash

# Security Monitoring Script for Team Evaluatie App
# Monitors for potential security incidents and authentication bypass attempts
# 
# Usage: Run this script via cron every 5 minutes
# */5 * * * * /path/to/security-monitor.sh

set -euo pipefail

LOG_DIR="/var/log/nginx"
ALERT_EMAIL="${SECURITY_ALERT_EMAIL:-security@technasiummbh.nl}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-5}"
TIME_WINDOW="${TIME_WINDOW:-5}" # minutes

echo "=== Security Monitor - $(date) ==="

# Function to send alert email
send_alert() {
    local subject="$1"
    local body="$2"
    echo "$body" | mail -s "$subject" "$ALERT_EMAIL" 2>/dev/null || echo "WARNING: Failed to send email alert"
}

# Check 1: Monitor for X-User-Email header in production
echo "Checking for X-User-Email header in requests..."
XUSER_COUNT=$(grep -i "x-user-email" "$LOG_DIR/access.log" 2>/dev/null | tail -100 | wc -l || echo "0")
if [ "$XUSER_COUNT" -gt 0 ]; then
    echo "ALERT: Found $XUSER_COUNT requests with X-User-Email header!"
    XUSER_DETAILS=$(grep -i "x-user-email" "$LOG_DIR/access.log" 2>/dev/null | tail -10 || echo "No details available")
    send_alert "SECURITY ALERT: X-User-Email Header Detected" \
        "Detected $XUSER_COUNT requests with X-User-Email header in the last $TIME_WINDOW minutes.
        
This may indicate an authentication bypass attempt!

Last 10 occurrences:
$XUSER_DETAILS

Action Required:
1. Verify Nginx configuration strips X-User-Email header
2. Check backend logs for authentication bypass attempts
3. Investigate source IPs
4. Review incident response plan"
fi

# Check 2: Monitor for suspicious user agents (automated tools)
echo "Checking for suspicious user agents..."
SUSPICIOUS_UA_COUNT=$(grep -iE "(wget|curl|python-requests|nmap|masscan|sqlmap|nikto|acunetix)" "$LOG_DIR/access.log" 2>/dev/null | \
    awk -v time_window="$TIME_WINDOW" '
        BEGIN { count=0 }
        {
            # Parse nginx timestamp [10/Jan/2026:14:32:15 +0000]
            # For simplicity, count all in the log (assuming log rotation handles time window)
            count++
        }
        END { print count }
    ' || echo "0")

if [ "$SUSPICIOUS_UA_COUNT" -gt "$ALERT_THRESHOLD" ]; then
    echo "ALERT: Found $SUSPICIOUS_UA_COUNT requests from suspicious user agents!"
    SUSPICIOUS_UA_DETAILS=$(grep -iE "(wget|curl|python-requests|nmap|masscan|sqlmap|nikto|acunetix)" "$LOG_DIR/access.log" 2>/dev/null | tail -10 || echo "No details")
    send_alert "SECURITY ALERT: Suspicious User Agents Detected" \
        "Detected $SUSPICIOUS_UA_COUNT requests from automated tools/scanners.

Last 10 occurrences:
$SUSPICIOUS_UA_DETAILS

These patterns may indicate:
- Automated vulnerability scanning
- Bot traffic
- Potential attack reconnaissance

Action Required:
1. Review IP addresses for blocking
2. Verify WAF rules are active
3. Check rate limiting effectiveness"
fi

# Check 3: Monitor for high rate of 401/403 errors (brute force attempts)
echo "Checking for authentication failures..."
AUTH_FAIL_COUNT=$(grep -E " (401|403) " "$LOG_DIR/access.log" 2>/dev/null | tail -100 | wc -l || echo "0")
if [ "$AUTH_FAIL_COUNT" -gt 50 ]; then
    echo "ALERT: High rate of authentication failures: $AUTH_FAIL_COUNT"
    # Get top IPs with auth failures
    TOP_IPS=$(grep -E " (401|403) " "$LOG_DIR/access.log" 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head -5 || echo "No details")
    send_alert "SECURITY ALERT: High Rate of Authentication Failures" \
        "Detected $AUTH_FAIL_COUNT authentication failures (401/403 responses).

Top source IPs:
$TOP_IPS

This may indicate:
- Brute force attack
- Credential stuffing
- Misconfigured client

Action Required:
1. Check if rate limiting is working
2. Consider blocking source IPs
3. Review backend authentication logs"
fi

# Check 4: Monitor for requests to sensitive endpoints
echo "Checking access to sensitive endpoints..."
ADMIN_ACCESS=$(grep -E "/(admin|docs|redoc)" "$LOG_DIR/access.log" 2>/dev/null | tail -50 | wc -l || echo "0")
if [ "$ADMIN_ACCESS" -gt 10 ]; then
    echo "WARNING: $ADMIN_ACCESS requests to admin/documentation endpoints"
    ADMIN_DETAILS=$(grep -E "/(admin|docs|redoc)" "$LOG_DIR/access.log" 2>/dev/null | tail -5 || echo "No details")
    send_alert "Security Notice: Admin Endpoint Access" \
        "Detected $ADMIN_ACCESS requests to sensitive endpoints (/admin, /docs, /redoc).

Last 5 requests:
$ADMIN_DETAILS

Recommendation:
- Verify these endpoints are properly restricted
- Consider IP whitelisting for /docs and /redoc in production"
fi

# Check 5: Monitor for unusual request patterns
echo "Checking for unusual request rates..."
# Count requests in last minute
RECENT_REQUESTS=$(tail -100 "$LOG_DIR/access.log" 2>/dev/null | wc -l || echo "0")
if [ "$RECENT_REQUESTS" -gt 500 ]; then
    echo "WARNING: High request rate: $RECENT_REQUESTS requests in last sample"
    TOP_PATHS=$(tail -100 "$LOG_DIR/access.log" 2>/dev/null | awk '{print $7}' | sort | uniq -c | sort -rn | head -5 || echo "No details")
    send_alert "Security Notice: High Request Rate" \
        "Detected high request rate: $RECENT_REQUESTS requests.

Top requested paths:
$TOP_PATHS

This may indicate:
- DDoS attack
- Legitimate traffic spike
- Misconfigured client polling

Action Required:
1. Verify rate limiting is active
2. Check application performance
3. Consider activating DDoS protection"
fi

# Check 6: Monitor Docker container health and unexpected processes
echo "Checking container security..."
if command -v docker &> /dev/null; then
    # Check for unexpected processes in frontend container
    FRONTEND_PROCESSES=$(docker exec tea_frontend ps aux 2>/dev/null | grep -vE "(node|npm|ps|grep)" | wc -l || echo "0")
    if [ "$FRONTEND_PROCESSES" -gt 5 ]; then
        echo "WARNING: Unexpected processes in frontend container"
        PROCESS_LIST=$(docker exec tea_frontend ps aux 2>/dev/null | grep -vE "(node|npm)" || echo "Unable to list processes")
        send_alert "Security Alert: Unexpected Processes in Frontend Container" \
            "Detected unexpected processes running in the frontend container.

Process list:
$PROCESS_LIST

This may indicate:
- Container compromise
- RCE exploitation
- Malicious backdoor

IMMEDIATE ACTION REQUIRED:
1. Review container logs
2. Check for persistence mechanisms
3. Consider redeploying container from clean image
4. Investigate root cause"
    fi
    
    # Check for network connections from frontend (should only connect to backend)
    SUSPICIOUS_CONNECTIONS=$(docker exec tea_frontend netstat -tupn 2>/dev/null | grep -v "127.0.0.1\|backend:8000" | grep ESTABLISHED || echo "")
    if [ -n "$SUSPICIOUS_CONNECTIONS" ]; then
        echo "WARNING: Suspicious network connections from frontend container"
        send_alert "Security Alert: Suspicious Network Connections" \
            "Detected unexpected network connections from frontend container:

$SUSPICIOUS_CONNECTIONS

This may indicate:
- Data exfiltration
- Command and control communication
- Lateral movement attempt

IMMEDIATE ACTION REQUIRED:
1. Isolate container from network
2. Review container logs
3. Analyze destination IPs
4. Investigate for compromise"
    fi
fi

echo "=== Security Monitor Complete - $(date) ==="
echo ""

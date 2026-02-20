# Cron Jobs Configuration

Example crontab configuration for production maintenance tasks.

## Installation

```bash
# Edit crontab for deploy user
crontab -e

# Or for root (for system tasks)
sudo crontab -e
```

## Recommended Cron Jobs

```cron
# =============================================================================
# Team Evaluatie App - Production Cron Jobs
# =============================================================================

# Set environment
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=your-email@example.com

# Application directory
APP_DIR=/opt/team-evaluatie-app

# =============================================================================
# Daily Tasks
# =============================================================================

# Database backup - Every day at 2:00 AM
0 2 * * * cd $APP_DIR && bash scripts/backup_db.sh >> /var/log/tea-backup.log 2>&1

# Clean old Docker resources - Every day at 3:00 AM
0 3 * * * docker system prune -f >> /var/log/tea-docker-cleanup.log 2>&1

# SSL certificate renewal check - Every day at 3:30 AM
30 3 * * * cd $APP_DIR && docker compose -f ops/docker/compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot && docker compose -f ops/docker/compose.prod.yml exec nginx nginx -s reload >> /var/log/tea-ssl-renew.log 2>&1

# =============================================================================
# Weekly Tasks
# =============================================================================

# Security scan - Every Sunday at 4:00 AM
0 4 * * 0 cd $APP_DIR && docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image tea-backend:latest > /var/log/tea-security-scan.log 2>&1

# Database vacuum and analyze - Every Sunday at 5:00 AM
0 5 * * 0 docker exec tea_db psql -U tea -d tea_production -c "VACUUM ANALYZE;" >> /var/log/tea-db-maintenance.log 2>&1

# Backup rotation - Every Monday at 6:00 AM
0 6 * * 1 find /var/backups/tea -name "*.sql.gz" -mtime +14 -delete >> /var/log/tea-backup-rotation.log 2>&1

# =============================================================================
# Monthly Tasks
# =============================================================================

# Log rotation - First day of month at 1:00 AM
0 1 1 * * find /var/log/tea-*.log -mtime +30 -delete 2>&1

# Disk usage report - First day of month at 7:00 AM
0 7 1 * * df -h > /var/log/tea-disk-usage-$(date +\%Y\%m).log && docker system df >> /var/log/tea-disk-usage-$(date +\%Y\%m).log 2>&1

# =============================================================================
# Health Checks (Optional - use external monitoring instead)
# =============================================================================

# Check service health every 5 minutes (optional if no external monitoring)
# */5 * * * * curl -f https://yourdomain.com/health || echo "Site down at $(date)" >> /var/log/tea-healthcheck.log 2>&1

# =============================================================================
# System Updates (Optional - use unattended-upgrades instead)
# =============================================================================

# Update system packages - Every Sunday at 1:00 AM
# 0 1 * * 0 apt update && apt upgrade -y >> /var/log/system-updates.log 2>&1

# =============================================================================
# Notes:
# - Ensure log directory exists: mkdir -p /var/log && touch /var/log/tea-*.log
# - Test commands manually before adding to cron
# - Monitor log files regularly
# - Adjust times to avoid overlapping jobs
# - Use external monitoring service for uptime checks (UptimeRobot, Pingdom)
# =============================================================================
```

## Testing Cron Jobs

```bash
# Test backup script
bash /opt/team-evaluatie-app/scripts/backup_db.sh

# Test Docker cleanup
docker system prune -f

# Test SSL renewal (dry run)
cd /opt/team-evaluatie-app
docker compose -f ops/docker/compose.prod.yml run --rm certbot renew --dry-run

# View cron logs
tail -f /var/log/tea-backup.log
tail -f /var/log/tea-ssl-renew.log
```

## Log Rotation

Create logrotate config for application logs:

```bash
# Create logrotate config
sudo vim /etc/logrotate.d/team-evaluatie-app
```

Add:

```
/var/log/tea-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 deploy deploy
    sharedscripts
}
```

## Monitoring Cron Job Execution

```bash
# View cron logs
sudo tail -f /var/log/syslog | grep CRON

# Check last execution time
ls -lt /var/log/tea-*.log

# Email notifications
# Ensure MAILTO is set in crontab
# Install mail utils: sudo apt install mailutils
```

## Emergency: Disable All Cron Jobs

```bash
# Comment out all jobs temporarily
crontab -e
# Add # before each line

# Or remove crontab entirely (backup first!)
crontab -l > crontab-backup.txt
crontab -r
```

## Restore Cron Jobs

```bash
# Restore from backup
crontab crontab-backup.txt
```

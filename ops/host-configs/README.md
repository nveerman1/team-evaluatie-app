# Host-Level Configuration Files

This directory contains configuration files and scripts for host-level hardening and operations of the Team Evaluatie App VPS deployment.

## Contents

### Security & Access Control

#### `ufw-firewall-setup.sh`
UFW firewall configuration reference for staging and production modes.
- **Purpose:** Configure iptables firewall rules via UFW
- **Modes:** Staging (restricted access) and Production (public access)
- **Usage:** Review and execute commands manually (not a runnable script)

#### `fail2ban-nginx.conf`
Fail2ban jail configuration for nginx-based intrusion prevention.
- **Purpose:** Automatically ban IPs showing malicious behavior
- **Jails:** 
  - `nginx-tea-auth`: Failed authentication attempts
  - `nginx-tea-404`: Excessive 404 scanning
  - `nginx-tea-exploits`: Common exploit patterns
  - `nginx-tea-dos`: DoS prevention
- **Installation:** Copy to `/etc/fail2ban/jail.d/nginx-tea.conf`

#### `fail2ban-filter-*.conf`
Fail2ban filter definitions for detecting malicious patterns.
- **Installation:** Copy to `/etc/fail2ban/filter.d/`
- **Files:**
  - `fail2ban-filter-auth.conf` → `/etc/fail2ban/filter.d/nginx-tea-auth.conf`
  - `fail2ban-filter-404.conf` → `/etc/fail2ban/filter.d/nginx-tea-404.conf`
  - `fail2ban-filter-exploits.conf` → `/etc/fail2ban/filter.d/nginx-tea-exploits.conf`
  - `fail2ban-filter-dos.conf` → `/etc/fail2ban/filter.d/nginx-tea-dos.conf`

### Operations & Maintenance

#### `logrotate-nginx.conf`
Log rotation configuration for nginx logs.
- **Purpose:** Prevent disk space exhaustion from log files
- **Policy:** Daily rotation, 14-day retention, compression
- **Installation:** Copy to `/etc/logrotate.d/nginx-tea`

#### `backup-postgres.sh`
Automated PostgreSQL backup script.
- **Purpose:** Create compressed database backups with metadata
- **Features:**
  - pg_dump with compression
  - Integrity verification
  - Retention policy (30 days default)
  - Optional offsite sync
  - Email notifications
- **Installation:**
  1. Copy to `/srv/team-evaluatie-app/scripts/backup-postgres.sh`
  2. Make executable: `chmod +x backup-postgres.sh`
  3. Configure cron: `0 2 * * * /srv/team-evaluatie-app/scripts/backup-postgres.sh`

#### `health-check.sh`
Comprehensive health monitoring script.
- **Purpose:** Monitor application health and send alerts
- **Monitors:**
  - Container health status
  - Disk and memory usage
  - Failed authentication attempts
  - Application availability
  - Database/Redis connectivity
  - SSL certificate expiration
  - Fail2ban status
- **Installation:**
  1. Copy to `/srv/team-evaluatie-app/scripts/health-check.sh`
  2. Make executable: `chmod +x health-check.sh`
  3. Configure cron: `*/5 * * * * /srv/team-evaluatie-app/scripts/health-check.sh`

### Documentation

#### `DEPLOYMENT_GUIDE.md`
Step-by-step guide for deploying Production Hardening v2.
- **Contents:**
  - Pre-deployment preparation
  - Repository changes application
  - Host-level security configuration
  - Verification procedures
  - Monitoring setup
  - Rollback procedures

#### `VERIFICATION_CHECKLIST.md`
Detailed verification checklist with exact commands and expected outputs.
- **Contents:**
  - Container configuration tests
  - Nginx configuration tests
  - Security headers verification
  - Rate limiting tests
  - Access control tests
  - Host-level security verification
  - Application functionality tests

## Installation Overview

### Prerequisites
- Ubuntu/Debian VPS with root/sudo access
- Docker and Docker Compose installed
- Application deployed at `/srv/team-evaluatie-app`
- Nginx logs mounted to Docker volume `ops_nginx-logs`

### Quick Start

1. **Review Documentation**
   ```bash
   cat DEPLOYMENT_GUIDE.md
   cat VERIFICATION_CHECKLIST.md
   ```

2. **Configure Firewall (Choose Mode)**
   ```bash
   # Staging mode (restricted access)
   bash ufw-firewall-setup.sh  # Review commands, execute manually
   
   # OR Production mode (public access)
   # See DEPLOYMENT_GUIDE.md Phase 3.4
   ```

3. **Install Fail2ban**
   ```bash
   sudo apt-get install -y fail2ban
   sudo cp fail2ban-nginx.conf /etc/fail2ban/jail.d/nginx-tea.conf
   sudo cp fail2ban-filter-*.conf /etc/fail2ban/filter.d/
   sudo systemctl restart fail2ban
   ```

4. **Configure Log Rotation**
   ```bash
   sudo cp logrotate-nginx.conf /etc/logrotate.d/nginx-tea
   sudo logrotate -d /etc/logrotate.d/nginx-tea  # Test
   ```

5. **Setup Backups**
   ```bash
   mkdir -p /srv/team-evaluatie-app/scripts
   cp backup-postgres.sh /srv/team-evaluatie-app/scripts/
   chmod +x /srv/team-evaluatie-app/scripts/backup-postgres.sh
   
   # Test backup
   /srv/team-evaluatie-app/scripts/backup-postgres.sh
   
   # Add to crontab
   (crontab -l 2>/dev/null; echo "0 2 * * * /srv/team-evaluatie-app/scripts/backup-postgres.sh >> /var/log/tea-backup.log 2>&1") | crontab -
   ```

6. **Setup Health Monitoring**
   ```bash
   cp health-check.sh /srv/team-evaluatie-app/scripts/
   chmod +x /srv/team-evaluatie-app/scripts/health-check.sh
   
   # Test health check
   /srv/team-evaluatie-app/scripts/health-check.sh
   
   # Add to crontab
   (crontab -l 2>/dev/null; echo "*/5 * * * * /srv/team-evaluatie-app/scripts/health-check.sh >> /var/log/tea-health.log 2>&1") | crontab -
   ```

7. **Verify Installation**
   ```bash
   # Follow VERIFICATION_CHECKLIST.md
   sudo ufw status verbose
   sudo fail2ban-client status
   sudo systemctl status fail2ban
   ls -la /srv/team-evaluatie-app/scripts/
   crontab -l
   ```

## Configuration

### Environment Variables

Scripts support these environment variables:

#### backup-postgres.sh
```bash
APP_DIR=/srv/team-evaluatie-app
BACKUP_BASE_DIR=/srv/team-evaluatie-app/backups
BACKUP_RETENTION_DAYS=30
OFFSITE_BACKUP_ENABLED=false
OFFSITE_BACKUP_DIR=/mnt/onedrive/tea-backups
NOTIFY_EMAIL=admin@example.com
```

#### health-check.sh
```bash
APP_DIR=/srv/team-evaluatie-app
DISK_USAGE_THRESHOLD=80
MEMORY_USAGE_THRESHOLD=85
FAILED_AUTH_THRESHOLD=50
ALERT_EMAIL=admin@example.com
ALERT_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### Customization

#### Adjust Fail2ban Thresholds
Edit `/etc/fail2ban/jail.d/nginx-tea.conf`:
```ini
[nginx-tea-auth]
maxretry = 5      # Number of failures before ban
findtime = 300    # Time window in seconds
bantime = 3600    # Ban duration in seconds
```

#### Adjust UFW Rules
```bash
# Add additional allowed IPs
sudo ufw allow from YOUR_IP to any port 443 proto tcp

# Remove rules
sudo ufw status numbered
sudo ufw delete [number]
```

#### Adjust Log Retention
Edit `/etc/logrotate.d/nginx-tea`:
```
rotate 14  # Change to desired number of days
```

## Monitoring

### Check Fail2ban Status
```bash
sudo fail2ban-client status
sudo fail2ban-client status nginx-tea-auth
```

### View Banned IPs
```bash
sudo fail2ban-client status nginx-tea-auth | grep "Banned IP"
```

### Unban an IP
```bash
sudo fail2ban-client set nginx-tea-auth unbanip IP_ADDRESS
```

### Check Firewall
```bash
sudo ufw status verbose
sudo iptables -L -n -v
```

### Check Logs
```bash
tail -f /var/log/tea-health.log
tail -f /var/log/tea-backup.log
tail -f /var/log/fail2ban.log
```

### Check Backups
```bash
ls -lah /srv/team-evaluatie-app/backups/postgres/
cat /srv/team-evaluatie-app/backups/postgres/RECOVERY_INSTRUCTIONS.txt
```

## Troubleshooting

### Fail2ban Not Banning
1. Check fail2ban is running: `sudo systemctl status fail2ban`
2. Check logs: `sudo tail -f /var/log/fail2ban.log`
3. Verify log path in jail config matches actual log location
4. Test filter: `sudo fail2ban-regex /var/lib/docker/volumes/ops_nginx-logs/_data/access.log /etc/fail2ban/filter.d/nginx-tea-auth.conf`

### UFW Locked Out
1. Access VPS console (not SSH)
2. Disable UFW: `sudo ufw disable`
3. Reconfigure rules carefully
4. Re-enable: `sudo ufw enable`

### Backups Failing
1. Check disk space: `df -h`
2. Check Docker container is running: `docker ps | grep tea_db`
3. Verify .env.prod exists: `ls -la /srv/team-evaluatie-app/.env.prod`
4. Check script logs: `tail -f /var/log/tea-backup.log`

### Health Check Alerts
1. Review specific alert in logs: `grep "ALERT" /var/log/tea-health.log`
2. Check container status: `docker ps`
3. Check application logs: `docker logs tea_backend --tail 100`
4. Verify services: `curl https://app.technasiummbh.nl/health`

## Security Best Practices

1. **Regular Updates**
   - Update system packages weekly: `sudo apt-get update && sudo apt-get upgrade`
   - Update Docker images monthly
   - Review security advisories

2. **Access Control**
   - Use SSH keys, disable password auth
   - Restrict SSH to known IPs
   - Review UFW rules monthly

3. **Monitoring**
   - Check health logs daily
   - Review fail2ban bans weekly
   - Monitor disk usage

4. **Backups**
   - Test backup restoration quarterly
   - Verify offsite backups work
   - Keep backups encrypted

5. **Incident Response**
   - Document incidents
   - Review fail2ban logs for patterns
   - Update rules based on threats

## Support

For issues or questions:
- Review `DEPLOYMENT_GUIDE.md` for detailed procedures
- Check `VERIFICATION_CHECKLIST.md` for test commands
- Open GitHub issue: https://github.com/nveerman1/team-evaluatie-app/issues

## License

These configuration files are part of the Team Evaluatie App project.
See main repository LICENSE for details.

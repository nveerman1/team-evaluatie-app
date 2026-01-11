#!/bin/bash
# =============================================================================
# PostgreSQL Backup Script - Team Evaluatie App
# =============================================================================
#
# INSTALLATION:
# 1. Copy to /srv/team-evaluatie-app/scripts/backup-postgres.sh
# 2. Make executable: chmod +x backup-postgres.sh
# 3. Set environment variables or edit the config section below
# 4. Test manually: ./backup-postgres.sh
# 5. Add to crontab for automated backups:
#    # Daily backup at 2 AM
#    0 2 * * * /srv/team-evaluatie-app/scripts/backup-postgres.sh >> /var/log/tea-backup.log 2>&1
#
# REQUIREMENTS:
# - Docker and docker compose installed
# - Working directory: /srv/team-evaluatie-app
# - .env.prod file with POSTGRES_* variables
# - Backup destination accessible (local, NFS, or cloud mount)
#
# =============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# =============================================================================
# Configuration
# =============================================================================

# App directory
APP_DIR="${APP_DIR:-/srv/team-evaluatie-app}"
COMPOSE_FILE="${APP_DIR}/ops/docker/compose.prod.yml"

# Backup configuration
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-${APP_DIR}/backups}"
BACKUP_LOCAL_DIR="${BACKUP_BASE_DIR}/postgres"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Database configuration (loaded from .env.prod)
ENV_FILE="${APP_DIR}/.env.prod"

# Offsite backup (optional)
# Set to "true" to enable offsite sync (OneDrive, S3, etc.)
OFFSITE_BACKUP_ENABLED="${OFFSITE_BACKUP_ENABLED:-false}"
OFFSITE_BACKUP_DIR="${OFFSITE_BACKUP_DIR:-}"  # Set to OneDrive/S3 mount point

# Notification (optional)
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"  # Email for backup notifications

# =============================================================================
# Load environment variables
# =============================================================================

if [ ! -f "${ENV_FILE}" ]; then
    echo "ERROR: Environment file not found: ${ENV_FILE}"
    exit 1
fi

# Source environment variables (safely)
set -a
source "${ENV_FILE}"
set +a

# =============================================================================
# Create backup directory
# =============================================================================

mkdir -p "${BACKUP_LOCAL_DIR}"

# =============================================================================
# Generate backup filename with timestamp
# =============================================================================

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="tea_production_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_LOCAL_DIR}/${BACKUP_FILE}"

echo "=================================================================="
echo "PostgreSQL Backup - Team Evaluatie App"
echo "=================================================================="
echo "Timestamp: $(date)"
echo "Database: ${POSTGRES_DB}"
echo "Backup file: ${BACKUP_FILE}"
echo "=================================================================="
echo ""

# =============================================================================
# Perform backup using pg_dump inside container
# =============================================================================

echo "[1/5] Creating database backup..."

docker exec tea_db pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -F c \
    -b \
    -v \
    | gzip > "${BACKUP_PATH}"

# Check if backup was created successfully
if [ ! -f "${BACKUP_PATH}" ]; then
    echo "ERROR: Backup file was not created!"
    exit 1
fi

BACKUP_SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
echo "✓ Backup created: ${BACKUP_SIZE}"
echo ""

# =============================================================================
# Create backup metadata file
# =============================================================================

echo "[2/5] Creating backup metadata..."

METADATA_FILE="${BACKUP_PATH}.info"
cat > "${METADATA_FILE}" << EOF
Backup Date: $(date -Iseconds)
Database: ${POSTGRES_DB}
User: ${POSTGRES_USER}
Backup File: ${BACKUP_FILE}
File Size: ${BACKUP_SIZE}
Backup Type: pg_dump (custom format, compressed)
Docker Container: tea_db
EOF

echo "✓ Metadata file created"
echo ""

# =============================================================================
# Verify backup integrity
# =============================================================================

echo "[3/5] Verifying backup integrity..."

# Check if file is a valid gzip
if ! gunzip -t "${BACKUP_PATH}" 2>/dev/null; then
    echo "ERROR: Backup file is corrupted (gzip test failed)!"
    exit 1
fi

echo "✓ Backup file integrity verified"
echo ""

# =============================================================================
# Sync to offsite backup location (optional)
# =============================================================================

if [ "${OFFSITE_BACKUP_ENABLED}" = "true" ] && [ -n "${OFFSITE_BACKUP_DIR}" ]; then
    echo "[4/5] Syncing to offsite backup location..."
    
    if [ ! -d "${OFFSITE_BACKUP_DIR}" ]; then
        echo "WARNING: Offsite backup directory does not exist: ${OFFSITE_BACKUP_DIR}"
        echo "Skipping offsite backup..."
    else
        rsync -avz --progress \
            "${BACKUP_PATH}" \
            "${METADATA_FILE}" \
            "${OFFSITE_BACKUP_DIR}/"
        
        echo "✓ Offsite backup completed"
    fi
    echo ""
else
    echo "[4/5] Offsite backup disabled (skipping)"
    echo ""
fi

# =============================================================================
# Cleanup old backups (retention policy)
# =============================================================================

echo "[5/5] Cleaning up old backups (retention: ${BACKUP_RETENTION_DAYS} days)..."

# Delete local backups older than retention period
find "${BACKUP_LOCAL_DIR}" -name "tea_production_*.sql.gz" -mtime +${BACKUP_RETENTION_DAYS} -delete
find "${BACKUP_LOCAL_DIR}" -name "tea_production_*.sql.gz.info" -mtime +${BACKUP_RETENTION_DAYS} -delete

REMAINING_BACKUPS=$(find "${BACKUP_LOCAL_DIR}" -name "tea_production_*.sql.gz" | wc -l)
echo "✓ Cleanup completed (${REMAINING_BACKUPS} backups remaining)"
echo ""

# =============================================================================
# Send notification (optional)
# =============================================================================

if [ -n "${NOTIFY_EMAIL}" ]; then
    echo "Sending notification to ${NOTIFY_EMAIL}..."
    
    echo "PostgreSQL backup completed successfully.

Backup Details:
- Timestamp: $(date)
- Database: ${POSTGRES_DB}
- File: ${BACKUP_FILE}
- Size: ${BACKUP_SIZE}
- Location: ${BACKUP_PATH}
- Remaining backups: ${REMAINING_BACKUPS}
" | mail -s "TEA Backup Success - $(date +%Y-%m-%d)" "${NOTIFY_EMAIL}" || true
fi

# =============================================================================
# Summary
# =============================================================================

echo "=================================================================="
echo "Backup completed successfully!"
echo "=================================================================="
echo "Backup file: ${BACKUP_PATH}"
echo "Size: ${BACKUP_SIZE}"
echo "Retention: ${BACKUP_RETENTION_DAYS} days"
echo "Remaining backups: ${REMAINING_BACKUPS}"
echo "=================================================================="
echo ""

# =============================================================================
# Recovery Instructions (for reference)
# =============================================================================

cat << 'EOF' > "${BACKUP_LOCAL_DIR}/RECOVERY_INSTRUCTIONS.txt"
PostgreSQL Backup Recovery Instructions
========================================

To restore from a backup:

1. Stop the application:
   cd /srv/team-evaluatie-app
   docker compose -f ops/docker/compose.prod.yml down

2. Restore the database:
   # Copy backup into container
   docker cp backups/postgres/tea_production_YYYYMMDD_HHMMSS.sql.gz tea_db:/tmp/backup.sql.gz
   
   # Restore database
   docker exec tea_db bash -c "gunzip < /tmp/backup.sql.gz | pg_restore -U tea -d tea_production -c -v"
   
   # Alternative: Drop and recreate database first
   docker exec tea_db psql -U tea -c "DROP DATABASE tea_production;"
   docker exec tea_db psql -U tea -c "CREATE DATABASE tea_production;"
   docker exec tea_db bash -c "gunzip < /tmp/backup.sql.gz | pg_restore -U tea -d tea_production -v"

3. Restart the application:
   docker compose -f ops/docker/compose.prod.yml up -d

4. Verify the application is working:
   docker compose -f ops/docker/compose.prod.yml logs -f

EOF

exit 0

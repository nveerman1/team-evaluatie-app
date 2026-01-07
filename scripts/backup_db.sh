#!/bin/bash
# =============================================================================
# Database Backup Script
# =============================================================================
# 
# Automated PostgreSQL backup script with rotation.
# Creates compressed SQL dumps and manages retention.
#
# Usage:
#   ./scripts/backup_db.sh                 # Standard backup
#   ./scripts/backup_db.sh --pre-migration # Pre-migration backup
#   ./scripts/backup_db.sh --quick         # Quick backup (no compression)
#
# Setup:
#   1. Configure environment variables below or use .env.prod
#   2. Add to crontab for automated backups:
#      # Daily backup at 2:00 AM
#      0 2 * * * /path/to/scripts/backup_db.sh >> /var/log/tea-backup.log 2>&1
#
# =============================================================================

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tea}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER_NAME="${CONTAINER_NAME:-tea_db}"

# Database configuration (from environment or defaults)
DB_USER="${POSTGRES_USER:-tea}"
DB_NAME="${POSTGRES_DB:-tea_production}"

# Timestamp for backup file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_DIR=$(date +"%Y-%m")

# Backup filename
BACKUP_FILE="tea_backup_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${DATE_DIR}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Create backup directory structure
create_backup_dir() {
    if [ ! -d "$BACKUP_PATH" ]; then
        mkdir -p "$BACKUP_PATH"
        log_info "Created backup directory: $BACKUP_PATH"
    fi
}

# Check if database container is running
check_container() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "Database container '${CONTAINER_NAME}' is not running"
        exit 1
    fi
    log_info "Database container is running"
}

# Perform database backup
backup_database() {
    local mode="${1:-standard}"
    
    log_info "Starting database backup..."
    log_info "Database: ${DB_NAME}"
    log_info "Backup path: ${BACKUP_PATH}/${BACKUP_FILE}"
    
    # Run pg_dump in container
    if docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" \
        --clean --if-exists --create --format=plain \
        > "${BACKUP_PATH}/${BACKUP_FILE}"; then
        
        log_info "Database dump created successfully"
        
        # Compress backup (skip for quick mode)
        if [ "$mode" != "quick" ]; then
            log_info "Compressing backup..."
            gzip -f "${BACKUP_PATH}/${BACKUP_FILE}"
            BACKUP_FILE="${BACKUP_FILE}.gz"
            log_info "Backup compressed: ${BACKUP_FILE}"
        fi
        
        # Show backup size
        local size=$(du -h "${BACKUP_PATH}/${BACKUP_FILE}" | cut -f1)
        log_info "Backup size: ${size}"
        
        # Create 'latest' symlink
        ln -sf "${BACKUP_PATH}/${BACKUP_FILE}" "${BACKUP_DIR}/latest.sql.gz"
        
        return 0
    else
        log_error "Backup failed!"
        return 1
    fi
}

# Verify backup integrity
verify_backup() {
    local backup="${BACKUP_PATH}/${BACKUP_FILE}"
    
    log_info "Verifying backup integrity..."
    
    if [[ "$backup" == *.gz ]]; then
        if gzip -t "$backup" 2>/dev/null; then
            log_info "Backup integrity: OK"
            return 0
        else
            log_error "Backup integrity check failed!"
            return 1
        fi
    else
        if [ -s "$backup" ]; then
            log_info "Backup integrity: OK"
            return 0
        else
            log_error "Backup file is empty or missing!"
            return 1
        fi
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    local deleted_count=$(find "$BACKUP_DIR" -type f -name "tea_backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
    
    if [ "$deleted_count" -gt 0 ]; then
        log_info "Deleted ${deleted_count} old backup(s)"
    else
        log_info "No old backups to delete"
    fi
    
    # Clean up empty date directories
    find "$BACKUP_DIR" -type d -empty -delete 2>/dev/null || true
}

# List recent backups
list_backups() {
    log_info "Recent backups:"
    echo ""
    find "$BACKUP_DIR" -type f -name "tea_backup_*.sql.gz" -printf "%T@ %p\n" | \
        sort -rn | \
        head -n 10 | \
        while read timestamp path; do
            size=$(du -h "$path" | cut -f1)
            date=$(date -d "@${timestamp}" '+%Y-%m-%d %H:%M:%S')
            echo "  $date - $(basename $path) - $size"
        done
    echo ""
}

# Upload to cloud storage (optional)
upload_to_cloud() {
    # Implement if using cloud storage (S3, Azure Blob, etc.)
    # Example for S3:
    # if [ -n "$AWS_S3_BUCKET" ]; then
    #     log_info "Uploading to S3..."
    #     aws s3 cp "${BACKUP_PATH}/${BACKUP_FILE}" "s3://${AWS_S3_BUCKET}/backups/"
    # fi
    
    log_info "Cloud upload not configured (implement if needed)"
}

# Main script
main() {
    log_info "=== Database Backup Tool ==="
    echo ""
    
    # Parse arguments
    MODE="${1:-standard}"
    
    case "$MODE" in
        --quick)
            check_container
            create_backup_dir
            backup_database "quick" || exit 1
            verify_backup || exit 1
            list_backups
            ;;
        
        --pre-migration)
            log_warn "Creating pre-migration backup..."
            check_container
            create_backup_dir
            BACKUP_FILE="tea_backup_pre_migration_${TIMESTAMP}.sql"
            backup_database "standard" || exit 1
            verify_backup || exit 1
            log_info "Pre-migration backup complete!"
            ;;
        
        --list)
            list_backups
            ;;
        
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  (none)           Create standard compressed backup"
            echo "  --quick          Create uncompressed backup (faster)"
            echo "  --pre-migration  Create backup before migration"
            echo "  --list           List recent backups"
            echo "  --help           Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  BACKUP_DIR       Backup directory (default: /var/backups/tea)"
            echo "  RETENTION_DAYS   Days to keep backups (default: 14)"
            echo "  CONTAINER_NAME   Database container name (default: tea_db)"
            exit 0
            ;;
        
        *)
            check_container
            create_backup_dir
            backup_database "standard" || exit 1
            verify_backup || exit 1
            cleanup_old_backups
            list_backups
            # upload_to_cloud  # Uncomment if cloud upload is configured
            ;;
    esac
    
    log_info "Backup completed successfully!"
}

# Run main function
main "$@"

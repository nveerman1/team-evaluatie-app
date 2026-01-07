#!/bin/bash
# =============================================================================
# Database Restore Script
# =============================================================================
# 
# Restore PostgreSQL database from backup file.
# Use with EXTREME CAUTION in production!
#
# Usage:
#   ./scripts/restore_db.sh /path/to/backup.sql.gz
#   ./scripts/restore_db.sh --latest
#
# =============================================================================

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tea}"
CONTAINER_NAME="${CONTAINER_NAME:-tea_db}"
DB_USER="${POSTGRES_USER:-tea}"
DB_NAME="${POSTGRES_DB:-tea_production}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if database container is running
check_container() {
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "Database container '${CONTAINER_NAME}' is not running"
        exit 1
    fi
}

# Restore database from backup
restore_database() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    log_warn "=== DATABASE RESTORE ==="
    log_warn "This will DESTROY all current data in database: ${DB_NAME}"
    log_warn "Backup file: $backup_file"
    echo ""
    read -p "Type 'YES I UNDERSTAND' to continue: " -r
    
    if [ "$REPLY" != "YES I UNDERSTAND" ]; then
        log_error "Restore cancelled"
        exit 1
    fi
    
    # Create a safety backup first
    log_info "Creating safety backup of current database..."
    if [ -f "scripts/backup_db.sh" ]; then
        bash scripts/backup_db.sh --quick
    fi
    
    log_info "Starting restore process..."
    
    # Check if backup is compressed
    if [[ "$backup_file" == *.gz ]]; then
        log_info "Decompressing and restoring..."
        gunzip -c "$backup_file" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres
    else
        log_info "Restoring from uncompressed backup..."
        cat "$backup_file" | docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d postgres
    fi
    
    if [ $? -eq 0 ]; then
        log_info "Database restored successfully!"
    else
        log_error "Restore failed!"
        exit 1
    fi
}

# Main script
main() {
    if [ $# -eq 0 ]; then
        log_error "Usage: $0 <backup_file> or $0 --latest"
        exit 1
    fi
    
    check_container
    
    if [ "$1" = "--latest" ]; then
        BACKUP_FILE="${BACKUP_DIR}/latest.sql.gz"
        if [ ! -f "$BACKUP_FILE" ]; then
            log_error "No latest backup found at: $BACKUP_FILE"
            exit 1
        fi
        log_info "Using latest backup: $BACKUP_FILE"
        restore_database "$BACKUP_FILE"
    else
        restore_database "$1"
    fi
}

main "$@"

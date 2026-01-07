#!/bin/bash
# =============================================================================
# Database Migration Script for Production
# =============================================================================
# 
# This script runs Alembic migrations safely in a production environment.
# It includes pre-flight checks and rollback capability.
#
# Usage:
#   ./scripts/migrate.sh                    # Run all pending migrations
#   ./scripts/migrate.sh --check            # Check migration status only
#   ./scripts/migrate.sh --rollback [steps] # Rollback N migrations
#
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="${BACKEND_DIR:-backend}"
CONTAINER_NAME="${CONTAINER_NAME:-tea_backend}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in Docker or local
check_environment() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "Running migrations in Docker container: ${CONTAINER_NAME}"
        RUN_CMD="docker exec ${CONTAINER_NAME}"
    else
        log_info "Running migrations locally"
        RUN_CMD=""
        cd "${BACKEND_DIR}"
    fi
}

# Check database connectivity
check_database() {
    log_info "Checking database connectivity..."
    
    if [ -n "$RUN_CMD" ]; then
        if $RUN_CMD python -c "from app.infra.database import engine; engine.connect()" 2>/dev/null; then
            log_info "Database connection: OK"
            return 0
        else
            log_error "Cannot connect to database"
            return 1
        fi
    else
        if python -c "from app.infra.database import engine; engine.connect()" 2>/dev/null; then
            log_info "Database connection: OK"
            return 0
        else
            log_error "Cannot connect to database"
            return 1
        fi
    fi
}

# Show current migration status
show_status() {
    log_info "Current migration status:"
    echo ""
    
    if [ -n "$RUN_CMD" ]; then
        $RUN_CMD alembic current -v
        echo ""
        log_info "Pending migrations:"
        $RUN_CMD alembic history --indicate-current
    else
        alembic current -v
        echo ""
        log_info "Pending migrations:"
        alembic history --indicate-current
    fi
}

# Backup database before migration
backup_database() {
    log_warn "Creating database backup before migration..."
    
    # Use the backup script if available
    if [ -f "scripts/backup_db.sh" ]; then
        bash scripts/backup_db.sh --pre-migration
    else
        log_warn "Backup script not found. Consider creating a manual backup."
        read -p "Continue without backup? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
            log_error "Migration cancelled by user"
            exit 1
        fi
    fi
}

# Run migrations
run_migrations() {
    log_info "Running database migrations..."
    
    if [ -n "$RUN_CMD" ]; then
        $RUN_CMD alembic upgrade head
    else
        alembic upgrade head
    fi
    
    if [ $? -eq 0 ]; then
        log_info "Migrations completed successfully!"
        show_status
        return 0
    else
        log_error "Migration failed!"
        return 1
    fi
}

# Rollback migrations
rollback_migrations() {
    local steps=${1:-1}
    
    log_warn "Rolling back ${steps} migration(s)..."
    
    read -p "Are you sure you want to rollback? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        log_error "Rollback cancelled"
        exit 1
    fi
    
    if [ -n "$RUN_CMD" ]; then
        $RUN_CMD alembic downgrade -${steps}
    else
        alembic downgrade -${steps}
    fi
    
    if [ $? -eq 0 ]; then
        log_info "Rollback completed"
        show_status
    else
        log_error "Rollback failed!"
        exit 1
    fi
}

# Main script
main() {
    log_info "=== Database Migration Tool ==="
    echo ""
    
    # Parse arguments
    MODE="${1:-migrate}"
    
    case "$MODE" in
        --check)
            check_environment
            check_database || exit 1
            show_status
            ;;
        
        --rollback)
            check_environment
            check_database || exit 1
            rollback_migrations "${2:-1}"
            ;;
        
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  (none)           Run all pending migrations"
            echo "  --check          Show current migration status"
            echo "  --rollback [N]   Rollback N migrations (default: 1)"
            echo "  --help           Show this help message"
            exit 0
            ;;
        
        *)
            check_environment
            check_database || exit 1
            show_status
            echo ""
            
            # Ask for confirmation in production
            if [ "$APP_ENV" = "production" ] || [ "$NODE_ENV" = "production" ]; then
                log_warn "Running migrations in PRODUCTION environment!"
                backup_database
                read -p "Continue with migration? (yes/no): " -r
                if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
                    log_error "Migration cancelled by user"
                    exit 1
                fi
            fi
            
            run_migrations || exit 1
            ;;
    esac
}

# Run main function
main "$@"

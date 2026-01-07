#!/bin/bash
# =============================================================================
# Production Deployment Script
# =============================================================================
# 
# Automated deployment script for Team Evaluatie App.
# Pulls latest code, builds images, runs migrations, and deploys.
#
# Usage:
#   ./scripts/deploy.sh [OPTIONS]
#
# Options:
#   --no-backup    Skip pre-deployment backup
#   --no-build     Skip Docker image rebuild (use existing images)
#   --quick        Quick deployment (no backup, no build)
#   --rollback     Rollback to previous version
#
# =============================================================================

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-ops/docker/compose.prod.yml}"
PROJECT_NAME="${PROJECT_NAME:-tea}"
GIT_BRANCH="${GIT_BRANCH:-main}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') - $1"
}

log_step() {
    echo ""
    echo -e "${BLUE}==>${NC} $1"
    echo ""
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    # Check if .env.prod exists
    if [ ! -f ".env.prod" ]; then
        log_error ".env.prod file not found!"
        log_error "Copy .env.prod.example to .env.prod and configure it"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running!"
        exit 1
    fi
    
    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    log_info "Prerequisites: OK"
}

# Pull latest code from Git
pull_latest_code() {
    log_step "Pulling latest code from Git..."
    
    # Stash any local changes (shouldn't have any in production)
    git stash
    
    # Pull latest code
    git fetch origin
    git checkout "$GIT_BRANCH"
    git pull origin "$GIT_BRANCH"
    
    # Show current commit
    local commit=$(git rev-parse --short HEAD)
    local message=$(git log -1 --pretty=%B)
    log_info "Current commit: $commit"
    log_info "Commit message: $message"
}

# Create backup before deployment
create_backup() {
    log_step "Creating pre-deployment backup..."
    
    if [ -f "scripts/backup_db.sh" ]; then
        bash scripts/backup_db.sh --pre-migration
    else
        log_warn "Backup script not found, skipping backup"
    fi
}

# Build Docker images
build_images() {
    log_step "Building Docker images..."
    
    # Tag with timestamp for rollback capability
    export IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
    
    docker compose -f "$COMPOSE_FILE" build --no-cache
    
    log_info "Images built with tag: $IMAGE_TAG"
    
    # Also tag as 'latest'
    docker tag "tea-backend:$IMAGE_TAG" "tea-backend:latest" || true
    docker tag "tea-frontend:$IMAGE_TAG" "tea-frontend:latest" || true
}

# Run database migrations
run_migrations() {
    log_step "Running database migrations..."
    
    # Wait for database to be ready
    sleep 5
    
    if [ -f "scripts/migrate.sh" ]; then
        bash scripts/migrate.sh
    else
        log_warn "Migration script not found"
        docker compose -f "$COMPOSE_FILE" exec backend alembic upgrade head
    fi
}

# Deploy services
deploy_services() {
    log_step "Deploying services..."
    
    # Start/update services
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans
    
    log_info "Waiting for services to be healthy..."
    sleep 10
    
    # Check service health
    docker compose -f "$COMPOSE_FILE" ps
}

# Verify deployment
verify_deployment() {
    log_step "Verifying deployment..."
    
    # Check if containers are running
    local unhealthy=$(docker compose -f "$COMPOSE_FILE" ps --filter "health=unhealthy" --format json | wc -l)
    
    if [ "$unhealthy" -gt 0 ]; then
        log_error "Some services are unhealthy!"
        docker compose -f "$COMPOSE_FILE" ps
        return 1
    fi
    
    # Check backend health endpoint
    log_info "Checking backend health..."
    if docker exec tea_backend curl -f http://localhost:8000/health >/dev/null 2>&1; then
        log_info "Backend: Healthy"
    else
        log_error "Backend health check failed!"
        return 1
    fi
    
    # Check frontend health  
    log_info "Checking frontend health..."
    if docker exec tea_frontend node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" 2>/dev/null; then
        log_info "Frontend: Healthy"
    else
        log_warn "Frontend health check failed (may need custom endpoint)"
    fi
    
    log_info "Deployment verification: OK"
}

# Clean up old Docker resources
cleanup() {
    log_step "Cleaning up old Docker resources..."
    
    docker system prune -f
    
    log_info "Cleanup complete"
}

# Show deployment summary
show_summary() {
    log_step "Deployment Summary"
    
    echo "Services:"
    docker compose -f "$COMPOSE_FILE" ps
    
    echo ""
    echo "Recent logs:"
    docker compose -f "$COMPOSE_FILE" logs --tail=20
    
    echo ""
    log_info "Deployment completed successfully!"
    log_info "Monitor logs with: docker compose -f $COMPOSE_FILE logs -f"
}

# Rollback deployment
rollback_deployment() {
    log_step "Rolling back deployment..."
    log_warn "This will restore the previous version"
    
    read -p "Continue with rollback? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        log_error "Rollback cancelled"
        exit 1
    fi
    
    # Find previous git commit
    git checkout HEAD~1
    
    # Redeploy with previous version
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate
    
    log_info "Rollback complete"
    
    # Show services
    docker compose -f "$COMPOSE_FILE" ps
}

# Main deployment flow
main() {
    log_info "=== Team Evaluatie App - Production Deployment ==="
    echo ""
    
    # Parse arguments
    SKIP_BACKUP=false
    SKIP_BUILD=false
    ROLLBACK=false
    
    for arg in "$@"; do
        case $arg in
            --no-backup)
                SKIP_BACKUP=true
                ;;
            --no-build)
                SKIP_BUILD=true
                ;;
            --quick)
                SKIP_BACKUP=true
                SKIP_BUILD=true
                ;;
            --rollback)
                ROLLBACK=true
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --no-backup    Skip pre-deployment backup"
                echo "  --no-build     Skip Docker image rebuild"
                echo "  --quick        Quick deployment (no backup, no build)"
                echo "  --rollback     Rollback to previous version"
                echo "  --help         Show this help message"
                exit 0
                ;;
        esac
    done
    
    # Execute rollback if requested
    if [ "$ROLLBACK" = true ]; then
        rollback_deployment
        exit 0
    fi
    
    # Normal deployment flow
    check_prerequisites
    pull_latest_code
    
    if [ "$SKIP_BACKUP" = false ]; then
        create_backup
    fi
    
    if [ "$SKIP_BUILD" = false ]; then
        build_images
    fi
    
    run_migrations
    deploy_services
    verify_deployment
    cleanup
    show_summary
}

# Trap errors
trap 'log_error "Deployment failed! Check logs above."' ERR

# Run main function
main "$@"

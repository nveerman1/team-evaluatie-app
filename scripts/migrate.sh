#!/usr/bin/env bash
# =============================================================================
# Database Migration Script (Alembic) - Local or Docker (Production-safe)
# =============================================================================
#
# Usage:
#   ./scripts/migrate.sh                     # Run migrations to head
#   ./scripts/migrate.sh --check             # Show current status
#   ./scripts/migrate.sh --rollback [steps]  # Rollback N revisions (default 1)
#   ./scripts/migrate.sh --stamp-head        # Stamp DB to head (NO DDL) - use with care
#
# Env overrides:
#   BACKEND_DIR=/path/to/backend
#   CONTAINER_NAME=tea_backend
#   PY_BIN=/opt/venv/bin/python              # python inside container (default)
#   AUTO_YES=1                               # skip confirmation prompts
#
# =============================================================================

set -euo pipefail

# ----- Colors -----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ----- Paths / Config -----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DEFAULT_BACKEND_DIR="${REPO_ROOT}/backend"
BACKEND_DIR="${BACKEND_DIR:-$DEFAULT_BACKEND_DIR}"

CONTAINER_NAME="${CONTAINER_NAME:-tea_backend}"

# Default python inside your production container (venv copied from builder)
PY_BIN="${PY_BIN:-/opt/venv/bin/python}"

# These become arrays so quoting is always safe
RUN_CMD=()     # e.g. (docker exec -i tea_backend)
PY=()          # e.g. (/opt/venv/bin/python) or (python)
ALEMBIC=()     # e.g. (/opt/venv/bin/python -m alembic) or (python -m alembic)

# ----- Helpers -----
confirm() {
  local prompt="${1:-Continue? (yes/no): }"
  if [[ "${AUTO_YES:-0}" == "1" ]]; then
    log_warn "AUTO_YES=1 → skipping confirmation."
    return 0
  fi

  read -r -p "$prompt" REPLY
  if [[ ! "$REPLY" =~ ^[Yy]es$ ]]; then
    log_error "Cancelled."
    exit 1
  fi
}

# Decide: docker exec vs local
check_environment() {
  if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log_info "Running migrations in Docker container: ${CONTAINER_NAME}"
    RUN_CMD=(docker exec -i "${CONTAINER_NAME}")

    # Prefer venv python if present; fallback to system python
    if "${RUN_CMD[@]}" sh -c "test -x '${PY_BIN}'"; then
      PY=("${PY_BIN}")
    else
      log_warn "PY_BIN (${PY_BIN}) not found/executable in container; falling back to 'python'."
      PY=(python)
    fi
  else
    log_info "Running migrations locally"
    RUN_CMD=()
    if [[ ! -d "${BACKEND_DIR}" ]]; then
      log_error "BACKEND_DIR not found: ${BACKEND_DIR}"
      exit 1
    fi
    cd "${BACKEND_DIR}"
    PY=(python)
  fi

  ALEMBIC=("${PY[@]}" -m alembic)
}

require_alembic() {
  if ! "${RUN_CMD[@]}" "${PY[@]}" -c "import alembic" >/dev/null 2>&1; then
    log_error "Alembic is not available in this environment."
    log_error "Tried: ${RUN_CMD[*]:-local} ${PY[*]} -c 'import alembic'"
    exit 1
  fi
}

check_database() {
  log_info "Checking database connectivity..."

  # Show useful info + do a real query; do NOT hide stderr.
  "${RUN_CMD[@]}" "${PY[@]}" - <<'PY'
from sqlalchemy import text
from app.infra.database import engine

print("DB URL:", engine.url)
with engine.connect() as c:
    v = c.execute(text("select 1")).scalar()
    print("Connected OK, select 1 ->", v)
PY

  log_info "Database connection: OK"
}

show_status() {
  log_info "Current migration status:"
  echo ""

  "${RUN_CMD[@]}" "${ALEMBIC[@]}" current -v
  echo ""
  "${RUN_CMD[@]}" "${ALEMBIC[@]}" history --indicate-current | head -n 60 || true
  echo ""
}

run_migrations() {
  log_info "Running migrations (upgrade head)..."
  "${RUN_CMD[@]}" "${ALEMBIC[@]}" upgrade head
  log_info "Migrations completed."
}

rollback_migrations() {
  local steps="${1:-1}"

  if ! [[ "$steps" =~ ^[0-9]+$ ]]; then
    log_error "Rollback steps must be a number. Got: $steps"
    exit 1
  fi

  log_warn "You are about to rollback ${steps} revision(s)."
  show_status
  confirm "Type 'yes' to proceed with rollback: "

  "${RUN_CMD[@]}" "${ALEMBIC[@]}" downgrade "-${steps}"
  log_info "Rollback completed."
  show_status
}

stamp_head() {
  log_warn "STAMPING to head updates alembic_version WITHOUT running migrations."
  log_warn "Only use this if the DB schema already matches the code schema."
  confirm "Type 'yes' to stamp head: "

  "${RUN_CMD[@]}" "${ALEMBIC[@]}" stamp head
  log_info "Stamped to head."
  show_status
}

usage() {
  cat <<'EOF'
Usage:
  ./scripts/migrate.sh                     Run migrations to head
  ./scripts/migrate.sh --check             Show migration status
  ./scripts/migrate.sh --rollback [steps]  Rollback N revisions (default 1)
  ./scripts/migrate.sh --stamp-head        Stamp DB to head (no DDL) - use with care

Env:
  BACKEND_DIR=/path/to/backend
  CONTAINER_NAME=tea_backend
  PY_BIN=/opt/venv/bin/python
  AUTO_YES=1
EOF
}

main() {
  log_info "=== Database Migration Tool ==="
  echo ""

  check_environment
  require_alembic

  local mode="${1:-migrate}"

  case "$mode" in
    --help|-h)
      usage
      exit 0
      ;;
    --check)
      check_database
      show_status
      ;;
    --rollback)
      check_database
      rollback_migrations "${2:-1}"
      ;;
    --stamp-head)
      check_database
      stamp_head
      ;;
    migrate|--migrate|"")
      check_database
      show_status

      # Safety prompt in production-like scenario (docker container)
      log_warn "About to run: alembic upgrade head"
      confirm "Continue with migration? (yes/no): "

      run_migrations
      show_status
      ;;
    *)
      log_error "Unknown option: $mode"
      usage
      exit 1
      ;;
  esac
}

main "$@"

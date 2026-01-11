#!/bin/bash
# =============================================================================
# Security Headers Duplication Check Script
# =============================================================================
# 
# This script validates that security headers are not duplicated in HTTP responses.
# It checks both external (via nginx) and internal (backend direct) endpoints.
#
# Usage:
#   ./scripts/check-duplicate-headers.sh
#
# Requirements:
#   - Docker containers must be running
#   - curl must be available
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Headers to check
HEADERS=(
    "Strict-Transport-Security"
    "X-Frame-Options"
    "X-Content-Type-Options"
    "X-XSS-Protection"
    "Referrer-Policy"
    "Permissions-Policy"
    "Content-Security-Policy"
)

echo "========================================================================"
echo "Security Headers Duplication Check"
echo "========================================================================"
echo ""

# =============================================================================
# Function: Check header duplication
# =============================================================================
check_headers() {
    local url="$1"
    local description="$2"
    local use_docker="$3"
    local container="$4"
    
    echo -e "${BLUE}Checking: ${description}${NC}"
    echo "URL: $url"
    echo ""
    
    # Get headers
    if [ "$use_docker" = "true" ]; then
        headers=$(docker exec "$container" sh -c "curl -s -D - -o /dev/null '$url'" 2>/dev/null)
    else
        headers=$(curl -s -D - -o /dev/null "$url" 2>/dev/null)
    fi
    
    # Check each security header
    local has_duplicates=false
    for header in "${HEADERS[@]}"; do
        # Count occurrences (case-insensitive)
        count=$(echo "$headers" | grep -i "^${header}:" | wc -l)
        
        if [ "$count" -eq 0 ]; then
            echo -e "  ${YELLOW}⚠${NC}  ${header}: Missing"
        elif [ "$count" -eq 1 ]; then
            echo -e "  ${GREEN}✓${NC}  ${header}: OK (1 occurrence)"
        else
            echo -e "  ${RED}✗${NC}  ${header}: DUPLICATE (${count} occurrences)"
            has_duplicates=true
        fi
    done
    
    echo ""
    
    if [ "$has_duplicates" = true ]; then
        echo -e "${RED}FAILED: Duplicate headers detected!${NC}"
        echo ""
        return 1
    else
        echo -e "${GREEN}PASSED: No duplicate headers${NC}"
        echo ""
        return 0
    fi
}

# =============================================================================
# Function: Check nginx configuration
# =============================================================================
check_nginx_config() {
    echo -e "${BLUE}Checking Nginx Configuration${NC}"
    echo ""
    
    if ! docker exec tea_nginx sh -c 'nginx -T 2>/dev/null' > /tmp/nginx-config.txt; then
        echo -e "${YELLOW}⚠ Could not retrieve nginx config (container may not be running)${NC}"
        echo ""
        return 0
    fi
    
    echo "Searching for security header directives in nginx config..."
    echo ""
    
    for header in "${HEADERS[@]}"; do
        # Count add_header directives for this header
        count=$(grep -i "add_header\s\+${header}" /tmp/nginx-config.txt | wc -l)
        
        if [ "$count" -eq 0 ]; then
            echo -e "  ${YELLOW}⚠${NC}  ${header}: Not set in nginx"
        elif [ "$count" -eq 1 ]; then
            echo -e "  ${GREEN}✓${NC}  ${header}: Set once in nginx"
        else
            echo -e "  ${RED}✗${NC}  ${header}: Set ${count} times in nginx (may cause duplicates)"
        fi
    done
    
    echo ""
    rm -f /tmp/nginx-config.txt
}

# =============================================================================
# Main execution
# =============================================================================

all_passed=true

# Check if docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

# Check nginx configuration
check_nginx_config

# Check 1: External HTTPS endpoint (through nginx)
echo "------------------------------------------------------------------------"
if check_headers "https://app.technasiummbh.nl/api/v1/auth/me" "External HTTPS (via Nginx)" false ""; then
    :
else
    all_passed=false
fi

# Check 2: External HTTPS endpoint - health check
echo "------------------------------------------------------------------------"
if check_headers "https://app.technasiummbh.nl/health" "External HTTPS Health Check (via Nginx)" false ""; then
    :
else
    all_passed=false
fi

# Check 3: Internal backend direct (bypass nginx)
echo "------------------------------------------------------------------------"
if docker exec tea_backend sh -c 'curl --version' &> /dev/null; then
    if check_headers "http://localhost:8000/api/v1/auth/me" "Internal Backend Direct (no nginx)" true "tea_backend"; then
        :
    else
        all_passed=false
    fi
else
    echo -e "${YELLOW}⚠ Could not check internal backend (container not running or curl not available)${NC}"
    echo ""
fi

# Check 4: Internal backend health check
echo "------------------------------------------------------------------------"
if docker exec tea_backend sh -c 'curl --version' &> /dev/null; then
    if check_headers "http://localhost:8000/health" "Internal Backend Health Check (no nginx)" true "tea_backend"; then
        :
    else
        all_passed=false
    fi
else
    echo -e "${YELLOW}⚠ Could not check internal backend health (container not running or curl not available)${NC}"
    echo ""
fi

# Final result
echo "========================================================================"
if [ "$all_passed" = true ]; then
    echo -e "${GREEN}✓ All checks passed - No duplicate security headers detected${NC}"
    echo "========================================================================"
    exit 0
else
    echo -e "${RED}✗ Some checks failed - Duplicate security headers detected${NC}"
    echo "========================================================================"
    exit 1
fi

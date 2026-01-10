#!/bin/bash
# ==============================================================================
# RCE Incident Response - Verification Script
# ==============================================================================
# Purpose: Verify that all RCE mitigations are properly applied
# Usage: ./scripts/verify-rce-mitigation.sh [--check-persistence]
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check flags
CHECK_PERSISTENCE=false
if [ "$1" == "--check-persistence" ]; then
    CHECK_PERSISTENCE=true
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}RCE Mitigation Verification Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ==============================================================================
# 1. Verify Package Versions
# ==============================================================================
echo -e "${BLUE}[1/7] Checking React & Next.js versions...${NC}"

cd "$PROJECT_ROOT/frontend"

if [ ! -f "package.json" ]; then
    echo -e "${RED}✗ package.json not found${NC}"
    exit 1
fi

NEXT_VERSION=$(cat package.json | grep '"next"' | sed 's/.*"next": "\([^"]*\)".*/\1/')
REACT_VERSION=$(cat package.json | grep '"react"' | head -1 | sed 's/.*"react": "\([^"]*\)".*/\1/')
REACT_DOM_VERSION=$(cat package.json | grep '"react-dom"' | sed 's/.*"react-dom": "\([^"]*\)".*/\1/')

echo "  Next.js: $NEXT_VERSION"
echo "  React: $REACT_VERSION"
echo "  React-DOM: $REACT_DOM_VERSION"

# Check if versions are safe
# Strategy: Downgrade to React 18.3.x (LTS) to avoid React 19 RSC vulnerabilities
# Next.js 15.0.3 is stable and early enough to avoid 15.5.x issues
SAFE_VERSIONS=false

# Check React version - should be 18.3.x (safe) or 19.1.1+ (patched)
if [[ "$REACT_VERSION" =~ ^18\. ]]; then
    echo -e "${GREEN}✓ React version $REACT_VERSION is SAFE (React 18 LTS - no RSC vulnerabilities)${NC}"
    SAFE_VERSIONS=true
elif [[ "$REACT_VERSION" == "19.0.0" ]] || [[ "$REACT_VERSION" == "19.1.0" ]]; then
    echo -e "${RED}✗ React version $REACT_VERSION is VULNERABLE to CVE-2025-55182${NC}"
    echo -e "${YELLOW}  Recommended: Downgrade to React 18.3.1 (LTS) or upgrade to 19.1.1+${NC}"
    SAFE_VERSIONS=false
else
    echo -e "${GREEN}✓ React version $REACT_VERSION appears safe${NC}"
    SAFE_VERSIONS=true
fi

# Check Next.js version - 15.0.3 is safe early version
if [[ "$NEXT_VERSION" =~ ^15\.0\.[0-9] ]] || [[ "$NEXT_VERSION" =~ ^14\. ]]; then
    echo -e "${GREEN}✓ Next.js version $NEXT_VERSION is SAFE${NC}"
elif [[ "$NEXT_VERSION" == "15.5.9" ]] || [[ "$NEXT_VERSION" == "15.5.8" ]] || [[ "$NEXT_VERSION" == "15.5.7" ]]; then
    echo -e "${RED}✗ Next.js version $NEXT_VERSION is VULNERABLE${NC}"
    echo -e "${YELLOW}  Recommended: Downgrade to Next.js 15.0.3 or upgrade to 15.5.10+${NC}"
    SAFE_VERSIONS=false
fi

echo ""

# ==============================================================================
# 2. Verify Docker Security Configuration
# ==============================================================================
echo -e "${BLUE}[2/7] Checking Docker security configuration...${NC}"

COMPOSE_FILE="$PROJECT_ROOT/ops/docker/compose.prod.yml"

if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}✗ Docker compose file not found${NC}"
    exit 1
fi

# Check for security_opt
if grep -q "no-new-privileges:true" "$COMPOSE_FILE"; then
    echo -e "${GREEN}✓ no-new-privileges enabled${NC}"
else
    echo -e "${RED}✗ no-new-privileges NOT enabled${NC}"
fi

# Check for capability drops
if grep -q "cap_drop:" "$COMPOSE_FILE"; then
    echo -e "${GREEN}✓ Capabilities dropped${NC}"
else
    echo -e "${RED}✗ Capabilities NOT dropped${NC}"
fi

# Check for tmpfs
if grep -q "tmpfs:" "$COMPOSE_FILE"; then
    echo -e "${GREEN}✓ tmpfs configured${NC}"
else
    echo -e "${RED}✗ tmpfs NOT configured${NC}"
fi

# Check for resource limits
if grep -q "mem_limit:" "$COMPOSE_FILE" && grep -q "cpus:" "$COMPOSE_FILE" && grep -q "pids_limit:" "$COMPOSE_FILE"; then
    echo -e "${GREEN}✓ Resource limits configured${NC}"
else
    echo -e "${RED}✗ Resource limits NOT properly configured${NC}"
fi

echo ""

# ==============================================================================
# 3. Verify Nginx RSC Protection
# ==============================================================================
echo -e "${BLUE}[3/7] Checking Nginx RSC endpoint protection...${NC}"

NGINX_CONF="$PROJECT_ROOT/ops/nginx/nginx.conf"
NGINX_SITE="$PROJECT_ROOT/ops/nginx/site.conf"

if [ ! -f "$NGINX_CONF" ] || [ ! -f "$NGINX_SITE" ]; then
    echo -e "${RED}✗ Nginx configuration files not found${NC}"
    exit 1
fi

# Check for RSC rate limiting zone
if grep -q "zone=rsc:" "$NGINX_CONF"; then
    echo -e "${GREEN}✓ RSC rate limiting zone configured${NC}"
else
    echo -e "${RED}✗ RSC rate limiting zone NOT configured${NC}"
fi

# Check for RSC endpoint protection
if grep -q "_next/data/" "$NGINX_SITE"; then
    echo -e "${GREEN}✓ RSC endpoint protection configured${NC}"
else
    echo -e "${RED}✗ RSC endpoint protection NOT configured${NC}"
fi

# Check for X-User-Email stripping
if grep -q 'X-User-Email ""' "$NGINX_SITE"; then
    echo -e "${GREEN}✓ X-User-Email header stripping configured${NC}"
else
    echo -e "${YELLOW}⚠ X-User-Email header stripping NOT found (may be okay if using Azure AD only)${NC}"
fi

echo ""

# ==============================================================================
# 4. Check for Dangerous Code Patterns
# ==============================================================================
echo -e "${BLUE}[4/7] Scanning for dangerous code patterns...${NC}"

cd "$PROJECT_ROOT"

# Check for child_process usage
CHILD_PROCESS_COUNT=$(find frontend/src backend/app -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" \) -exec grep -l "child_process\|subprocess" {} \; 2>/dev/null | wc -l)

if [ "$CHILD_PROCESS_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ No child_process/subprocess usage found${NC}"
else
    echo -e "${YELLOW}⚠ Found $CHILD_PROCESS_COUNT file(s) with child_process/subprocess${NC}"
fi

# Check for Server Actions
SERVER_ACTIONS_COUNT=$(find frontend/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec grep -l '"use server"\|'"'"'use server'"'"'' {} \; 2>/dev/null | wc -l)

if [ "$SERVER_ACTIONS_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ No Server Actions found${NC}"
else
    echo -e "${YELLOW}⚠ Found $SERVER_ACTIONS_COUNT file(s) with Server Actions${NC}"
fi

echo ""

# ==============================================================================
# 5. Check Container Status (if running)
# ==============================================================================
echo -e "${BLUE}[5/7] Checking running containers...${NC}"

if command -v docker &> /dev/null; then
    if docker ps | grep -q "tea_frontend"; then
        echo -e "${GREEN}✓ Frontend container is running${NC}"
        
        # Check container security settings
        CONTAINER_INFO=$(docker inspect tea_frontend 2>/dev/null)
        
        if echo "$CONTAINER_INFO" | grep -q '"NoNewPrivileges": true'; then
            echo -e "${GREEN}✓ NoNewPrivileges enabled in running container${NC}"
        else
            echo -e "${RED}✗ NoNewPrivileges NOT enabled in running container${NC}"
        fi
        
        if echo "$CONTAINER_INFO" | grep -q '"ReadonlyRootfs": true'; then
            echo -e "${GREEN}✓ Read-only rootfs enabled${NC}"
        else
            echo -e "${YELLOW}⚠ Read-only rootfs NOT enabled (expected for Next.js)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Frontend container not running${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Docker not available${NC}"
fi

echo ""

# ==============================================================================
# 6. Check for Persistence Mechanisms (Optional)
# ==============================================================================
if [ "$CHECK_PERSISTENCE" = true ]; then
    echo -e "${BLUE}[6/7] Checking for persistence mechanisms...${NC}"
    
    if docker ps | grep -q "tea_frontend"; then
        echo "  Checking cron jobs..."
        docker exec tea_frontend sh -c "crontab -l 2>/dev/null || echo 'No crontab'" | head -5
        
        echo "  Checking /tmp directory..."
        docker exec tea_frontend sh -c "ls -la /tmp/ 2>/dev/null | head -20"
        
        echo "  Checking for suspicious processes..."
        docker exec tea_frontend sh -c "ps aux | grep -E 'wget|curl|nc|bash|sh' | grep -v grep || echo 'No suspicious processes'"
        
        echo "  Checking for recently modified files..."
        docker exec tea_frontend sh -c "find / -mtime -1 -type f 2>/dev/null | head -20"
    else
        echo -e "${YELLOW}⚠ Cannot check persistence - container not running${NC}"
    fi
else
    echo -e "${BLUE}[6/7] Skipping persistence check (use --check-persistence to enable)${NC}"
fi

echo ""

# ==============================================================================
# 7. Network Connections Check
# ==============================================================================
echo -e "${BLUE}[7/7] Checking network connections...${NC}"

if docker ps | grep -q "tea_frontend" && [ "$CHECK_PERSISTENCE" = true ]; then
    echo "  Checking for suspicious outbound connections..."
    docker exec tea_frontend sh -c "netstat -antp 2>/dev/null | grep ESTABLISHED || echo 'netstat not available'"
    
    echo "  Checking for known malicious IP (91.92.241.10)..."
    if docker exec tea_frontend sh -c "netstat -an 2>/dev/null | grep 91.92.241.10"; then
        echo -e "${RED}✗ CRITICAL: Connection to malicious IP detected!${NC}"
    else
        echo -e "${GREEN}✓ No connection to known malicious IP${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping network check${NC}"
fi

echo ""

# ==============================================================================
# Summary
# ==============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"

if [ "$SAFE_VERSIONS" = true ]; then
    echo -e "${GREEN}✓ Package versions: SAFE${NC}"
else
    echo -e "${RED}✗ Package versions: VULNERABLE - UPGRADE REQUIRED${NC}"
fi

echo ""
echo -e "${YELLOW}Next Steps:${NC}"
if [ "$SAFE_VERSIONS" = false ]; then
    echo -e "  1. ${RED}URGENT:${NC} Upgrade/downgrade React and Next.js to safe versions"
    echo -e "     ${GREEN}Recommended (Conservative):${NC} cd frontend && npm install next@15.0.3 react@^18.3.1 react-dom@^18.3.1"
    echo -e "     ${YELLOW}Alternative (If React 19 needed):${NC} cd frontend && npm install next@15.5.10 react@19.1.1 react-dom@19.1.1"
fi
echo -e "  2. Review Docker compose security settings"
echo -e "  3. Verify Nginx configuration is deployed"
echo -e "  4. Test rate limiting: for i in {1..20}; do curl https://your-domain.com/_next/data/...; done"
echo -e "  5. Monitor logs for suspicious activity: docker logs tea_frontend -f"
echo -e "  6. Run with --check-persistence flag to check for malware"

echo ""
echo -e "${BLUE}========================================${NC}"

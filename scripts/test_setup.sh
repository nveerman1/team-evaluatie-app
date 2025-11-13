#!/bin/bash

# Quick setup script for testing the multi-tenant multi-course architecture
# Run this from the project root directory

set -e  # Exit on error

echo "=========================================="
echo "Multi-Tenant Architecture Test Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "README.md" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Starting database...${NC}"
docker compose -f ops/docker/compose.dev.yml up -d
sleep 3
echo -e "${GREEN}✓ Database started${NC}"
echo ""

echo -e "${YELLOW}Step 2: Setting up backend environment...${NC}"
cd backend

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing dependencies..."
pip install -q -r requirements-dev.txt
echo -e "${GREEN}✓ Backend dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Running database migrations...${NC}"
alembic upgrade head
echo -e "${GREEN}✓ Migrations complete${NC}"
echo ""

echo -e "${YELLOW}Step 4: Seeding demo data...${NC}"
python scripts/seed_demo_data.py
echo -e "${GREEN}✓ Demo data seeded${NC}"
echo ""

echo -e "${YELLOW}Step 5: Running RBAC tests...${NC}"
pytest tests/test_rbac.py -v --tb=short
echo -e "${GREEN}✓ Tests passed${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}Setup complete!${NC}"
echo "=========================================="
echo ""
echo "To start the backend server:"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  uvicorn app.main:app --reload --port 8000"
echo ""
echo "To start the frontend:"
echo "  cd frontend"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "API Documentation: http://localhost:8000/docs"
echo "Frontend: http://localhost:3000"
echo ""
echo "Demo credentials:"
echo "  Email: admin@demo.school"
echo "  Password: demo123"
echo ""
echo "For detailed testing instructions, see: docs/TESTING_GUIDE.md"
echo ""

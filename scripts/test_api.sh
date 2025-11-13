#!/bin/bash

# API Testing Script for Multi-Tenant Multi-Course Architecture
# Tests all the new course endpoints

set -e

API_URL="${API_URL:-http://localhost:8000}"
USER_EMAIL="${USER_EMAIL:-admin@demo.school}"

echo "=========================================="
echo "Testing Courses API"
echo "=========================================="
echo "API URL: $API_URL"
echo "User: $USER_EMAIL"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "  $method $endpoint"
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "X-User-Email: $USER_EMAIL" \
            -H "Content-Type: application/json" \
            "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "X-User-Email: $USER_EMAIL" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ Success (HTTP $http_code)${NC}"
        echo "$body" | python -m json.tool 2>/dev/null || echo "$body"
    else
        echo -e "${RED}✗ Failed (HTTP $http_code)${NC}"
        echo "$body"
    fi
    echo ""
}

# Test 1: Health check
test_endpoint "GET" "/health" "" "Health check"

# Test 2: Create a course
course_data='{
  "name": "Onderzoek & Ontwerpen",
  "code": "OO",
  "level": "bovenbouw",
  "year": 2024,
  "period": "Semester 1",
  "description": "O&O voor bovenbouw"
}'
test_endpoint "POST" "/api/v1/courses" "$course_data" "Create course - O&O"

# Test 3: Create another course
course_data2='{
  "name": "XPLR",
  "code": "XPLR",
  "level": "onderbouw",
  "year": 2024,
  "period": "Q1",
  "description": "XPLR exploratie voor onderbouw"
}'
test_endpoint "POST" "/api/v1/courses" "$course_data2" "Create course - XPLR"

# Test 4: Create third course
course_data3='{
  "name": "Nederlands",
  "code": "NE",
  "level": "bovenbouw",
  "year": 2024,
  "period": "Semester 1"
}'
test_endpoint "POST" "/api/v1/courses" "$course_data3" "Create course - Nederlands"

# Test 5: List all courses
test_endpoint "GET" "/api/v1/courses?page=1&per_page=20" "" "List all courses"

# Test 6: List courses with filters
test_endpoint "GET" "/api/v1/courses?level=bovenbouw&year=2024" "" "List courses (bovenbouw, 2024)"

# Test 7: Search courses
test_endpoint "GET" "/api/v1/courses?search=XPLR" "" "Search courses (XPLR)"

# Test 8: Get specific course (assuming ID 1)
test_endpoint "GET" "/api/v1/courses/1" "" "Get course by ID (1)"

# Test 9: Update course
update_data='{
  "description": "Updated description for O&O"
}'
test_endpoint "PATCH" "/api/v1/courses/1" "$update_data" "Update course (1)"

# Test 10: Get course teachers
test_endpoint "GET" "/api/v1/courses/1/teachers" "" "Get course teachers (1)"

# Test 11: Test Somtoday integration status
test_endpoint "GET" "/api/v1/integrations/somtoday/status" "" "Somtoday integration status"

echo "=========================================="
echo -e "${GREEN}API Testing Complete!${NC}"
echo "=========================================="
echo ""
echo "Notes:"
echo "- Course IDs may vary depending on existing data"
echo "- Some endpoints may return different results"
echo "- Check the API docs for more details: $API_URL/docs"
echo ""

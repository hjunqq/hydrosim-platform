#!/bin/bash

# Configuration
API_URL=${API_URL:-"http://localhost:8000"}
AUTH_TOKEN=${AUTH_TOKEN:-""}
CSV_FILE=${1:-"students.csv"}

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${RED}Error: AUTH_TOKEN environment variable is required.${NC}"
    echo "Usage: AUTH_TOKEN=xxx ./batch-create.sh [csv_file]"
    exit 1
fi

if [ ! -f "$CSV_FILE" ]; then
    echo -e "${RED}Error: File $CSV_FILE not found.${NC}"
    exit 1
fi

echo "Processing $CSV_FILE..."

# Skip header and read file
tail -n +2 "$CSV_FILE" | while IFS=, read -r student_code name project_type git_repo_url || [ -n "$student_code" ]; do
    # Trim whitespace
    student_code=$(echo "$student_code" | xargs)
    name=$(echo "$name" | xargs)
    project_type=$(echo "$project_type" | xargs)
    git_repo_url=$(echo "$git_repo_url" | xargs)

    if [ -z "$student_code" ]; then continue; fi

    echo -n "Creating student $student_code ($name)... "

    # JSON Payload
    JSON_DATA=$(cat <<EOF
{
  "student_code": "$student_code",
  "name": "$name",
  "project_type": "$project_type",
  "git_repo_url": "$git_repo_url"
}
EOF
)

    # API Call
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/v1/students" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$JSON_DATA")

    if [ "$RESPONSE" -eq 200 ] || [ "$RESPONSE" -eq 201 ]; then
        echo -e "${GREEN}Success${NC}"
    else
        echo -e "${RED}Failed (Status: $RESPONSE)${NC}"
    fi

done

echo "Batch creation complete."

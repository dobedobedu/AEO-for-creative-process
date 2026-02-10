#!/bin/bash

# Apply Industry Template Script
# Usage: ./scripts/apply-template.sh <template-name>
#
# Templates available:
#   - real-estate
#   - education
#   - healthcare
#   - marketing-general

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATES_DIR="$PROJECT_ROOT/config/templates"
CONFIG_DIR="$PROJECT_ROOT/config"
TENANT_CONFIG="$CONFIG_DIR/tenant.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Show usage
usage() {
    echo "Usage: $0 <template-name>"
    echo ""
    echo "Available templates:"
    for f in "$TEMPLATES_DIR"/*.json; do
        if [ -f "$f" ]; then
            name=$(basename "$f" .json)
            echo "  - $name"
        fi
    done
    exit 1
}

# Check arguments
if [ $# -lt 1 ]; then
    usage
fi

TEMPLATE_NAME="$1"
TEMPLATE_FILE="$TEMPLATES_DIR/$TEMPLATE_NAME.json"

# Check template exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}Error: Template '$TEMPLATE_NAME' not found${NC}"
    echo ""
    usage
fi

# Warn if overwriting existing config
if [ -f "$TENANT_CONFIG" ]; then
    echo -e "${YELLOW}Warning: config/tenant.json already exists${NC}"
    read -p "Overwrite? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    # Create backup
    BACKUP_FILE="$CONFIG_DIR/tenant.json.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$TENANT_CONFIG" "$BACKUP_FILE"
    echo -e "${GREEN}Backed up existing config to: $BACKUP_FILE${NC}"
fi

# Copy template to tenant.json
cp "$TEMPLATE_FILE" "$TENANT_CONFIG"
echo -e "${GREEN}Applied template: $TEMPLATE_NAME${NC}"

# Remove template metadata from copied file
# (We keep it in templates but don't need it in tenant.json)
if command -v jq &> /dev/null; then
    TMP_FILE=$(mktemp)
    jq 'del(._templateInfo) | del(.["$schema"])' "$TENANT_CONFIG" > "$TMP_FILE" && mv "$TMP_FILE" "$TENANT_CONFIG"
    echo "Cleaned up template metadata."
fi

echo ""
echo -e "${GREEN}Done!${NC} Next steps:"
echo "1. Edit config/tenant.json to customize for your brand"
echo "2. Update the brand name, aliases, and domain"
echo "3. Add your competitors"
echo "4. Customize personas and stages if needed"
echo "5. Run 'npm run dev' to start the application"

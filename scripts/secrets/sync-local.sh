#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/secrets/sync-local.sh <source-env-file> [KEY ...]

Description:
  Merge selected keys from a source env file into .env.local.
  If no keys are provided, a default key set is merged.
  Existing .env.local is backed up first.

Examples:
  scripts/secrets/sync-local.sh .env.preview.example
  scripts/secrets/sync-local.sh /tmp/secrets.env OPENAI_API_KEY XAI_API_KEY
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

SOURCE_FILE="$1"
shift

if [[ ! -f "$SOURCE_FILE" ]]; then
  echo "Source env file not found: $SOURCE_FILE" >&2
  exit 2
fi

TARGET_FILE=".env.local"

if [[ -f "$TARGET_FILE" ]]; then
  backup="${TARGET_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
  cp "$TARGET_FILE" "$backup"
  echo "[sync-local] backup created: $backup"
else
  touch "$TARGET_FILE"
fi

KEYS=("$@")
if [[ ${#KEYS[@]} -eq 0 ]]; then
  KEYS=(
    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    DATABASE_URL
    NEXT_PUBLIC_ADMIN_ENABLED
    CRON_SECRET
    OPENAI_API_KEY
    ANTHROPIC_API_KEY
    GEMINI_API_KEY
    XAI_API_KEY
    OPENROUTER_API_KEY
  )
fi

upsert_key() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" '
    BEGIN { found=0 }
    $0 ~ ("^" k "=") { print k "=" v; found=1; next }
    { print }
    END { if (!found) print k "=" v }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

for key in "${KEYS[@]}"; do
  line="$(grep -E "^${key}=" "$SOURCE_FILE" | tail -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo "[sync-local] skip: $key not found in source"
    continue
  fi
  value="${line#*=}"
  upsert_key "$key" "$value" "$TARGET_FILE"
  echo "[sync-local] merged: $key"
done

echo "[sync-local] complete"

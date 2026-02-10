#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/secrets/sync-vercel.sh <preview|production> [KEY ...] [--dry-run]

Description:
  Sync selected environment variables from your current shell to Vercel.
  If no keys are provided, a default set is used.

Examples:
  scripts/secrets/sync-vercel.sh preview
  scripts/secrets/sync-vercel.sh production OPENAI_API_KEY XAI_API_KEY
  scripts/secrets/sync-vercel.sh preview --dry-run
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

TARGET="$1"
shift

if [[ "$TARGET" != "preview" && "$TARGET" != "production" ]]; then
  echo "Invalid target: $TARGET (must be preview or production)" >&2
  exit 2
fi

DRY_RUN="false"
KEYS=()
for arg in "$@"; do
  if [[ "$arg" == "--dry-run" ]]; then
    DRY_RUN="true"
  else
    KEYS+=("$arg")
  fi
done

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI not found. Install with: npm i -g vercel" >&2
  exit 2
fi

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

for key in "${KEYS[@]}"; do
  value="${!key-}"
  if [[ -z "${value}" ]]; then
    echo "[sync-vercel] skip: $key is not set in current shell"
    continue
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[sync-vercel] dry-run: would sync $key to $TARGET"
    continue
  fi

  echo "[sync-vercel] syncing $key -> $TARGET"
  printf "%s" "$value" | vercel env add "$key" "$TARGET" --yes
done

echo "[sync-vercel] complete"

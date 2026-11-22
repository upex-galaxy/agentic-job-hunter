#!/usr/bin/env bash
# Uso: mark-handled.sh <thread-id> <ultimo-mensaje-ts>
set -eu
source "$(dirname "$0")/lib/env.sh"
F="$INBOX_DIR/handled.json"; [ -f "$F" ] || echo '{}' > "$F"
tmp=$(mktemp); jq --arg k "$1" --arg v "${2:-$(date +%s)}" '.[$k]=$v' "$F" > "$tmp" && mv "$tmp" "$F"

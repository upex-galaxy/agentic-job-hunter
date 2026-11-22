#!/usr/bin/env bash
# Uso: mark-pending.sh <thread-id> "<qué espera>"   |   mark-pending.sh --clear <thread-id>
set -eu
source "$(dirname "$0")/lib/env.sh"
F="$INBOX_DIR/pending.json"; [ -f "$F" ] || echo '[]' > "$F"
tmp=$(mktemp)
if [ "$1" = "--clear" ]; then jq --arg t "$2" 'map(select(.thread!=$t))' "$F" > "$tmp"
else jq --arg t "$1" --arg w "${2:-decisión}" 'map(select(.thread!=$t)) + [{thread:$t,waiting:$w}]' "$F" > "$tmp"; fi
mv "$tmp" "$F"

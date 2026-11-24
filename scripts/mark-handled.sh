#!/usr/bin/env bash
# Uso: mark-handled.sh <thread-id> "<snippet>"
# Guarda el último mensaje atendido del hilo (el campo snippet del veredicto MENSAJE). El vigilante no
# vuelve a avisar por ese hilo hasta que llegue un mensaje con otro snippet.
set -eu
# shellcheck source=lib/env.sh
source "$(dirname "$0")/lib/env.sh"
[ $# -ge 2 ] || { echo "uso: mark-handled.sh <thread-id> \"<snippet>\"" >&2; exit 2; }
F="$INBOX_DIR/handled.json"; [ -f "$F" ] || echo '{}' > "$F"
tmp=$(mktemp); jq --arg k "$1" --arg v "$2" '.[$k]=$v' "$F" > "$tmp" && mv "$tmp" "$F"

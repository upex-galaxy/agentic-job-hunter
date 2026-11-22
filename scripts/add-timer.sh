#!/usr/bin/env bash
# Uso: add-timer.sh <thread-id> <horas> "<motivo>"   Reloj de seguimiento: el vigilante emite RELOJ al vencer.
set -eu
source "$(dirname "$0")/lib/env.sh"
F="$INBOX_DIR/timers.json"; [ -f "$F" ] || echo '[]' > "$F"
due=$(( $(NOW) + ${2:?horas} * 3600 ))
tmp=$(mktemp); jq --arg t "$1" --argjson d "$due" --arg r "${3:-seguimiento}" '. + [{thread:$t,due:$d,reason:$r}]' "$F" > "$tmp" && mv "$tmp" "$F"
echo "reloj para $1 en $2 h"

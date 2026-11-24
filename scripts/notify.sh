#!/usr/bin/env bash
# Notificación opt-in al dueño. Uso: notify.sh "<texto>"
# Canales activos: config/notify.json (copia de notify.example.json). Sin ese archivo, no hace nada.
# shellcheck source=lib/env.sh
source "$(dirname "$0")/lib/env.sh"
CFG="${JOBHUNTER_NOTIFY_CONFIG:-$ROOT/config/notify.json}"; [ -f "$CFG" ] || exit 0
MSG="${1:?uso: notify.sh \"<texto>\"}"
for ch in $(jq -r '.enabled[]' "$CFG"); do
  case "$ch" in
    file) p=$(jq -r '.file.path' "$CFG"); p="${p/#\~/$HOME}"; mkdir -p "$(dirname "$p")"; echo "$(date '+%F %T') $MSG" >> "$p" ;;
    osascript) osascript -e "display notification \"${MSG//\"/\\\"}\" with title \"Job Hunter\"" ;;
    slack) url="${JOBHUNTER_SLACK_WEBHOOK:-}"; [ -n "$url" ] && curl -s -X POST -H 'content-type: application/json' --data "$(jq -n --arg t "$MSG" '{text:$t}')" "$url" >/dev/null ;;
    whatsapp) [ -n "${JOBHUNTER_WHATSAPP_URL:-}" ] && curl -s -X POST -H "authorization: ${JOBHUNTER_WHATSAPP_TOKEN:-}" -H 'content-type: application/json' --data "$(jq -n --arg t "$MSG" --arg to "${JOBHUNTER_WHATSAPP_TO:-}" '{to:$to,text:$t}')" "$JOBHUNTER_WHATSAPP_URL" >/dev/null ;;
  esac
done
exit 0

#!/usr/bin/env bash
# Cierre de fin de día: baja el vigilante, cierra el navegador y mata el proceso del agente.
set -u
source "$(dirname "$0")/lib/env.sh"
echo "$(date '+%F %T') cierre" >> "$INBOX_DIR/watchdog.log"
pkill -f "wait-inbox.sh" 2>/dev/null
pkill -f "jobhunter-keepalive" 2>/dev/null
playwright-cli -s="$SESSION_NAME" close >/dev/null 2>&1
rm -f "$INBOX_DIR/watcher.alive" "$INBOX_DIR/working" "$INBOX_DIR/launched.at"
# Espera breve a que el agente termine su resumen del día y luego lo cierra.
sleep 5
pkill -f "$AGENT_PROCESS_PATTERN.*jobhunter-session" 2>/dev/null
exit 0

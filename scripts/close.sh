#!/usr/bin/env bash
# Cierre de fin de día: baja el vigilante, cierra el navegador y mata el proceso del agente.
# Uso: close.sh [--dry-run]   (--dry-run o JOBHUNTER_DRY_RUN=1 solo imprime lo que haría)
# Vigilante y keepalive se matan por PID (watcher.pid, keepalive.pid): solo los de esta carpeta de estado.
set -u
[ "${1:-}" = "--dry-run" ] && export JOBHUNTER_DRY_RUN=1
# shellcheck source=lib/env.sh
source "$(dirname "$0")/lib/env.sh"
echo "$(date '+%F %T') cierre" >> "$INBOX_DIR/watchdog.log"
for f in watcher.pid keepalive.pid; do
  pid=$(cat "$INBOX_DIR/$f" 2>/dev/null) || continue
  [ -n "$pid" ] && run kill "$pid" 2>/dev/null
  run rm -f "$INBOX_DIR/$f"
done
run playwright-cli -s="$SESSION_NAME" close >/dev/null 2>&1
run rm -f "$INBOX_DIR/watcher.alive" "$INBOX_DIR/working" "$INBOX_DIR/launched.at"
# Espera breve a que el agente termine su resumen del día y luego lo cierra.
[ "$DRY_RUN" = 1 ] || sleep "$CLOSE_WAIT"
run pkill -f "$AGENT_PROCESS_PATTERN.*jobhunter-session" 2>/dev/null
exit 0

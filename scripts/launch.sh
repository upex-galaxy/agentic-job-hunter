#!/usr/bin/env bash
# Arranca la sesión del agente si no hay una viva hoy. Pensado para scheduler (launchd/cron/Orca).
# Uso: launch.sh [--scheduled | --watchdog]
set -u
source "$(dirname "$0")/lib/env.sh"
MODE="${1:---scheduled}"
HOUR=$((10#$(date +%H)))
LAUNCHED="$INBOX_DIR/launched.at"
ALIVE="$INBOX_DIR/watcher.alive"
WORKING="$INBOX_DIR/working"
log() { echo "$(date '+%F %T') [$MODE] $*" >> "$INBOX_DIR/watchdog.log"; }

# Fuera de horario no se lanza nada.
if [ "$HOUR" -lt "$START_HOUR" ] || [ "$HOUR" -ge "$END_HOUR" ]; then log "fuera de horario"; exit 0; fi

# Un proceso del agente "vivo" es uno iniciado hoy; los de otro día son zombis.
alive_today=0
for pid in $(pgrep -f "$AGENT_PROCESS_PATTERN.*jobhunter-session" 2>/dev/null); do
  started=$(ps -o lstart= -p "$pid" 2>/dev/null | xargs -I{} date -j -f "%a %b %e %T %Y" "{}" +%F 2>/dev/null || date -d "$(ps -o lstart= -p "$pid")" +%F 2>/dev/null)
  if [ "$started" = "$(date +%F)" ]; then alive_today=1; else kill "$pid" 2>/dev/null; log "mato zombi $pid"; fi
done

if [ "$alive_today" = 1 ]; then
  # Guardia contra duplicados: sesión viva y vigilante con latido reciente o agente trabajando.
  if [ "$(file_age "$ALIVE")" -le "$BEAT_GRACE" ] || [ "$(file_age "$WORKING")" -le "$WORK_GRACE" ] || [ "$(file_age "$LAUNCHED")" -le "$STARTUP_GRACE" ]; then
    log "sesión viva, no hago nada"; exit 0
  fi
  log "sesión viva sin latido: el agente debe relanzar el vigilante"
  [ "$MODE" = "--watchdog" ] && echo "SESION_PERDIDA" >> "$INBOX_DIR/events.log"
  exit 0
fi

PROMPT="jobhunter-session: lee AGENTS.md y la skill recruiter-attention, abre el vigilante de bandeja y atiende los hilos nuevos."
CMD="${AGENT_CMD//\{PROMPT\}/$PROMPT}"
log "lanzo: $AGENT_CMD"
date +%s > "$LAUNCHED"
rm -f "$WORKING"
# Keepalive: algunos hosts cierran la terminal si no hay procesos hijos. Acaba solo.
( sleep 21600 # jobhunter-keepalive
) >/dev/null 2>&1 &
cd "$ROOT" && eval "$CMD"

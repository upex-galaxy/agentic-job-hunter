#!/usr/bin/env bash
# Arranca la sesión del agente si no hay una viva hoy. Pensado para scheduler (launchd/cron/Orca).
# Uso: launch.sh [--scheduled | --watchdog] [--dry-run]
# --dry-run (o JOBHUNTER_DRY_RUN=1) decide igual pero solo imprime lo que haría: no mata ni lanza nada.
set -u
MODE="--scheduled"
for a in "$@"; do
  case "$a" in
    --dry-run) export JOBHUNTER_DRY_RUN=1 ;;
    --scheduled|--watchdog) MODE="$a" ;;
    *) echo "uso: launch.sh [--scheduled | --watchdog] [--dry-run]" >&2; exit 2 ;;
  esac
done
# shellcheck source=lib/env.sh
source "$(dirname "$0")/lib/env.sh"
HOUR=$(HOUR_NOW)
LAUNCHED="$INBOX_DIR/launched.at"
ALIVE="$INBOX_DIR/watcher.alive"
WORKING="$INBOX_DIR/working"
log() { echo "$(date '+%F %T') [$MODE] $*" | tee -a "$INBOX_DIR/watchdog.log"; }

# Fuera de horario no se lanza nada.
if [ "$HOUR" -lt "$START_HOUR" ] || [ "$HOUR" -ge "$END_HOUR" ]; then log "fuera de horario"; exit 0; fi

# Fecha de inicio (AAAA-MM-DD) de un proceso, en macOS y en Linux.
started_on() {
  local ls; ls=$(ps -o lstart= -p "$1" 2>/dev/null) || return 1
  date -j -f "%a %b %e %T %Y" "$ls" +%F 2>/dev/null || date -d "$ls" +%F 2>/dev/null
}

# Un proceso del agente "vivo" es uno iniciado hoy; los de otro día son zombis.
alive_today=0
for pid in $(pgrep -f "$AGENT_PROCESS_PATTERN.*jobhunter-session" 2>/dev/null); do
  if [ "$(started_on "$pid")" = "$(date +%F)" ]; then alive_today=1; else run kill "$pid" 2>/dev/null; log "mato zombi $pid"; fi
done

if [ "$alive_today" = 1 ]; then
  # Guardia contra duplicados: sesión viva y vigilante con latido reciente o agente trabajando.
  if [ "$(file_age "$ALIVE")" -le "$BEAT_GRACE" ] || [ "$(file_age "$WORKING")" -le "$WORK_GRACE" ] || [ "$(file_age "$LAUNCHED")" -le "$STARTUP_GRACE" ]; then
    log "sesión viva, no hago nada"; exit 0
  fi
  log "sesión viva sin latido: el agente debe relanzar el vigilante"
  [ "$MODE" = "--watchdog" ] && echo "$(date '+%F %T') SESION_PERDIDA" >> "$INBOX_DIR/events.log"
  exit 0
fi

PROMPT="jobhunter-session: lee AGENTS.md y la skill recruiter-attention, abre el vigilante de bandeja y atiende los hilos nuevos."
CMD="${AGENT_CMD//\{PROMPT\}/$PROMPT}"
if [ "$DRY_RUN" = 1 ]; then log "dry-run: lanzaría: $CMD"; exit 0; fi
log "lanzo: $AGENT_CMD"
date +%s > "$LAUNCHED"
rm -f "$WORKING"
# Keepalive: algunos hosts cierran la terminal si no hay procesos hijos. Acaba solo; close.sh lo mata por PID.
( exec -a jobhunter-keepalive sleep 21600 ) >/dev/null 2>&1 &
echo $! > "$INBOX_DIR/keepalive.pid"
cd "$ROOT" && eval "$CMD"

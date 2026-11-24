#!/usr/bin/env bash
# Carga rutas y horario. Se hace `source` desde los demás scripts.
# Variables para pruebas sin navegador ni reloj real (ver docs/testing.md):
#   JOBHUNTER_STATE_DIR, JOBHUNTER_SCHEDULE, JOBHUNTER_FAKE_INBOX, JOBHUNTER_FAKE_HOUR, JOBHUNTER_DRY_RUN=1
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="${JOBHUNTER_STATE_DIR:-$HOME/.agentic-job-hunter}"
STATE_DIR="${STATE_DIR/#\~/$HOME}"
INBOX_DIR="$STATE_DIR/inbox"
PROFILE_DIR="${JOBHUNTER_PROFILE_DIR:-$STATE_DIR/playwright-profiles/linkedin}"
SESSION_NAME="${JOBHUNTER_SESSION:-linkedin}"
SELECTORS="${JOBHUNTER_SELECTORS:-$ROOT/config/selectors.json}"
DRY_RUN="${JOBHUNTER_DRY_RUN:-0}"
mkdir -p "$INBOX_DIR"
# Valores por defecto; config/schedule.conf los pisa. Las variables se usan en los scripts que hacen source.
# shellcheck disable=SC2034
{
START_HOUR=7; END_HOUR=21; POLL_MIN_SECONDS=180; POLL_MAX_SECONDS=420; MAX_WAIT_SECONDS=6600
BEAT_GRACE=180; WORK_GRACE=1800; STARTUP_GRACE=900; WORKING_SLEEP=20; PAUSE_SLEEP=600; CLOSE_WAIT=5
AGENT_CMD='claude "{PROMPT}"'; AGENT_PROCESS_PATTERN='claude'
}
# shellcheck disable=SC1090
[ -f "${JOBHUNTER_SCHEDULE:-$ROOT/config/schedule.conf}" ] && source "${JOBHUNTER_SCHEDULE:-$ROOT/config/schedule.conf}"
NOW() { date +%s; }
HOUR_NOW() { echo "${JOBHUNTER_FAKE_HOUR:-$((10#$(date +%H)))}"; }
file_age() { if [ -f "$1" ]; then echo $(( $(NOW) - $(stat -f %m "$1" 2>/dev/null || stat -c %Y "$1") )); else echo 999999; fi; }
# Ejecuta un comando, o solo lo muestra con JOBHUNTER_DRY_RUN=1 / --dry-run.
run() { if [ "$DRY_RUN" = 1 ]; then echo "dry-run: $*"; else "$@"; fi; }

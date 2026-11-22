#!/usr/bin/env bash
# Carga rutas y horario. Se hace `source` desde los demás scripts.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="${JOBHUNTER_STATE_DIR:-$HOME/.agentic-job-hunter}"
STATE_DIR="${STATE_DIR/#\~/$HOME}"
INBOX_DIR="$STATE_DIR/inbox"
PROFILE_DIR="${JOBHUNTER_PROFILE_DIR:-$STATE_DIR/playwright-profiles/linkedin}"
SESSION_NAME="${JOBHUNTER_SESSION:-linkedin}"
mkdir -p "$INBOX_DIR"
# Valores por defecto; config/schedule.conf los pisa.
START_HOUR=7; END_HOUR=21; POLL_MIN_SECONDS=180; POLL_MAX_SECONDS=420; MAX_WAIT_SECONDS=6600
BEAT_GRACE=180; WORK_GRACE=1800; STARTUP_GRACE=900
AGENT_CMD='claude "{PROMPT}"'; AGENT_PROCESS_PATTERN='claude'
# shellcheck disable=SC1091
[ -f "${JOBHUNTER_SCHEDULE:-$ROOT/config/schedule.conf}" ] && source "${JOBHUNTER_SCHEDULE:-$ROOT/config/schedule.conf}"
NOW() { date +%s; }
file_age() { [ -f "$1" ] && echo $(( $(NOW) - $(stat -f %m "$1" 2>/dev/null || stat -c %Y "$1") )) || echo 999999; }

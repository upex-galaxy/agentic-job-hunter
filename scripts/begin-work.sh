#!/usr/bin/env bash
# El agente va a atender un hilo: el vigilante se pausa mientras exista este archivo.
source "$(dirname "$0")/lib/env.sh"; date +%s > "$INBOX_DIR/working"

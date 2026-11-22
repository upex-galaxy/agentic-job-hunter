#!/usr/bin/env bash
# Vigilante de bandeja. Bloquea sin gastar tokens, lee /messaging/ con playwright-cli y termina
# con UNA línea "VERDICT {json}". El agente la atiende y relanza el vigilante.
# Veredictos: MENSAJE PENDIENTE RELOJ LATIDO FIN_DEL_DIA SESION_PERDIDA ERROR
set -u
source "$(dirname "$0")/lib/env.sh"
ALIVE="$INBOX_DIR/watcher.alive"; WORKING="$INBOX_DIR/working"
HANDLED="$INBOX_DIR/handled.json"; TIMERS="$INBOX_DIR/timers.json"; PAUSE="$INBOX_DIR/paused.until"
PENDING="$INBOX_DIR/pending.json"; PENDING_SEEN="$INBOX_DIR/pending.seen"
[ -f "$HANDLED" ] || echo '{}' > "$HANDLED"
[ -f "$TIMERS" ] || echo '[]' > "$TIMERS"

verdict() { # tipo, json extra
  rm -f "$ALIVE"
  extra="${2:-}"; [ -n "$extra" ] || extra='{}'
  echo "VERDICT $(jq -nc --arg v "$1" --argjson d "$extra" '{verdict:$v} + $d')"
  exit 0
}

# Guardia contra duplicados: si otro vigilante dejó un latido fresco, este no arranca.
if [ "$(file_age "$ALIVE")" -le "$BEAT_GRACE" ]; then
  echo '{"verdict":"ERROR","reason":"vigilante duplicado (watcher.alive reciente)"}' | sed 's/^/VERDICT /'
  exit 0
fi

# Lee la bandeja: imprime un JSON [{id,name,snippet,unread}] o falla.
read_inbox() {
  playwright-cli -s="$SESSION_NAME" goto "https://www.linkedin.com/messaging/" >/dev/null 2>&1 || return 1
  playwright-cli -s="$SESSION_NAME" --raw eval "JSON.stringify([...document.querySelectorAll('li.msg-conversation-listitem')].map(li=>({id:(li.querySelector('a[href*=\"/messaging/thread/\"]')||{}).href||'',name:(li.querySelector('.msg-conversation-listitem__participant-names')||{}).innerText||'',snippet:(li.querySelector('.msg-conversation-card__message-snippet')||{}).innerText||'',unread:!!li.querySelector('.notification-badge--show')})))" 2>/dev/null
}

start=$(NOW)
while true; do
  touch "$ALIVE"
  now=$(NOW); hour=$((10#$(date +%H)))
  [ "$hour" -ge "$END_HOUR" ] && verdict FIN_DEL_DIA

  # Pausa por aviso de restricción: no se lee nada hasta que venza.
  if [ -f "$PAUSE" ] && [ "$now" -lt "$(cat "$PAUSE")" ]; then sleep 600; continue; fi

  # El agente está trabajando: no se lee la bandeja (evita pisar su navegador).
  if [ -f "$WORKING" ]; then
    [ "$(file_age "$WORKING")" -gt "$WORK_GRACE" ] && verdict SESION_PERDIDA '{"reason":"working vencido"}'
    sleep 20; continue
  fi

  # Relojes de seguimiento vencidos.
  due=$(jq -c --argjson n "$now" '[.[]|select(.due<=$n)]|first // empty' "$TIMERS")
  if [ -n "$due" ]; then
    jq --argjson n "$now" '[.[]|select(.due>$n)]' "$TIMERS" > "$TIMERS.tmp" && mv "$TIMERS.tmp" "$TIMERS"
    verdict RELOJ "$due"
  fi

  if inbox=$(read_inbox) && [ -n "$inbox" ]; then
    # Primer hilo no leído y no atendido con el mismo snippet.
    msg=$(echo "$inbox" | jq -c --slurpfile h "$HANDLED" '[.[]|select(.unread and ($h[0][.id] // "") != .snippet)]|first // empty' 2>/dev/null)
    [ -n "$msg" ] && verdict MENSAJE "$msg"
    # Hilos que esperan una decisión del dueño (los registra mark-pending.sh). Se avisa una vez por hora.
    if [ -s "$PENDING" ] && [ "$(jq 'length' "$PENDING")" -gt 0 ] && [ "$(file_age "$PENDING_SEEN")" -gt 3600 ]; then
      touch "$PENDING_SEEN"; verdict PENDIENTE "$(jq -c '{pending: .}' "$PENDING")"
    fi
    errs=0
  else
    errs=$(( ${errs:-0} + 1 ))
    [ "$errs" -ge 3 ] && verdict ERROR '{"reason":"no se pudo leer la bandeja (sesión caída o login vencido)"}'
  fi

  [ $(( $(NOW) - start )) -ge "$MAX_WAIT_SECONDS" ] && verdict LATIDO
  span=$(( POLL_MAX_SECONDS - POLL_MIN_SECONDS + 1 ))
  sleep $(( POLL_MIN_SECONDS + RANDOM % span ))
done

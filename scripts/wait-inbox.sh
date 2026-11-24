#!/usr/bin/env bash
# Vigilante de bandeja. Bloquea sin gastar tokens, lee /messaging/ con playwright-cli y termina
# con UNA línea "VERDICT {json}". El agente la atiende y relanza el vigilante.
# Veredictos: MENSAJE PENDIENTE RELOJ LATIDO FIN_DEL_DIA SESION_PERDIDA ERROR
# Prueba sin navegador: JOBHUNTER_FAKE_INBOX=<archivo.json> (ver docs/testing.md).
set -u
# shellcheck source=lib/env.sh
source "$(dirname "$0")/lib/env.sh"
ALIVE="$INBOX_DIR/watcher.alive"; WORKING="$INBOX_DIR/working"
HANDLED="$INBOX_DIR/handled.json"; TIMERS="$INBOX_DIR/timers.json"; PAUSE="$INBOX_DIR/paused.until"
PENDING="$INBOX_DIR/pending.json"; PENDING_SEEN="$INBOX_DIR/pending.seen"; PIDFILE="$INBOX_DIR/watcher.pid"
[ -f "$HANDLED" ] || echo '{}' > "$HANDLED"
[ -f "$TIMERS" ] || echo '[]' > "$TIMERS"

verdict() { # tipo, json extra
  rm -f "$ALIVE" "$PIDFILE"
  extra="${2:-}"; [ -n "$extra" ] || extra='{}'
  echo "VERDICT $(jq -nc --arg v "$1" --argjson d "$extra" '{verdict:$v} + $d')"
  exit 0
}

# Guardia contra duplicados: si otro vigilante dejó un latido fresco, este no arranca (y no borra su latido).
if [ "$(file_age "$ALIVE")" -le "$BEAT_GRACE" ]; then
  echo 'VERDICT {"verdict":"ERROR","reason":"vigilante duplicado (watcher.alive reciente)"}'
  exit 0
fi

# Lee la bandeja: imprime un JSON [{id,name,snippet,unread}], o "null" si LinkedIn pide login, o falla.
# Los selectores viven en config/selectors.json: LinkedIn cambia el HTML y hay que validarlos con login real.
read_inbox() {
  if [ -n "${JOBHUNTER_FAKE_INBOX:-}" ]; then cat "$JOBHUNTER_FAKE_INBOX" 2>/dev/null; return; fi
  local sel url js
  sel=$(jq -c 'del(._comment)' "$SELECTORS" 2>/dev/null) || return 1
  url=$(jq -r '.inbox_url' <<<"$sel")
  js="(()=>{const s=$sel;if(s.login_path_patterns.some(p=>location.pathname.startsWith(p)))return 'null';const t=(el,q)=>((el.querySelector(q)||{}).innerText||'').trim();return JSON.stringify([...document.querySelectorAll(s.conversation_item)].map(li=>({id:(li.querySelector(s.thread_link)||{}).href||'',name:t(li,s.participant_name),snippet:t(li,s.message_snippet),unread:!!li.querySelector(s.unread_badge)})))})()"
  playwright-cli -s="$SESSION_NAME" goto "$url" >/dev/null 2>&1 || return 1
  playwright-cli -s="$SESSION_NAME" --raw eval "$js" 2>/dev/null
}

# Espera, salvo que ya se haya cumplido el tope: entonces emite LATIDO para que el agente renueve el vigilante.
idle() {
  [ $(( $(NOW) - start )) -ge "$MAX_WAIT_SECONDS" ] && verdict LATIDO
  sleep "$1"
}

# El PID permite a close.sh bajar solo este vigilante (el de esta carpeta de estado).
echo $$ > "$PIDFILE"
start=$(NOW); errs=0
while true; do
  touch "$ALIVE"
  now=$(NOW)
  [ "$(HOUR_NOW)" -ge "$END_HOUR" ] && verdict FIN_DEL_DIA

  # Pausa por aviso de restricción: no se lee nada hasta que venza.
  if [ -f "$PAUSE" ] && [ "$now" -lt "$(cat "$PAUSE")" ]; then idle "$PAUSE_SLEEP"; continue; fi

  # El agente está trabajando: no se lee la bandeja (evita pisar su navegador).
  if [ -f "$WORKING" ]; then
    [ "$(file_age "$WORKING")" -gt "$WORK_GRACE" ] && verdict SESION_PERDIDA '{"reason":"working vencido"}'
    idle "$WORKING_SLEEP"; continue
  fi

  # Relojes de seguimiento vencidos.
  due=$(jq -c --argjson n "$now" '[.[]|select(.due<=$n)]|first // empty' "$TIMERS")
  if [ -n "$due" ]; then
    jq --argjson n "$now" '[.[]|select(.due>$n)]' "$TIMERS" > "$TIMERS.tmp" && mv "$TIMERS.tmp" "$TIMERS"
    verdict RELOJ "$due"
  fi

  inbox=$(read_inbox) || inbox=""
  if [ "$inbox" = "null" ]; then
    verdict ERROR '{"reason":"login vencido: LinkedIn muestra la pantalla de login"}'
  elif [ -n "$inbox" ] && jq -e 'type=="array"' >/dev/null 2>&1 <<<"$inbox"; then
    errs=0
    # Primer hilo no leído cuyo último mensaje (snippet) no se atendió ya.
    msg=$(jq -c --slurpfile h "$HANDLED" '[.[]|select(.unread and ($h[0][.id] // "") != .snippet)]|first // empty' <<<"$inbox")
    [ -n "$msg" ] && verdict MENSAJE "$msg"
    # Hilos que esperan una decisión del dueño (los registra mark-pending.sh). Se avisa una vez por hora.
    if [ -s "$PENDING" ] && [ "$(jq 'length' "$PENDING")" -gt 0 ] && [ "$(file_age "$PENDING_SEEN")" -gt 3600 ]; then
      touch "$PENDING_SEEN"; verdict PENDIENTE "$(jq -c '{pending: .}' "$PENDING")"
    fi
  else
    errs=$(( errs + 1 ))
    [ "$errs" -ge 3 ] && verdict ERROR '{"reason":"no se pudo leer la bandeja (sesión caída, selectores obsoletos o login vencido)"}'
  fi

  span=$(( POLL_MAX_SECONDS - POLL_MIN_SECONDS + 1 ))
  idle $(( POLL_MIN_SECONDS + RANDOM % span ))
done

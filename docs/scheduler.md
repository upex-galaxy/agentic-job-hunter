# Scheduler

El horario vive en `config/schedule.conf` (arranque 7:00, vigilante cada 10 minutos, fin a las 21:00). `scripts/launch.sh` ignora cualquier ejecución fuera de ese horario, así que el scheduler puede llamarlo a cualquier hora.

Cada ejecución de `launch.sh` decide sola:

- Sesión viva hoy con latido reciente en `watcher.alive` (o `working` activo): no hace nada. Esa es la guardia contra duplicados.
- Procesos del agente iniciados otro día: los mata.
- Ninguna sesión viva: lanza `AGENT_CMD` (configurable) y deja un keepalive.

`scripts/close.sh` cierra el día. El agente lo ejecuta al recibir `FIN_DEL_DIA`; prográmalo también como respaldo a las 21:10.

Antes de programar nada, comprueba qué haría con `scripts/launch.sh --watchdog --dry-run` y `scripts/close.sh --dry-run`.

## El agente necesita una terminal

launchd y cron no tienen terminal. Un agente interactivo (`claude "..."`, `codex "..."`, `opencode`, `pi`) lanzado directamente desde ellos no tiene dónde dibujar su interfaz. Haz que `AGENT_CMD` abra la sesión dentro de una terminal. Dos opciones, a elegir en `config/schedule.conf`:

```bash
# tmux (macOS y Linux): la sesión queda en segundo plano; entra con `tmux attach -t jobhunter`
AGENT_CMD='tmux new-session -d -s jobhunter "claude \"{PROMPT}\""'
# Terminal.app (macOS): abre una ventana nueva
AGENT_CMD='osascript -e "tell application \"Terminal\" to do script \"cd $ROOT && claude \\\"{PROMPT}\\\"\""'
```

`AGENT_PROCESS_PATTERN` sigue siendo el nombre del binario del agente (`claude`, `codex`...): `launch.sh` busca un proceso que lo contenga junto a `jobhunter-session`, la marca que lleva el prompt. Si lanzas `launch.sh` a mano desde una terminal, el valor por defecto (`claude "{PROMPT}"`) funciona tal cual.

## Generar las plantillas

Las plantillas viven en `scripts/scheduler/` con dos marcadores, `__REPO__` y `__HOME__`. `render.sh` los reemplaza por las rutas de tu máquina, escribe el resultado en la carpeta que le digas y valida los plist con `plutil -lint` si existe. No instala nada.

```bash
scripts/scheduler/render.sh /tmp/jobhunter-scheduler
```

| Archivo | Cuándo corre | Comando |
|---|---|---|
| `com.agentic-job-hunter.start.plist` | 7:00 | `launch.sh --scheduled` |
| `com.agentic-job-hunter.watchdog.plist` | cada 600 s | `launch.sh --watchdog` |
| `com.agentic-job-hunter.close.plist` | 21:10 | `close.sh` |
| `crontab.txt` | lo mismo, en formato cron | |

Si cambias `START_HOUR`, `END_HOUR` o `WATCHDOG_MINUTES` en `config/schedule.conf`, cambia también las horas de las plantillas.

## launchd (macOS)

Plantilla del arranque, tal como queda tras `render.sh` (con tu ruta en lugar de `/ruta/al/repo` y tu home en lugar de `/Users/tu-usuario`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.agentic-job-hunter.start</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/ruta/al/repo/scripts/launch.sh</string>
    <string>--scheduled</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>0</integer></dict>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/Users/tu-usuario/.bun/bin:/Users/tu-usuario/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>/tmp/agentic-job-hunter.start.log</string>
  <key>StandardErrorPath</key><string>/tmp/agentic-job-hunter.start.log</string>
</dict>
</plist>
```

El de la vigía cambia `--scheduled` por `--watchdog` y `StartCalendarInterval` por `<key>StartInterval</key><integer>600</integer>`. El de cierre llama a `close.sh` sin argumentos a las 21:10.

Instalar y cargar:

```bash
scripts/scheduler/render.sh ~/Library/LaunchAgents
for n in start watchdog close; do
  launchctl load ~/Library/LaunchAgents/com.agentic-job-hunter.$n.plist
done
```

`render.sh` también escribe `crontab.txt` en esa carpeta; bórralo de ahí si no lo usas. Descargar: `launchctl unload ~/Library/LaunchAgents/com.agentic-job-hunter.<n>.plist`. launchd no hereda tu entorno: si tu agente necesita variables, ponlas en el plist (`EnvironmentVariables`), nunca en el repo.

## cron (Linux y macOS)

`crontab.txt` tras `render.sh`:

```cron
PATH=/home/tu-usuario/.bun/bin:/home/tu-usuario/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin
0 7 * * *       /bin/bash /ruta/al/repo/scripts/launch.sh --scheduled >> /tmp/agentic-job-hunter.cron.log 2>&1
*/10 7-20 * * * /bin/bash /ruta/al/repo/scripts/launch.sh --watchdog >> /tmp/agentic-job-hunter.cron.log 2>&1
10 21 * * *     /bin/bash /ruta/al/repo/scripts/close.sh >> /tmp/agentic-job-hunter.cron.log 2>&1
```

Pégalo con `crontab -e`. Si `claude`, `bun`, `jq` o `playwright-cli` están en otra carpeta, ajusta la línea `PATH`.

## Orca (opcional)

Si usas Orca, crea dos automatizaciones con los mismos comandos: una diaria a las 7:00 que ejecute `scripts/launch.sh --scheduled` y otra cada 10 minutos entre 7 y 21 que ejecute `scripts/launch.sh --watchdog`. Para que no abran una sesión propia, haz que el comando termine con código distinto de cero y deja que `launch.sh` arranque el agente.

## Terminal sin cierre

Algunos hosts cierran la terminal si no hay procesos en marcha. `launch.sh` arranca un `sleep` de 6 horas llamado `jobhunter-keepalive`, guarda su PID en `keepalive.pid` y `close.sh` lo mata por PID (igual que al vigilante, con `watcher.pid`). Así solo se cierran los procesos de tu carpeta de estado.

## Cómo comprobar

```bash
tail -f ~/.agentic-job-hunter/inbox/watchdog.log
ls -l ~/.agentic-job-hunter/inbox/watcher.alive
```

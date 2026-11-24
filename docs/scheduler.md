# Scheduler

El horario vive en `config/schedule.conf` (arranque 7:00, vigilante cada 10 minutos, fin a las 21:00). `scripts/launch.sh` ignora cualquier ejecución fuera de ese horario, así que el scheduler puede llamarlo a cualquier hora.

Cada ejecución de `launch.sh` decide sola:

- Sesión viva hoy con latido reciente en `watcher.alive` (o `working` activo): no hace nada. Esa es la guardia contra duplicados.
- Procesos del agente iniciados otro día: los mata.
- Ninguna sesión viva: lanza `AGENT_CMD` (configurable) y deja un keepalive.

`scripts/close.sh` cierra el día. El agente lo ejecuta al recibir `FIN_DEL_DIA`; puedes programarlo también como respaldo a las 21:10.

## launchd (macOS)

```bash
REPO="$(pwd)"
for n in start watchdog; do
  sed "s#__REPO__#$REPO#g" scripts/scheduler/com.agentic-job-hunter.$n.plist \
    > ~/Library/LaunchAgents/com.agentic-job-hunter.$n.plist
  launchctl load ~/Library/LaunchAgents/com.agentic-job-hunter.$n.plist
done
```

Descargar: `launchctl unload ~/Library/LaunchAgents/com.agentic-job-hunter.<n>.plist`. launchd no hereda tu entorno: si tu agente necesita variables, ponlas en el plist (`EnvironmentVariables`) y no en el repo.

## cron (Linux y macOS)

```cron
0 7 * * *       /bin/bash /ruta/al/repo/scripts/launch.sh --scheduled
*/10 7-20 * * * /bin/bash /ruta/al/repo/scripts/launch.sh --watchdog
10 21 * * *     /bin/bash /ruta/al/repo/scripts/close.sh
```

Si `claude`, `bun` o `playwright-cli` no están en el `PATH` mínimo de cron, agrega una línea `PATH=...` al principio del crontab.

## Orca (opcional)

Si usas Orca, crea dos automatizaciones con los mismos comandos: una diaria a las 7:00 que ejecute `scripts/launch.sh --scheduled` y otra cada 10 minutos entre 7 y 21 que ejecute `scripts/launch.sh --watchdog`. Para que no abran una sesión propia, haz que el comando termine con código distinto de cero y deja que `launch.sh` arranque el agente.

## Terminal sin cierre

Algunos hosts cierran la terminal si no hay procesos en marcha. `launch.sh` arranca un `sleep` de 6 horas llamado `jobhunter-keepalive`, guarda su PID en `keepalive.pid` y `close.sh` lo mata por PID (igual que al vigilante, con `watcher.pid`). Así solo se cierran los procesos de tu carpeta de estado.

## Cómo comprobar

```bash
tail -f ~/.agentic-job-hunter/inbox/watchdog.log
ls -l ~/.agentic-job-hunter/inbox/watcher.alive
```

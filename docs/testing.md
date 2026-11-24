# Pruebas sin LinkedIn

`bun test` prueba el CLI, el panel, el setup no interactivo y los scripts de bash sin abrir el navegador ni lanzar un agente real. Estas variables permiten repetir lo mismo a mano:

| Variable | Efecto |
|---|---|
| `JOBHUNTER_STATE_DIR` | Carpeta de estado (por defecto `~/.agentic-job-hunter`). Usa una temporal |
| `JOBHUNTER_FAKE_INBOX` | Archivo JSON que reemplaza la lectura de la bandeja: `[{"id","name","snippet","unread"}]`, `null` simula la pantalla de login y un archivo ausente o inválido cuenta como lectura fallida |
| `JOBHUNTER_FAKE_HOUR` | Hora (0-23) que ven `launch.sh` y el vigilante |
| `JOBHUNTER_SCHEDULE` | Otro `schedule.conf`; con `POLL_*_SECONDS=0` el vigilante no espera |
| `JOBHUNTER_DRY_RUN=1` | `launch.sh` y `close.sh` solo imprimen lo que harían (igual que `--dry-run`) |
| `JOBHUNTER_SESSION` | Nombre de la sesión de `playwright-cli` (por defecto `linkedin`) |
| `JOBHUNTER_NOTIFY_CONFIG` | Otro `notify.json` |

Ejemplo, un veredicto `MENSAJE`:

```bash
export JOBHUNTER_STATE_DIR=$(mktemp -d) JOBHUNTER_FAKE_HOUR=10
echo '[{"id":"t1","name":"Ana","snippet":"hola","unread":true}]' > /tmp/inbox.json
JOBHUNTER_FAKE_INBOX=/tmp/inbox.json scripts/wait-inbox.sh
# VERDICT {"verdict":"MENSAJE","id":"t1","name":"Ana","snippet":"hola","unread":true}
scripts/launch.sh --watchdog --dry-run
```

El generador de CV necesita `python-docx` en un venv local. Con `.venv/bin/python` presente, `bun test` también genera un CV desde `tests/fixtures/profile.example.json` y lo vuelve a abrir; sin venv esa prueba se salta.

```bash
python3 -m venv .venv && .venv/bin/pip install -r .agents/skills/cv-tuning/scripts/requirements.txt
```

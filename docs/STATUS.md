# Estado de verificación

Última revisión: noviembre de 2026, en macOS con Bun 1.4 y Python 3.9. Lo que figura como verificado tiene una prueba en `bun test` o se ejecutó a mano sin cuenta de LinkedIn.

## Verificado

| Pieza | Cómo |
|---|---|
| CLI `bun run jobs` | `tests/jobs.test.ts`: altas, etapas inválidas, notas, log, plantillas |
| API del panel | `tests/jobs.test.ts`: `PATCH /stage` (válido, etapa inválida, id inexistente, JSON roto), `POST /notes`, 404 |
| `bun run setup` | `tests/setup.test.ts` en modo `--yes`, con variables `JOBHUNTER_SETUP_*` y sin terminal, sobre una copia del repo y con `HOME` temporal. El modo interactivo se probó a mano con una pseudo terminal |
| Vigilante `wait-inbox.sh` | `tests/scripts.test.ts` con `JOBHUNTER_FAKE_INBOX`: `MENSAJE`, `PENDIENTE`, `RELOJ`, `LATIDO`, `FIN_DEL_DIA`, `SESION_PERDIDA` y `ERROR` (lecturas fallidas, login, vigilante duplicado) |
| JS de lectura de la bandeja | Un `playwright-cli` falso captura el JS generado desde `config/selectors.json`, que se ejecuta contra un DOM mínimo |
| `launch.sh` y `close.sh` | `--dry-run`, fuera de horario, lanzamiento de un agente falso, guardia contra duplicados y cierre por PID. También con el entorno mínimo de launchd (`env -i`) |
| Relojes, pendientes, `notify.sh` (canal `file`) | `tests/scripts.test.ts` |
| `build_cv.py` | `tests/cv.test.ts` con el venv local: CV desde la plantilla vacía y desde `tests/fixtures/`, reabierto con python-docx; corte por `never_include` |
| Plantillas launchd y cron | `scripts/scheduler/render.sh` y `plutil -lint` |
| `agents:setup` y `agents:compat` | `tests/agents.test.ts` y un clon limpio. Codex: `codex debug prompt-input` muestra `AGENTS.md` y las cuatro skills. OpenCode: `opencode debug config` carga `AGENTS.md`. Pi ve las cuatro skills de `.agents/skills`. Claude Code: `CLAUDE.md` importa `AGENTS.md` y `.claude/skills` enlaza al store |
| Scripts de bash | `bash -n` en todos los `.sh` |

## Requiere login real de LinkedIn (sin verificar)

- **Selectores de la bandeja** (`config/selectors.json`, `validated: false`). Son una suposición y LinkedIn cambia el HTML. Pasos en `docs/selectors.md`.
- Login manual con `bun run setup` y el perfil persistente de `playwright-cli`.
- La salida de `playwright-cli --raw eval` con una página real (se asume que imprime el texto sin comillas).
- Leer un hilo, escribir y enviar un mensaje (skill `linkedin-browser`).
- Detección de avisos de restricción y la pausa de 7 días con una página real.

## Sin verificar por otros motivos

- Una sesión completa con un agente real (Claude Code, Codex, OpenCode o Pi) atendiendo la bandeja: necesita LinkedIn y consume la cuenta del modelo.
- launchd y cron cargados de verdad, y `AGENT_CMD` dentro de tmux o Terminal.app (el entrecomillado se comprobó, la ejecución no).
- `shellcheck`: no estaba instalado en la máquina de prueba.
- Conversión a PDF con LibreOffice.
- Canales `osascript`, `slack` y `whatsapp` de `notify.sh`, y la skill `interview-scheduling` con Google Calendar.
- `launch.sh` en Linux (la fecha de inicio de procesos usa `date -d` como alternativa a la de macOS).

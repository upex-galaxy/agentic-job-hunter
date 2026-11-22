# MCPs y notificaciones

## MCPs

| Servidor | Para qué | Necesario |
|---|---|---|
| Playwright (vía `playwright-cli`) | Leer y escribir en LinkedIn | Sí |
| Google Calendar | Libre u ocupado y crear el evento de entrevista (`interview-scheduling`) | Opcional |
| Gmail | Enviar el CV por correo cuando el reclutador lo pida | Opcional |

No uses ningún MCP o API que scrapee LinkedIn: es más fácil que restrinjan la cuenta. Las credenciales de cada MCP se configuran en tu agente (no en este repo). Un 401 o 403 significa que falta o venció la credencial: corrígela y reinicia la sesión.

## Notificaciones

Todas son opt-in. `bun run setup` crea `config/notify.json` (ignorado por git) a partir de `config/notify.example.json`. `scripts/notify.sh "<texto>"` envía a cada canal de la lista `enabled`.

| Canal | Qué hace | Configuración |
|---|---|---|
| `file` | Añade una línea a `~/.agentic-job-hunter/notifications.log` | ninguna |
| `osascript` | Notificación de macOS | ninguna |
| `slack` | POST a un webhook entrante | variable `JOBHUNTER_SLACK_WEBHOOK` |
| `whatsapp` | POST a una pasarela HTTP que tú elijas | `JOBHUNTER_WHATSAPP_URL`, `_TOKEN` y `_TO` |

Los valores secretos van en variables de entorno o en un `.env` local, nunca en `notify.json`. Sin `notify.json`, no se envía nada.

Un aviso es la única forma de que el agente te pida aprobación fuera de la sesión: con `ask_before_send` conviene activar al menos `file` u `osascript`.

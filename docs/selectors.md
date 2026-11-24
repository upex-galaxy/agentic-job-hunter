# Selectores de la bandeja de LinkedIn

`scripts/wait-inbox.sh` lee la lista de conversaciones de `/messaging/` con los selectores CSS de `config/selectors.json`. **LinkedIn cambia su HTML sin aviso**, así que esos selectores son una suposición hasta que alguien los valide con una sesión real. El campo `validated` del archivo queda en `false` hasta entonces.

| Clave | Qué busca |
|---|---|
| `conversation_item` | Cada conversación de la lista |
| `thread_link` | El enlace al hilo; su `href` es el `id` del veredicto |
| `participant_name` | Nombre de quien escribe |
| `message_snippet` | Vista previa del último mensaje; sirve para no repetir un aviso |
| `unread_badge` | Marca de no leído |
| `login_path_patterns` | Rutas que significan sesión vencida; el vigilante emite `ERROR` de login |

## Cómo validarlos

Hazlo tú, con tu cuenta y a mano, después de `bun run setup`:

1. Abre la sesión del agente: `playwright-cli -s=linkedin open https://www.linkedin.com/messaging/ --headed --profile="$HOME/.agentic-job-hunter/playwright-profiles/linkedin"`.
2. Cuenta cuántas conversaciones ves y cuántas tienen la marca de no leído.
3. Prueba cada selector:

   ```bash
   playwright-cli -s=linkedin --raw eval "document.querySelectorAll('li.msg-conversation-listitem').length"
   ```

4. Si un número no coincide con lo que ves, usa `playwright-cli -s=linkedin snapshot` o las herramientas de desarrollo del navegador para encontrar el selector nuevo y cámbialo en `config/selectors.json`.
5. Cierra con `playwright-cli -s=linkedin close`. Cuando los cinco selectores coinciden, pon `"validated": true`.

Un selector roto no rompe nada visible: la lista llega vacía y el vigilante emite `LATIDO` sin avisar de mensajes nuevos. Si tu bandeja tiene mensajes sin leer y el agente no los ve, revisa primero este archivo.

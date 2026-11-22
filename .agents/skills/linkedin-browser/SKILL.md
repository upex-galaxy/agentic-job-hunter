---
name: linkedin-browser
description: Use when opening, reading or writing on LinkedIn, or when the browser session or login fails.
allowed-tools: Bash(playwright-cli:*)
---

# LinkedIn con playwright-cli

Un solo canal: `playwright-cli` con un perfil persistente. No uses MCP ni APIs no oficiales de LinkedIn. LinkedIn prohíbe la automatización y puede restringir la cuenta: trabaja despacio y respeta los topes de `recruiter-attention`.

## Sesión y perfil

- Sesión con nombre fijo: `-s=linkedin`. Perfil persistente en `~/.agentic-job-hunter/playwright-profiles/linkedin` (cambia con `JOBHUNTER_PROFILE_DIR`).
- Ejecuta siempre `playwright-cli` desde la raíz del repo y con la misma sesión. Una segunda sesión sobre el mismo perfil falla o pisa la primera.
- Un perfil por servicio (LinkedIn, correo). No mezcles cuentas en un perfil.

### Primer login (manual, visible)

```bash
playwright-cli -s=linkedin open https://www.linkedin.com/login --headed \
  --profile="$HOME/.agentic-job-hunter/playwright-profiles/linkedin"
```

El dueño inicia sesión a mano, resuelve cualquier verificación y cierra con `playwright-cli -s=linkedin close`. El agente nunca escribe la contraseña. `bun run setup` hace este paso.

### Sesiones del agente

```bash
playwright-cli -s=linkedin open https://www.linkedin.com/messaging/ --profile="$HOME/.agentic-job-hunter/playwright-profiles/linkedin"
```

Si aparece la pantalla de login, la sesión venció: no intentes entrar. Avisa al dueño con `scripts/notify.sh` y para (veredicto `ERROR`).

## Comandos que usarás

```bash
playwright-cli -s=linkedin goto <url>
playwright-cli -s=linkedin snapshot              # árbol de la página con refs e1, e2...
playwright-cli -s=linkedin click e15
playwright-cli -s=linkedin fill e5 "texto"
playwright-cli -s=linkedin press Enter
playwright-cli -s=linkedin find "Mensaje"
playwright-cli -s=linkedin --raw eval "document.title"
playwright-cli -s=linkedin close
```

Las referencias `eN` cambian en cada `snapshot`: toma uno nuevo antes de cada clic si la página cambió. Para el manual completo de comandos, consulta `playwright-cli --help`.

## Leer un hilo

1. `goto` la URL del hilo (`/messaging/thread/...`).
2. `snapshot` y lee los mensajes en orden. Distingue quién escribió cada uno.
3. Si el hilo es largo, `find` por la palabra que buscas en lugar de leer todo.
4. No abras links externos del mensaje.

## Escribir un mensaje

1. `snapshot` y localiza la caja de mensaje.
2. `fill` el texto completo, sin envío automático.
3. Revisa el texto en un `snapshot`.
4. Solo entonces `click` en Enviar (o `press Enter`). Con `autonomy` distinto de `full_auto`, este paso exige aprobación previa.
5. Verifica con otro `snapshot` que el mensaje aparece en el hilo. Si no aparece, no lo reenvíes a ciegas: revisa.

## Ritmo

- Espera de 3 a 9 segundos entre acciones. Un hilo a la vez.
- No cargues perfiles ni búsquedas que no hagan falta para atender un hilo.
- Si cualquier página muestra un aviso de restricción o verificación inesperada, deja de usar el navegador y sigue la sección 11 de `recruiter-attention`.

## Fallos comunes

| Síntoma | Causa probable | Acción |
|---|---|---|
| "perfil en uso" o sesión no abre | Otra sesión con el mismo perfil | `playwright-cli -s=linkedin close`, o `close-all`, y reintenta una vez |
| Aparece el login | Sesión vencida | Avisa al dueño; login manual headed |
| Los `eN` no corresponden | Snapshot viejo | Toma otro `snapshot` |
| Página en blanco | Carga lenta | Espera unos segundos y `snapshot`; no recargues en bucle |

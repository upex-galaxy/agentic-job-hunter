---
name: interview-scheduling
description: Use when a recruiter proposes an interview time and Google Calendar is connected.
---

# Agendar entrevistas (opcional)

Requiere el MCP de Google Calendar. Sin él, pide al dueño sus huecos y sigue desde el paso 4.

## Pasos

1. Lee del mensaje la fecha, la hora y la zona horaria que propone el reclutador. Si falta la zona horaria, pregúntala.
2. Convierte la propuesta a la zona del dueño y consulta libre u ocupado con la herramienta de calendario, solo de esa franja.
3. Si está libre, avisa al dueño (según `autonomy`, necesita su aprobación) y pasa al paso 4. Si está ocupado, propón dos franjas libres de los siguientes cinco días hábiles.
4. Responde con `bun run jobs template confirmar-entrevista` completando fecha, hora y zona horaria.
5. Con la aprobación del dueño, crea el evento: título "Entrevista <empresa>", hora, zona, duración que dio el reclutador (60 minutos por defecto) y el enlace de la reunión si lo hay. No invites a nadie por tu cuenta, ni agregues otros datos del dueño.
6. Mueve la tarjeta a `entrevista`, registra con `bun run jobs log <id> "..."` y crea un reloj de 24 horas con `scripts/add-timer.sh` si el enlace aún falta.

## Límites

- Solo lectura de libre y ocupado: no copies títulos ni asistentes de otros eventos a ningún mensaje.
- No aceptes entrevistas fuera del horario que el dueño marcó como disponible en sus preferencias.
- No cambies ni canceles eventos existentes.

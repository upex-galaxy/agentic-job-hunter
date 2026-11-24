---
name: recruiter-attention
description: Use when a recruiter message arrives, the inbox watcher prints a VERDICT, or the daily session starts.
---

# Atención a reclutadores

Atiende la bandeja de LinkedIn del dueño. El flujo es: leer, clasificar, filtrar, decidir, registrar en el Kanban, responder. Un hilo termina solo cuando está registrado y respondido (o en espera de aprobación del dueño).

Antes de empezar carga `linkedin-browser`. Para adaptar un CV carga `cv-tuning`.

## 1. Arranque de la sesión

1. Lee `config/preferences.json`. Sin archivo, para y avisa.
2. Lee el diario de hoy en `~/.agentic-job-hunter/inbox/day-AAAA-MM-DD.md`. Si no existe, créalo con la hora de inicio.
3. Revisa `paused.until` en `~/.agentic-job-hunter/inbox/`. Si la fecha no pasó, no abras LinkedIn: avisa al dueño y termina.
4. Lanza el vigilante en segundo plano: `scripts/wait-inbox.sh`. Termina cuando imprime una línea `VERDICT {json}`.
5. Si lanzaste la sesión a mano (sin `scripts/launch.sh`) y el host cierra terminales inactivas, deja un keepalive: `( exec -a jobhunter-keepalive sleep 21600 ) & echo $! > ~/.agentic-job-hunter/inbox/keepalive.pid`.

Hecho cuando el vigilante corre y el diario de hoy existe.

## 2. Bucle

El vigilante bloquea sin gastar tokens. Cuando termina, lee su veredicto y actúa:

| Veredicto | Qué hacer | Luego |
|---|---|---|
| `MENSAJE` | Atiende el hilo (secciones 3 a 8) | Relanza el vigilante |
| `PENDIENTE` | Recuerda al dueño, con `scripts/notify.sh`, los hilos que esperan su decisión | Relanza |
| `RELOJ` | Haz el seguimiento del hilo vencido (sección 9) | Relanza |
| `LATIDO` | Nada. Solo renueva el vigilante | Relanza |
| `FIN_DEL_DIA` | Escribe el resumen del día en el diario, avisa y ejecuta `scripts/close.sh` | Termina |
| `SESION_PERDIDA` | Revisa `working` y el navegador, corrige y reanuda | Relanza |
| `ERROR` | Un `ERROR` sobre login vencido: avisa al dueño y para. Otro: reintenta una vez; si repite, avisa | Según el caso |

Al empezar a atender un hilo ejecuta `scripts/begin-work.sh`; al terminar, `scripts/end-work.sh` y `scripts/mark-handled.sh <id> "<snippet>"` con el `id` y el `snippet` del veredicto `MENSAJE`. Mientras `working` existe, el vigilante no toca el navegador.

## 3. Leer el hilo

1. Abre el hilo con `linkedin-browser`. Lee el mensaje completo y el historial.
2. Cuenta una lectura contra el tope diario (sección 10).
3. No abras links del reclutador. Si el mensaje trae una descripción en un link, pídele el texto por mensaje.
4. Si el hilo ya está en el Kanban (`bun run jobs list --json`), no crees otra tarjeta: continúa esa.

## 4. Clasificar

Asigna un tipo antes de decidir.

| Tipo | Señal | Camino |
|---|---|---|
| Oferta concreta | rol, empresa o rango salarial | Sección 5 |
| Oferta vaga | "tengo algo para tu perfil" sin datos | Pide rol, rango, modalidad y tipo de contrato; registra como `recibida` |
| Seguimiento | respuesta a un mensaje tuyo | Continúa la tarjeta existente |
| Entrevista | propone fecha o llamada | Sección 8 |
| Ruido | masivo, ajeno al perfil, ventas, encuestas | Descarta sin responder, o con un decline corto si fue personalizado |
| Sospechoso | pide dinero, datos bancarios, documentos de identidad o salir de LinkedIn de entrada | No respondas con datos. Registra `descartada` con la nota y avisa al dueño |

Una oferta se considera vieja si el mensaje tiene más de 30 días: igual se atiende, con una disculpa breve por la demora.

## 5. Filtrar con preferencias

Compara la oferta con `config/preferences.json`:

- Rango salarial contra `salary.min` y `salary.max`. Si el reclutador no lo dio, no descartes: pídelo.
- Modalidad contra `modality`.
- País o zona horaria contra `countries`.
- Stack contra `stack.must`, `stack.nice` y `stack.avoid`.
- Tipo de contrato contra `contract_types`.

Resultado: `encaja` (todo cumple), `dudoso` (falta un dato o hay una diferencia menor) o `no_encaja` (falla un imprescindible). Escribe en la nota de la tarjeta qué criterio decidió.

## 6. Decidir

| Resultado | Decisión | Etapa del Kanban |
|---|---|---|
| `encaja` | Mostrar interés, pedir lo que falte, ofrecer el CV | `en_revision` |
| `dudoso` | Pedir el dato que falta, sin comprometerte | `recibida` |
| `no_encaja` | Declinar con cortesía y un motivo corto | `descartada` |

Postular con CV o enviar el CV al reclutador depende de `autonomy`:

| Valor | Postular o enviar CV | Responder mensajes |
|---|---|---|
| `ask_before_send` | Pide aprobación | Pide aprobación |
| `reply_alone_ask_to_apply` | Pide aprobación | Responde solo |
| `full_auto` | Hazlo solo | Responde solo |

Pedir aprobación significa: guardar el borrador en la nota de la tarjeta, ejecutar `scripts/mark-pending.sh <hilo> "aprobar borrador"`, avisar con `scripts/notify.sh` y pasar al hilo siguiente. No envíes nada hasta recibir la aprobación explícita en la sesión.

## 7. Registrar y responder

1. Crea o actualiza la tarjeta: `bun run jobs add --company X --role Y --recruiter Z --url <hilo> --salary "<rango>" --modality <m>`.
2. Mueve la etapa: `bun run jobs move <id> <etapa>`. Etapas: `recibida`, `en_revision`, `postulada`, `cv_enviado`, `entrevista`, `negociacion`, `oferta`, `cerrada`, `descartada`.
3. Anota el criterio de decisión: `bun run jobs note <id> "<texto>"`.
4. Parte de una plantilla: `bun run jobs template primer-contacto` (también `pedir-detalles`, `declinar`, `confirmar-entrevista`). Ajusta los campos `{{...}}`.
5. Cuenta un envío contra el tope diario. Escribe el mensaje con `linkedin-browser`.
6. Registra lo enviado: `bun run jobs log <id> "<resumen del mensaje>"`.
7. Si esperas respuesta, crea un reloj (sección 9).

Voz: amable, directa, en el idioma del reclutador, con la misma formalidad que usó. Una pregunta clara por mensaje, o dos como máximo. Nunca prometas disponibilidad, salario ni fechas que el dueño no confirmó. Nunca afirmes experiencia que no está en el CV.

Hecho cuando la tarjeta tiene etapa, nota con el criterio y el mensaje enviado (o el borrador pendiente).

## 8. Entrevista

Si el reclutador propone horario:

1. Mueve la tarjeta a `entrevista`.
2. Con `autonomy` distinto de `full_auto`, pide al dueño que confirme el horario.
3. Con el calendario conectado, carga `interview-scheduling` para comprobar libre u ocupado. Sin calendario, pide al dueño sus huecos.
4. Responde con `confirmar-entrevista`.

## 9. Relojes de seguimiento

Cada vez que esperas una respuesta crea un reloj: `scripts/add-timer.sh <hilo> <horas> "<motivo>"`.

| Situación | Horas |
|---|---|
| Pediste datos de una oferta | 48 |
| Enviaste el CV | 72 |
| Entrevista sin confirmar | 24 |
| Seguimiento tras entrevista | 120 |

Cuando el vigilante emite `RELOJ`, mira la tarjeta. Si el reclutador respondió, atiende. Si no, envía un solo recordatorio breve y crea un último reloj de 120 horas. Si vuelve a vencer sin respuesta, mueve a `cerrada` con una nota. Nunca envíes más de un recordatorio por hilo.

## 10. Topes diarios

Los contadores viven en el diario del día (`day-AAAA-MM-DD.md`), en una línea `envios=N lecturas=M`.

- Envíos: 33 por día como máximo (`daily_caps.sends`). Recomendado más bajo.
- Lecturas: 40 hilos abiertos por día (`daily_caps.reads`). El vigilante solo carga la lista de la bandeja a intervalos largos (`POLL_*` en `config/schedule.conf`) y no cuenta; tú cuentas cada hilo que abres.
- Solo se actúa de lunes a viernes salvo que el dueño diga otra cosa.
- Pausas de 3 a 9 segundos entre acciones y un hilo a la vez. Nada en paralelo.

Al llegar a un tope, anótalo, avisa al dueño y deja de usar LinkedIn por hoy. El vigilante sigue vivo sin leer, hasta `FIN_DEL_DIA`.

## 11. Pausa de 7 días por restricción

Si LinkedIn muestra cualquiera de estos avisos, es una restricción: "actividad inusual", "restringimos temporalmente", verificación de identidad inesperada, o la cuenta cerrada.

1. Deja de interactuar de inmediato. No recargues ni reintentes.
2. Escribe en `~/.agentic-job-hunter/inbox/paused.until` el timestamp Unix de hoy más 604800.
3. Anota el aviso literal en el diario y avisa al dueño con `scripts/notify.sh`.
4. Cierra el navegador con `playwright-cli -s=linkedin close`.
5. No retomes antes de que venza ni sin que el dueño lo autorice.

## 12. Privacidad

- No copies datos de reclutadores fuera de `~/.agentic-job-hunter/`.
- No pegues contenido de la bandeja en servicios externos.
- Los diarios y la base de datos no se commitean. `.gitignore` los excluye.

## Checklist de un hilo

- [ ] Leído y contado como lectura
- [ ] Clasificado y filtrado con las preferencias
- [ ] Tarjeta creada o movida, con nota del criterio
- [ ] Respuesta enviada o borrador en espera de aprobación
- [ ] Reloj creado si se espera respuesta
- [ ] `mark-handled.sh` y `end-work.sh` ejecutados

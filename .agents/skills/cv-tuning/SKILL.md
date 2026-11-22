---
name: cv-tuning
description: Use when a CV must be prepared, adapted or sent for a specific job offer.
---

# Adaptar el CV a una oferta

Elige y ordena lo que ya está en el CV base según la oferta. No inventes nada. Un CV adaptado es el mismo CV con otro énfasis, nunca uno con hechos nuevos.

## Archivos

| Ruta | Qué es | Versionado |
|---|---|---|
| `cv/base/profile.template.json` | Plantilla vacía con la forma del perfil | Sí |
| `cv/base/profile.json` | Perfil real del dueño, copiado de la plantilla por `bun run setup` | No |
| `cv/applications/<empresa-rol>/` | Una carpeta por oferta: `offer.json`, `cv.docx`, `cv.pdf` | No |
| `scripts/build_cv.py` | Genera el `.docx` (y `.pdf` si hay LibreOffice) | Sí |

Si `profile.json` no existe o tiene el nombre vacío, para y pide al dueño que lo complete. Los bullets del perfil llevan `tags` (tecnologías y temas); de esas etiquetas sale la selección.

## Flujo

1. Lee la oferta (el texto que dio el reclutador o la tarjeta del Kanban: `bun run jobs list --json`).
2. Extrae las palabras clave que el perfil realmente tiene: tecnologías, tipo de producto, responsabilidades.
3. Escribe `cv/applications/<slug>/offer.json` con `tags`, un `headline` opcional y un `summary` opcional. El `headline` y el `summary` solo reordenan o recortan lo que dice el perfil.
4. Genera el CV:

   ```bash
   python3 .agents/skills/cv-tuning/scripts/build_cv.py \
     --profile cv/base/profile.json \
     --offer cv/applications/<slug>/offer.json \
     --out cv/applications/<slug>/cv
   ```

5. Abre el resultado y compara cada línea con el perfil. Toda cifra, fecha y empresa debe existir en `profile.json`.
6. Mueve la tarjeta a `cv_enviado` solo cuando el CV se envió de verdad. Registra: `bun run jobs log <id> "CV enviado: cv/applications/<slug>/cv.pdf"`.

Hecho cuando el CV existe, cada afirmación se rastrea al perfil y el dueño lo aprobó (salvo `full_auto`).

## Sin inventar

- Si la oferta pide algo que el perfil no tiene, no lo agregues. Dilo al dueño: "pide X, no figura en tu CV".
- Si el dueño dice que sí tiene esa experiencia, pídele el dato exacto y agrégalo primero a `profile.json` con su etiqueta.
- No cambies fechas, cargos ni cifras para encajar.
- No pongas nivel de seniority que el perfil no respalde.

## Privacidad

Las reglas completas están en [references/privacy-rules.md](references/privacy-rules.md). Léelas antes de enviar el primer CV a un contacto nuevo. Resumen: nunca incluyas datos de identidad (documento, fecha de nacimiento, estado civil, foto, dirección exacta), ni datos de clientes o empleadores marcados como confidenciales, ni cifras salariales pasadas.

## Mensaje de entrega

Al enviar el CV, acompáñalo con dos o tres líneas: por qué encaja con la oferta y la disponibilidad que el dueño confirmó. Parte de `bun run jobs template primer-contacto` y ajusta.

## Plantilla de perfil

Los campos de `profile.template.json` son: `name`, `headline`, `contact`, `summary`, `skills` (grupos con `items`), `experience` (cada puesto con `bullets` de `text` y `tags`), `education`, `languages` y `never_include`. En `never_include` el dueño lista palabras que no deben salir en ningún CV; el script se detiene si las encuentra.

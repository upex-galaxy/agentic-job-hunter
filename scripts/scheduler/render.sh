#!/usr/bin/env bash
# Genera las plantillas del scheduler con las rutas de esta máquina. No instala nada.
# Uso: scripts/scheduler/render.sh <carpeta-de-salida>
# Luego copia los .plist a ~/Library/LaunchAgents (macOS) o pega crontab.txt con `crontab -e` (ver docs/scheduler.md).
set -eu
OUT="${1:?uso: render.sh <carpeta-de-salida>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
mkdir -p "$OUT"
for f in "$HERE"/com.agentic-job-hunter.*.plist "$HERE/crontab.txt"; do
  sed -e "s#__REPO__#$REPO#g" -e "s#__HOME__#$HOME#g" "$f" > "$OUT/$(basename "$f")"
  echo "$OUT/$(basename "$f")"
done
if command -v plutil >/dev/null; then plutil -lint "$OUT"/*.plist; fi

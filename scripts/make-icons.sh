#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONS="$ROOT/src-tauri/icons"
SOURCE="$ICONS/icon-source.png"
SET="$ICONS/icon.iconset"

[ -f "$SOURCE" ] || { echo "fonte ausente: $SOURCE"; exit 1; }

sips -z 512 512 "$SOURCE" --out "$ICONS/icon.png" >/dev/null
sips -z 32 32 "$SOURCE" --out "$ICONS/32x32.png" >/dev/null
sips -z 128 128 "$SOURCE" --out "$ICONS/128x128.png" >/dev/null
sips -z 256 256 "$SOURCE" --out "$ICONS/128x128@2x.png" >/dev/null
convert "$SOURCE" -define icon:auto-resize=256,128,64,48,32,16 "$ICONS/icon.ico"

rm -rf "$SET"
mkdir "$SET"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$SOURCE" --out "$SET/icon_${size}x${size}.png" >/dev/null
  sips -z "$((size * 2))" "$((size * 2))" "$SOURCE" --out "$SET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$ICONS/icon.icns"
rm -rf "$SET"
echo "ícones gerados em $ICONS"

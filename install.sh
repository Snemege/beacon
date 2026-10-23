#!/usr/bin/env bash
# Beacon'ı geliştirme modunda kurar: src/ klasörü extension dizinine symlink'lenir,
# böylece koddaki değişiklikler bir sonraki oturumda (veya nested shell'de) geçerli olur.
set -euo pipefail
UUID="beacon@vex.local"
SRC="$(cd "$(dirname "$0")" && pwd)/src"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

glib-compile-schemas --strict "$SRC/schemas"
mkdir -p "$(dirname "$DEST")"
if [ -e "$DEST" ] && [ ! -L "$DEST" ]; then
  echo "Hata: $DEST zaten var ve symlink değil" >&2
  exit 1
fi
ln -sfn "$SRC" "$DEST"
echo "Kuruldu: $DEST -> $SRC"
echo "Wayland'da yeni extension'ı görmek için oturumu kapatıp açın, sonra:"
echo "  gnome-extensions enable $UUID"

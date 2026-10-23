#!/usr/bin/env bash
# Oturumu kapatmadan test: ayrı bir pencerede iç içe GNOME Shell açar.
set -euo pipefail
"$(dirname "$0")/install.sh" >/dev/null
export MUTTER_DEBUG_DUMMY_MODE_SPECS="${MUTTER_DEBUG_DUMMY_MODE_SPECS:-1600x900}"
exec dbus-run-session -- gnome-shell --devkit --wayland

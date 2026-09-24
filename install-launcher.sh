#!/usr/bin/env bash
#
# Installs AiWp into your desktop so you can start it by double-clicking.
#
#   ./install-launcher.sh            install
#   ./install-launcher.sh --remove   uninstall the menu entry
#
# What it does:
#   * writes a menu entry to ~/.local/share/applications/aiwp-platform.desktop
#     pointing at THIS folder, so it keeps working after you move the project
#   * marks it executable and (on GNOME) trusted, which is what makes a
#     double-click actually run it instead of opening it in a text editor
#
# It never needs sudo, never touches system directories, and installs nothing
# beyond that one file. AiWp itself downloads Node.js on first start, into
# .runtime/ inside this folder — see start-aiwp.sh.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_DIR="$HOME/.local/share/applications"
DEST="$DEST_DIR/aiwp-platform.desktop"

say()  { printf '  %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

if [ "${1:-}" = "--remove" ]; then
  rm -f "$DEST"
  ok "removed $DEST"
  say "the project folder itself is untouched"
  exit 0
fi

[ -f "$ROOT/start-aiwp.sh" ] || die "start-aiwp.sh not found next to this script — run it from inside the project folder"
[ -f "$ROOT/launch-terminal.sh" ] || die "launch-terminal.sh not found next to this script"

chmod +x "$ROOT/start-aiwp.sh" "$ROOT/launch-terminal.sh" "$ROOT/stop-aiwp.sh" 2>/dev/null || true

mkdir -p "$DEST_DIR"

# The Exec line carries the absolute project path. %k would resolve to the
# location of *this* installed file, not the project, so it cannot be used
# once the entry lives in ~/.local/share/applications/.
cat > "$DEST" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=AiWp Platform
Name[fa]=پلتفرم AiWp
GenericName=WordPress Plugin Factory
Comment=Start the AiWp platform in your browser
Comment[fa]=راه‌اندازی پلتفرم AiWp در مرورگر
Exec=bash -c 'cd "$(printf '%s' "$ROOT" | sed "s/'/'\\\\\\\\''/g")" && exec ./launch-terminal.sh'
Path=$(printf '%s' "$ROOT" | sed "s/'/'\\\\\\\\''/g")
Icon=applications-development
Terminal=false
Categories=Development;WebDevelopment;
StartupNotify=true
Keywords=aiwp;wordpress;plugin;license;store;
DESKTOP

chmod +x "$DEST"

# GNOME refuses to launch a .desktop file it does not consider trusted; the
# flag lives in the per-file metadata database and is set through gio.
if command -v gio >/dev/null 2>&1; then
  gio set "$DEST" metadata::trusted true 2>/dev/null || true
  gio set "$ROOT/AiWp.desktop" metadata::trusted true 2>/dev/null || true
fi

# Refresh the menu database when the tooling is present.
command -v update-desktop-database >/dev/null 2>&1 \
  && update-desktop-database "$DEST_DIR" 2>/dev/null || true

ok "installed $DEST"
echo
say "Open your application menu and start “AiWp Platform”."
say "Or double-click AiWp.desktop in this folder."
echo
say "First start downloads Node.js once (about 30s, into .runtime/)."
say "Later starts are offline and take about a second."
say "To remove: ./install-launcher.sh --remove"

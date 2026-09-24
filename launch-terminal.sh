#!/usr/bin/env bash
#
# Launched by AiWp.desktop. Opens the setup/startup output in a terminal
# window so first-run downloads are visible, then keeps the window open long
# enough to read the result.
#
# Terminal emulators differ by flavour, so try them in order of likelihood on
# a default Ubuntu install.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INNER="$ROOT/start-aiwp.sh"

[ -x "$INNER" ] || chmod +x "$INNER" 2>/dev/null || true

# The command the terminal will run: start AiWp, then wait so the window does
# not vanish before the URL and credentials can be read.
CMD="cd '$ROOT' && ./start-aiwp.sh; echo; echo 'You can close this window — AiWp keeps running. Stop it with ./stop-aiwp.sh'; read -r -p 'Press Enter to close…' _"

for term in gnome-terminal konsole xfce4-terminal mate-terminal tilix terminator kitty alacritty xterm; do
  if command -v "$term" >/dev/null 2>&1; then
    case "$term" in
      gnome-terminal|mate-terminal|tilix) exec "$term" -- bash -c "$CMD" ;;
      konsole)            exec "$term" -e bash -c "$CMD" ;;
      xfce4-terminal|terminator|kitty|alacritty|xterm) exec "$term" -e bash -c "$CMD" ;;
    esac
  fi
done

# No terminal emulator available: run inline. The .desktop entry sets
# Terminal=false, so this path is only hit when started some other way.
exec bash -c "$CMD"

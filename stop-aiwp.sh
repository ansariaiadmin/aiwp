#!/usr/bin/env bash
#
# Stops the AiWp app and database started by start-aiwp.sh.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT/.runtime/pids"

if [ ! -d "$PID_DIR" ]; then
  echo "Nothing to stop — AiWp has not been started from this folder yet."
  exit 0
fi

stopped=0

for name in app db; do
  pidfile="$PID_DIR/$name.pid"
  [ -f "$pidfile" ] || continue

  pid="$(cat "$pidfile")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    # Give it a moment to exit cleanly, then force it.
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    kill -9 "$pid" 2>/dev/null || true
    echo "Stopped $name (pid $pid)."
    stopped=1
  else
    echo "$name was not running."
  fi

  rm -f "$pidfile"
done

[ "$stopped" -eq 1 ] || echo "Nothing was running."

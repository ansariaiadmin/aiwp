#!/bin/bash
#
# macOS double-click launcher for AiWp.
#
# On macOS, double-clicking a .command file opens Terminal and runs it, so a
# non-technical user gets the same one-click experience as the Linux
# .desktop entry. All the real work lives in start-aiwp.sh (which is shared
# with Linux and is macOS-aware for the Node.js download).
#
cd "$(dirname "$0")" || exit 1
exec ./start-aiwp.sh

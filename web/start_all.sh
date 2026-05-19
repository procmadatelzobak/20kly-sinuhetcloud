#!/bin/bash
# Start both game servers:
# - Pyodide/Python game on port 8095
# - TypeScript reimplementation on port 8096
set -e

# Start TS game in background
python3 -m http.server 8096 --directory 2/dist &
TS_PID=$!
echo "TS game started (PID $TS_PID) on port 8096"

# Start main Pyodide game in foreground (systemd tracks this)
exec python3 -m http.server 8095 --directory build/web

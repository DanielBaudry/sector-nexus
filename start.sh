#!/usr/bin/env bash
set -e

# Directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Dedicated ports (kept clear of other local stacks). Override via env if needed.
export SECTOR_BACKEND_PORT="${SECTOR_BACKEND_PORT:-8710}"
export SECTOR_FRONTEND_PORT="${SECTOR_FRONTEND_PORT:-5710}"

for PORT in "$SECTOR_BACKEND_PORT" "$SECTOR_FRONTEND_PORT"; do
    if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN > /dev/null 2>&1; then
        echo "[✗] Port $PORT is already in use:"
        lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
        echo "    Free it or override SECTOR_BACKEND_PORT / SECTOR_FRONTEND_PORT."
        exit 1
    fi
done

echo "=========================================================="
echo "  SECTOR NEXUS // StarCraft Tactical Gacha RPG"
echo "  Starting Backend (FastAPI) & Frontend (Vite + React)"
echo "=========================================================="

# Start backend
cd "$DIR/backend"
echo "[+] Starting FastAPI Backend on http://127.0.0.1:$SECTOR_BACKEND_PORT..."
"$DIR/backend/.venv/bin/python3" -m uvicorn src.main:app --host 127.0.0.1 --port "$SECTOR_BACKEND_PORT" --reload &
BACKEND_PID=$!

# Wait for backend to be ready
echo "[*] Waiting for backend readiness..."
for i in {1..30}; do
    # Probe a Sector Nexus route so another server on the port can't fake readiness.
    if curl -sf "http://127.0.0.1:$SECTOR_BACKEND_PORT/api/player" > /dev/null 2>&1; then
        echo "[✓] Backend is ready!"
        break
    fi
    sleep 0.5
done

# Start frontend
cd "$DIR/frontend"
echo "[+] Starting Vite React Frontend..."
npm run dev &
FRONTEND_PID=$!

cleanup() {
    echo ""
    echo "[!] Shutting down Sector Nexus..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

echo ""
echo "=========================================================="
echo "  Core Online!"
echo "  - Web Browser HUD:  http://localhost:$SECTOR_FRONTEND_PORT"
echo "  - FastAPI Swagger:  http://127.0.0.1:$SECTOR_BACKEND_PORT/docs"
echo "  Press CTRL+C to stop both servers."
echo "=========================================================="

wait

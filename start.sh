#!/usr/bin/env bash
set -e

# Directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================================="
echo "  SECTOR NEXUS // StarCraft Tactical Gacha RPG"
echo "  Starting Backend (FastAPI) & Frontend (Vite + React)"
echo "=========================================================="

# Start backend
cd "$DIR/backend"
echo "[+] Starting FastAPI Backend on http://127.0.0.1:8000..."
"$DIR/backend/.venv/bin/python3" -m uvicorn src.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
echo "[*] Waiting for backend readiness..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/ > /dev/null 2>&1; then
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
echo "  - Web Browser HUD:  http://localhost:3000"
echo "  - FastAPI Swagger:  http://127.0.0.1:8000/docs"
echo "  Press CTRL+C to stop both servers."
echo "=========================================================="

wait

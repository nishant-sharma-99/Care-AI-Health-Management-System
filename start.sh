#!/usr/bin/env bash
set -e

# ── helpers ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[HMS]${NC} $1"; }
warn()  { echo -e "${YELLOW}[HMS]${NC} $1"; }
error() { echo -e "${RED}[HMS]${NC} $1"; exit 1; }

cleanup() {
  info "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── check Node ───────────────────────────────────────────────────────────────
command -v node &>/dev/null || error "Node.js not found. Install from https://nodejs.org (v16+)"
command -v npm  &>/dev/null || error "npm not found. Install Node.js from https://nodejs.org"

# ── check / install Python ───────────────────────────────────────────────────
PYTHON=""
for cmd in python3 python; do
  if command -v "$cmd" &>/dev/null && "$cmd" -c "import sys; sys.exit(0 if sys.version_info >= (3,8) else 1)" 2>/dev/null; then
    PYTHON="$cmd"; break
  fi
done

if [ -z "$PYTHON" ]; then
  warn "Python 3.8+ not found. Attempting to install via system package manager..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y python3 python3-pip python3-venv
    PYTHON=python3
  elif command -v brew &>/dev/null; then
    brew install python
    PYTHON=python3
  elif command -v winget &>/dev/null; then
    winget install Python.Python.3
    PYTHON=python3
  else
    error "Cannot auto-install Python. Please install Python 3.8+ from https://python.org"
  fi
fi
info "Using Python: $($PYTHON --version)"

# ── backend setup ─────────────────────────────────────────────────────────────
cd "$(dirname "$0")/backend"

[ -f .env ] || cp .env.example .env && info "Created backend/.env from example"

if [ ! -d venv ]; then
  info "Creating Python virtual environment..."
  $PYTHON -m venv venv
fi

info "Installing backend dependencies..."
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null || error "Failed to activate venv"
pip install -q --upgrade pip
pip install -q -r requirements.txt

info "Starting backend on http://localhost:8000 ..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# ── frontend setup ────────────────────────────────────────────────────────────
cd ../frontend

[ -f .env ] || cp .env.example .env && info "Created frontend/.env from example"

info "Installing frontend dependencies..."
npm install --silent

info "Starting frontend on http://localhost:3000 ..."
npm run dev &
FRONTEND_PID=$!

# ── wait ──────────────────────────────────────────────────────────────────────
info "Both services running. Press Ctrl+C to stop."
info "  Backend  → http://localhost:8000/docs"
info "  Frontend → http://localhost:3000"
wait

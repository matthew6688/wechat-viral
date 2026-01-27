#!/bin/sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[Local] Starting backend dev server..."
cd "$ROOT_DIR/backend"
npm install
npm run dev &

echo "[Local] Starting tunnel watcher..."
cd "$ROOT_DIR"
node scripts/start-tunnel-watch.js

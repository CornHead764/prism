#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node /app/scripts/migrate.js

echo "[entrypoint] Starting Prism..."
exec node /app/server.js

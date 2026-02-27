#!/bin/sh
set -e

echo "[entrypoint] Starting ClickPawPay API..."

# Optional environment checks - just warnings, not fatal
if [ -z "$JWT_SECRET" ]; then
  echo "[entrypoint] WARNING: JWT_SECRET not set - generated a random value."
  echo "[entrypoint]          Sessions will be invalidated on container restart."
  echo "[entrypoint]          Set JWT_SECRET in your platform env vars for persistence."
fi

if [ -z "$ENCRYPTION_KEY" ]; then
  echo "[entrypoint] WARNING: ENCRYPTION_KEY not set - generated a random value."
  echo "[entrypoint]          All stored SlickPay API keys will become unreadable on restart."
  echo "[entrypoint]          Set ENCRYPTION_KEY in your platform env vars for persistence."
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "[entrypoint] WARNING: ANTHROPIC_API_KEY not set."
  echo "[entrypoint]          AI chat features will be unavailable until you set this."
  echo "[entrypoint]          Get your key at: https://console.anthropic.com"
fi

# Run database migrations
echo "[entrypoint] Running database migrations..."
npx prisma migrate deploy

# Start the server
echo "[entrypoint] Starting Node.js server..."
exec node server.js

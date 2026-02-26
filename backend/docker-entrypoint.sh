#!/bin/sh
set -e

# ClickPawPay API - Docker Entrypoint
# Auto-generates missing secrets so the container can start even when
# JWT_SECRET / ENCRYPTION_KEY are not pre-configured in the platform.
# These generated values are ephemeral (lost on container restart) unless
# you override them with real values in the platform environment variables.

generate_hex() {
  node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"
}

# --- JWT_SECRET ---
if [ -z "$JWT_SECRET" ]; then
  export JWT_SECRET=$(generate_hex)
  echo "[entrypoint] WARNING: JWT_SECRET not set - generated a random value."
  echo "[entrypoint]          Sessions will be invalidated on container restart."
  echo "[entrypoint]          Set JWT_SECRET in your platform env vars for persistence."
fi

# --- ENCRYPTION_KEY ---
if [ -z "$ENCRYPTION_KEY" ]; then
  export ENCRYPTION_KEY=$(generate_hex)
  echo "[entrypoint] WARNING: ENCRYPTION_KEY not set - generated a random value."
  echo "[entrypoint]          All stored SlickPay API keys will become unreadable on restart."
  echo "[entrypoint]          Set ENCRYPTION_KEY in your platform env vars for persistence."
fi

# --- ANTHROPIC_API_KEY ---
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "[entrypoint] WARNING: ANTHROPIC_API_KEY not set."
  echo "[entrypoint]          AI chat features will be unavailable until you set this."
  echo "[entrypoint]          Get your key at: https://console.anthropic.com"
  # Set a placeholder so the fail-fast check passes; the AI route will return
  # a clear error when actually called without a valid key.
  export ANTHROPIC_API_KEY="not-configured"
fi

# Run Prisma migration then start the server
exec "$@"

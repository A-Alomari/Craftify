#!/bin/sh
set -e

echo "⚙️  docker-entrypoint: NODE_ENV=${NODE_ENV:-production}, ALLOW_SEED=${ALLOW_SEED:-0}"

# Run seed only when explicitly allowed and not in production
if [ "${NODE_ENV:-production}" != "production" ]; then
  echo "🌱 Running database seed (ALLOW_SEED=1, NODE_ENV=${NODE_ENV})"
  npm run seed
fi

# Ensure common writable dirs exist (no-op if already present)
mkdir -p .uploads .sessions public/uploads || true

# Run the main command
exec "$@"

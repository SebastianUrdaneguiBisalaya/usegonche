#!/usr/bin/env bash
# Starts the development stack (hot reload) and removes orphan images left by rebuilds.
# Usage: ./scripts/deploy.dev.sh [-d]   (-d runs in the background)
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.dev.yml)

[[ -f .env ]] || { echo "Missing .env (copy .env.example and fill it in)." >&2; exit 1; }

# Always clean on exit (including Ctrl+C of the foreground run), but only dangling layers: images of other projects stay.
cleanup() {
	echo "==> Cleaning up"
	docker image prune -f
	docker builder prune -f --filter "until=24h"
}
trap cleanup EXIT

echo "==> Building and starting"
"${COMPOSE[@]}" up --build --remove-orphans "$@"

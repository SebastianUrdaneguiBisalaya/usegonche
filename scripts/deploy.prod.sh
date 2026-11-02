#!/usr/bin/env bash
# Deploys the API on the droplet: docker compose up -d --build, then removes everything that is no longer needed.
# Usage: ./scripts/deploy.prod.sh [--no-pull]
# Database migrations are NOT run here: apply them first (`pnpm --filter @usegonche/database migrate:deploy`).
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.yml)

[[ -f .env ]] || { echo "Missing .env (copy .env.example and fill it in)." >&2; exit 1; }
grep -Eq '^API_DOMAIN=.+' .env || { echo "Set API_DOMAIN in .env." >&2; exit 1; }

if [[ "${1:-}" != "--no-pull" ]]; then
	echo "==> Pulling latest code"
	git pull --ff-only
fi

echo "==> Building and starting (waits for the healthchecks)"
if ! "${COMPOSE[@]}" up -d --build --remove-orphans --wait --wait-timeout 180; then
	echo "Deploy failed; the previous images are kept so you can roll back. Logs:" >&2
	"${COMPOSE[@]}" logs --tail=100 api >&2
	exit 1
fi

# Only after a healthy deploy, so a failed one can still fall back to the old image.
echo "==> Cleaning up"
docker container prune -f
docker image prune -af
docker builder prune -af
docker network prune -f
# Volumes are never pruned: caddy_data holds the HTTPS certificates.

"${COMPOSE[@]}" ps
echo "Deployed."

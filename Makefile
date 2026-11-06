.DEFAULT_GOAL := help

.PHONY: help install api-dev api-dev-worker api-build api-start api-deploy-worker api-client-build web-dev web-build web-start desktop-dev desktop-build desktop-dist-mac desktop-dist-win desktop-dist-linux www-dev www-build www-start db-generate db-studio lint format typecheck test test-watch test-coverage check docker-dev docker-prod

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2} /^## / {printf "\n%s\n", substr($$0, 4)}' $(MAKEFILE_LIST)

## Setup

install: ## Install every workspace dependency (also generates the Prisma clients)
	pnpm install

## API (Hono, root src/)

api-dev: ## Run the API on Node with hot reload (port 4000 by default, see PORT in .env)
	pnpm dev

api-dev-worker: ## Run the API on the Cloudflare Workers runtime locally
	pnpm dev:worker

api-build: ## Build the single-file Node bundle (dist/index.js)
	pnpm build

api-start: ## Start the built Node bundle
	pnpm start

api-deploy-worker: ## Deploy the API to Cloudflare Workers
	pnpm deploy:worker

api-client-build: ## Rebuild the typed RPC client (run after changing API routes or schemas)
	pnpm --filter @usegonche/api-client build

## Web (React Router)

web-dev: ## Run the web app with hot reload
	pnpm --filter web dev

web-build: ## Build the web app
	pnpm --filter web build

web-start: ## Serve the built web app
	pnpm --filter web start

## Desktop (Electron)

desktop-dev: ## Run Electron in watch mode (the web app must be running)
	pnpm --filter desktop dev

desktop-build: ## Compile the Electron main process
	pnpm --filter desktop build

desktop-dist-mac: ## Package the macOS app
	pnpm --filter desktop dist:mac

desktop-dist-win: ## Package the Windows app
	pnpm --filter desktop dist:win

desktop-dist-linux: ## Package the Linux app
	pnpm --filter desktop dist:linux

## Landing (Next.js)

www-dev: ## Run the landing page with hot reload
	pnpm --filter www dev

www-build: ## Build the landing page
	pnpm --filter www build

www-start: ## Serve the built landing page
	pnpm --filter www start

## Database (Prisma; migrations are applied by the user, never by the agent)

db-generate: ## Generate the Prisma clients (node and workerd)
	pnpm --filter @usegonche/database generate

db-studio: ## Open Prisma Studio
	pnpm --filter @usegonche/database studio

## Quality

lint: ## Lint the whole repo with Biome
	pnpm lint

format: ## Format the whole repo with Biome
	pnpm format

typecheck: ## Typecheck the API, the packages and the apps (rebuilds the API client first)
	pnpm typecheck

test: ## Run the Vitest suite once
	pnpm test

test-watch: ## Run Vitest in watch mode
	pnpm test:watch

test-coverage: ## Run the Vitest suite with coverage
	pnpm test:coverage

check: ## Lint, typecheck and test: run before declaring work done
	$(MAKE) lint typecheck test

## Docker (API only; the database is Supabase)

docker-dev: ## Run the API in Docker with hot reload
	docker compose -f docker-compose.dev.yml up --build

docker-prod: ## Build and run the production API stack (API behind Caddy)
	docker compose up -d --build

# Backend manual

Step-by-step instructions to run, change and deploy the **backend** of useGonche: the Hono API in the repo root (`src/`) and the database package (`packages/database`). It does not cover the apps (`apps/*`).

Every command is run **from the repo root** unless it says otherwise.

## 0. Rules to keep in mind

- Every endpoint is under **`/v1`** (e.g. `http://localhost:4000/v1/auth/login`), except `GET /health`, which is unversioned.
- The database is **Supabase Postgres**. There is no local database container.
- Migrations are **never** run by the API at startup. You run them yourself (section 4).
- **Never commit `.env`** or any secret.
- Run `pnpm typecheck`, `pnpm lint` and `pnpm test` before you open a PR.

## 1. First-time setup (every developer)

Requirements: Node.js 22 or newer, and pnpm (the exact version is pinned in `package.json` > `packageManager`; `corepack enable` installs it).

1. Install dependencies. This also generates the Prisma clients (`postinstall`):
   ```bash
   pnpm install
   ```
2. Create your env file and fill it in:
   ```bash
   cp .env.example .env
   ```
3. Fill the **required** variables (get them from the Supabase dashboard):

   | Variable | Where it comes from |
   | --- | --- |
   | `SUPABASE_URL` | Project Settings > API |
   | `SUPABASE_PUBLISHABLE_KEY` | Project Settings > API Keys |
   | `SUPABASE_SECRET_KEY` | Project Settings > API Keys. Server only, never in a client app |
   | `DATABASE_URL` | Connect > pooled connection (Supavisor, port `6543`). Used at runtime |
   | `DIRECT_URL` | Connect > direct or session pooler (port `5432`). Used **only by migrations** |
   | `AUTH_REDIRECT_URL` | Where the browser lands after Google sign-in or the email link (e.g. `http://localhost:5173`) |
   | `AUTH_CALLBACK_URL` | Public URL of `GET /v1/auth/callback` (e.g. `http://localhost:4000/v1/auth/callback`) |

   Optional variables (`CORS_ORIGINS`, `COOKIE_DOMAIN`, Google sign-in, storage buckets, rate limits, `INTERNAL_CRON_SECRET`, `API_DOMAIN`) are documented inside `.env.example`.

4. Create the two Storage buckets in Supabase > Storage: `private` and `public` (or the names you set in `STORAGE_BUCKET_*`).
5. Apply the database migrations (section 4.2). A fresh Supabase project needs them before the API can work.

## 2. Development

### 2.1 Run the API (Node)

```bash
pnpm dev
```

- Runs `tsx watch` with `.env`, so it reloads when you edit a file.
- Listens on `PORT` from `.env`; if unset, on **4000**. Note that `.env.example` ships `PORT=3000`: whatever you set in `.env` wins, and `AUTH_CALLBACK_URL` must use the same port.
- Check it: `curl http://localhost:4000/health` (it also queries the database, so it reports a wrong `DATABASE_URL`).

### 2.2 Run the API with Docker (hot reload)

```bash
./scripts/deploy.dev.sh        # foreground, Ctrl+C to stop
./scripts/deploy.dev.sh -d     # background
```

It runs `docker compose -f docker-compose.dev.yml up --build`, mounts your source over the container, and port **3000** is published. Dangling images are cleaned on exit.

### 2.3 Run the API as a Cloudflare Worker (optional)

```bash
pnpm dev:worker
```

Reads secrets from a local `.dev.vars` file (same names as `.env`). Use it only if you work on the Worker entry (`src/worker.ts`).

### 2.4 Quality checks

```bash
pnpm typecheck        # API + packages
pnpm lint             # Biome
pnpm format           # Biome, writes
pnpm test             # Vitest, once
pnpm test:watch       # Vitest, watching
pnpm test:coverage
```

### 2.5 Useful database commands

```bash
pnpm --filter @usegonche/database generate   # regenerate the Prisma clients (also runs on install)
pnpm --filter @usegonche/database studio     # browse the data in Prisma Studio
```

## 3. How the database folder works

`packages/database/prisma/`:

| Path | What it is |
| --- | --- |
| `schema.prisma` | The data model (the source of truth for tables Prisma manages) |
| `migrations/` | Ordered SQL migrations, committed to git. Some are hand-written (see below) |
| `manual/` | SQL that is **not** a migration and that you run by hand in the Supabase SQL editor |

Prisma only manages the `public` schema. Supabase owns `auth` and `storage`; never model or migrate them.

Hand-written migrations (Prisma cannot express them) are still in `migrations/` and are applied by the normal migrate commands:

- `..._link_profiles_to_auth_users`: foreign key from `profiles.id` to `auth.users.id` plus the `on_auth_user_created` trigger.
- `..._add_full_text_search`: generated `tsvector` columns and GIN indexes.

## 4. Migrations

### 4.1 Create a migration (when you change `schema.prisma`)

1. Edit `packages/database/prisma/schema.prisma`.
2. Create and apply it to your Supabase project:
   ```bash
   pnpm --filter @usegonche/database migrate:dev
   ```
   It uses `DIRECT_URL`. Prisma asks for a name (e.g. `add_something`).
3. Commit the new folder in `packages/database/prisma/migrations/`.
4. Regenerate the clients and re-check types:
   ```bash
   pnpm --filter @usegonche/database generate
   pnpm --filter @usegonche/api-client build   # only if API routes or schemas changed
   pnpm typecheck
   ```

Notes:

- IDs are UUID v4 (`@db.Uuid @default(uuid(4))`), no `Json` columns, and every user-owned table has an owner column. See `AGENTS.md`.
- `migrate dev` cannot validate the migration that references `auth.users` on a shadow database. If it complains, generate the SQL file offline and apply it with the command in 4.2:
  ```bash
  pnpm --filter @usegonche/database exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
  ```
  (Use it as a base; trim it to the new changes and place it in a new `migrations/<timestamp>_<name>/migration.sql`.)
- Do not edit a migration that is already applied anywhere. Create a new one.

### 4.2 Apply existing migrations (new machine, new database, CI, production)

```bash
pnpm --filter @usegonche/database migrate:deploy
```

- Applies only the pending migrations, in order. Safe to re-run.
- Needs `DIRECT_URL` (it is read from `.env` or from the environment).
- **Production rule:** run it **before** you release the new API version, from your machine or from CI. Never from the API container.

### 4.3 Manual SQL (not migrations)

These are run by you in the Supabase SQL editor. They are re-runnable.

**Reminders processor** (`packages/database/prisma/manual/reminders-pg-cron.sql`), needed so reminders are delivered every minute:

1. Make sure the API is deployed and reachable from the internet, and that `INTERNAL_CRON_SECRET` is set on it. Generate one with `openssl rand -hex 32`.
2. Open the SQL file and replace the two placeholders:
   - `<API_URL>`: public base URL of the API, no trailing slash (e.g. `https://api.example.com`)
   - `<SECRET>`: the same value as `INTERNAL_CRON_SECRET`
3. Paste it into Supabase > SQL Editor and run it. It enables `pg_cron` and `pg_net` and schedules `process-reminders` every minute (calls `POST /v1/internal/reminders/process`).
4. To inspect or stop it, use the queries in the comments at the bottom of the file. To rotate the secret, change the env var and re-run the script.

Do not commit the file with the real URL or secret filled in.

### 4.4 Checklist: what to run after a new migration

Follow this whenever a migration is created (by you or by someone else).

**If you created it (developer who changed `schema.prisma`):**

```bash
# 1. Create and apply it to YOUR Supabase project (asks for a name)
pnpm --filter @usegonche/database migrate:dev

# 2. Regenerate the Prisma clients
pnpm --filter @usegonche/database generate

# 3. Rebuild the typed client if routes or schemas changed
pnpm --filter @usegonche/api-client build

# 4. Check everything still compiles and passes
pnpm typecheck && pnpm lint && pnpm test

# 5. Commit the schema AND the new migration folder together
git add packages/database/prisma
```

**If you pulled a branch that contains new migrations:**

```bash
pnpm install                                        # also regenerates the Prisma clients
pnpm --filter @usegonche/database migrate:deploy    # applies the pending migrations to your database
pnpm --filter @usegonche/api-client build           # if the API changed
```

If your API fails with Prisma errors after a pull, you skipped `migrate:deploy` or `generate`.

**Releasing to production (after the PR is merged):**

```bash
# 1. FIRST, with the production DIRECT_URL (your machine or CI). Never from the API container
pnpm --filter @usegonche/database migrate:deploy

# 2. THEN deploy the new API version (section 5)
./scripts/deploy.prod.sh
```

Why this order: the new code expects the new tables or columns, so the database must change first. Write migrations so the **previous** API version still works against them (add columns or tables; remove or rename in a later release), because there is a short window where the old code runs on the new schema.

If the migration came with a manual SQL file (section 4.3), run that in the Supabase SQL editor too.

## 5. Production

Pick **one** target for the API (5.1, 5.2 or 5.3). All need the same env variables. If the web app is on another domain, also read 5.4.

### 5.1 DigitalOcean droplet (Docker + Caddy)

One-time setup on the droplet:

1. Install Docker (with the compose plugin) and clone the repo.
2. Create an **A record** for your domain pointing to the droplet. Open ports `80`, `443` and `443/udp`.
3. `cp .env.example .env` and fill it in. In addition to section 1:
   - `API_DOMAIN=api.example.com`
   - `AUTH_CALLBACK_URL=https://api.example.com/v1/auth/callback`
   - `AUTH_REDIRECT_URL`: the production URL of your web app
   - `INTERNAL_CRON_SECRET`, and the Google variables if you use Google sign-in
   - `TRUST_PROXY` is forced to `true` by compose (Caddy sets `X-Forwarded-For`)

Every release, in this order:

1. **Migrate first** (from your machine or CI, with the production `DIRECT_URL`):
   ```bash
   pnpm --filter @usegonche/database migrate:deploy
   ```
2. **Deploy on the droplet:**
   ```bash
   ./scripts/deploy.prod.sh            # git pull --ff-only, build, start, wait for healthchecks
   ./scripts/deploy.prod.sh --no-pull  # deploy the code already on the droplet
   ```
   If the new version does not become healthy, the script prints the logs and keeps the previous images so you can roll back. Caddy gets and renews the HTTPS certificate by itself (never prune the `caddy_data` volume).
3. Check: `curl https://api.example.com/health`
4. First deploy only: run the reminders SQL from section 4.3 with the production URL.

Useful commands on the droplet:

```bash
docker compose logs -f api     # API logs
docker compose ps              # status
```

### 5.2 Without Docker (any Node host)

```bash
pnpm install --frozen-lockfile
pnpm build        # generates the Prisma clients and bundles dist/index.js
pnpm start        # node dist/index.js, uses PORT
```

Set the env variables in the host (there is no `.env` file in production images) and run migrations first (4.2).

### 5.3 Cloudflare Workers

1. Set the secrets once (each prompts for the value): `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `INTERNAL_CRON_SECRET`, plus the rest of the variables you use:
   ```bash
   npx wrangler secret put DATABASE_URL
   ```
2. Run migrations first (4.2), then:
   ```bash
   pnpm deploy:worker
   ```
3. On Workers, rate limiting uses the bindings in `wrangler.jsonc` (the `RATE_LIMIT_*` env variables are ignored).

### 5.4 Web and API on different domains

The session lives in cookies set by the API. A browser only sends a cookie to the host it belongs to, so how you name the domains decides what works.

**Recommended: two subdomains of one domain** (e.g. web `app.example.com`, API `api.example.com`):

1. In the API environment set the shared cookie domain, with the leading dot:
   ```
   COOKIE_DOMAIN=.example.com
   ```
   Now the session cookie is also sent to `app.example.com`, so the web server can check the session before rendering (a signed-in user who opens `/auth/*` is redirected to `/` with no flash).
2. Point the API at the web app (no trailing slash needed, only the origin matters for CORS):
   ```
   AUTH_REDIRECT_URL=https://app.example.com
   AUTH_CALLBACK_URL=https://api.example.com/v1/auth/callback
   CORS_ORIGINS=            # only for extra origins, e.g. a staging web app
   ```
3. In the web app set `VITE_API_URL=https://api.example.com` (the web adds `/v1`).
4. Serve both over **HTTPS**. Cookies set on a shared domain must be `Secure`, and Supabase marks them so only on HTTPS.
5. Supabase > Authentication > URL Configuration: **Site URL** = `https://app.example.com`; **Redirect URLs** must include `https://api.example.com/v1/auth/callback`.
6. Google Cloud (Web client): **Authorized JavaScript origins** = `https://app.example.com`; **Authorized redirect URIs** = `https://<project-ref>.supabase.co/auth/v1/callback`.
7. Restart the API after changing the variables. Existing sessions keep their old (host-only) cookie: users sign in again once.

**Two unrelated domains** (e.g. `app.foo.com` and `api.bar.com`): the cookie is third-party for the browser, and Safari and Chrome block or limit those. The web server never sees it either, so the sign-in screen can flash before redirecting. Avoid this setup: use subdomains of one domain, or serve the API through the web's own domain with a reverse proxy (e.g. `app.example.com/v1/*` forwarded to the API), which makes the cookie first-party.

**Local development** needs none of this: `localhost:5173` and `localhost:4000` share the host `localhost`, and cookies are not port-specific. Leave `COOKIE_DOMAIN` empty.

## 6. Release checklist

1. `pnpm typecheck && pnpm lint && pnpm test` pass.
2. New migrations are committed and were applied with `migrate:deploy` **before** the release.
3. New env variables are added to `.env.example` and to the production environment.
4. Deploy (5.1, 5.2 or 5.3) and check `/health`.
5. Any new manual SQL (4.3) was run by you.
6. For a migration, follow the checklist in 4.4.

## 7. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `/health` fails or the API cannot reach the database | Wrong `DATABASE_URL` (it must be the pooled, port `6543` string) |
| `migrate:*` fails to connect | `DIRECT_URL` missing or wrong (direct or session pooler, port `5432`) |
| `Cannot find module '@usegonche/database'` or Prisma client errors | Run `pnpm --filter @usegonche/database generate` |
| Google sign-in or the email link ends on a JSON error | `AUTH_REDIRECT_URL` / `AUTH_CALLBACK_URL` missing or wrong |
| `401` on `/v1/internal/reminders/process` | `INTERNAL_CRON_SECRET` is unset, or differs from the one in the SQL |
| Signed-in users still see the sign-in page for a moment in production | The web server does not receive the session cookie: set `COOKIE_DOMAIN=.example.com` on the API and use subdomains of one domain (5.4) |
| Browser error `blocked by CORS policy` | The web origin is not allowed: the API allows the origin of `AUTH_REDIRECT_URL` (set it to the web URL, e.g. `http://localhost:5173`) plus the optional comma-separated `CORS_ORIGINS`. Restart the API after changing `.env` |
| Web app types are stale after changing routes | `pnpm --filter @usegonche/api-client build` |
| Too many requests (`429`) while testing | Raise `RATE_LIMIT_*_PER_MINUTE` in `.env` |

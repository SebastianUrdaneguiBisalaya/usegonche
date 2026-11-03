# Contributing to useGonche

Thanks for your interest. useGonche is a personal productivity app for a **single user**. Before proposing a change, read [`README.md`](README.md) (what the product does and its business rules) and [`VISION.md`](VISION.md). The backend setup, migrations and deploy steps are in [`MANUAL.md`](MANUAL.md). Architecture rules for the code live in [`AGENTS.md`](AGENTS.md).

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems are reported privately, never in a public issue (see [`SECURITY.md`](SECURITY.md)).

## Repository layout

| Path                    | What it is                                                           |
| ----------------------- | -------------------------------------------------------------------- |
| `src/`                  | Hono API, feature-driven (`src/features/<name>`)                     |
| `apps/web`              | React Router web app (SSR)                                           |
| `apps/desktop`          | Electron shell that loads the web app                                |
| `apps/www`              | Next.js landing page                                                 |
| `packages/database`     | Prisma schema, migrations and clients (Supabase Postgres)            |
| `packages/auth`         | Supabase Auth building blocks                                        |
| `packages/storage`      | Signed-URL helpers for Supabase Storage                              |
| `packages/api-client`   | Typed Hono RPC client for the API                                    |

## Setup

Requirements: Node.js 22 or newer and pnpm (the version is pinned in `package.json`; `corepack enable` installs it). The full backend setup (environment variables, Supabase buckets) is in [`MANUAL.md`](MANUAL.md#1-first-time-setup-every-developer).

```bash
pnpm install        # or: make install
cp .env.example .env
```

## Commands

Every command is a `make` target that wraps the matching `pnpm` script. Run `make help` to list them all.

| Area     | Targets                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------ |
| API      | `api-dev`, `api-dev-worker`, `api-build`, `api-start`, `api-deploy-worker`, `api-client-build`   |
| Web      | `web-dev`, `web-build`, `web-start`                                                              |
| Desktop  | `desktop-dev`, `desktop-build`, `desktop-dist-mac`, `desktop-dist-win`, `desktop-dist-linux`     |
| Landing  | `www-dev`, `www-build`, `www-start`                                                              |
| Database | `db-generate`, `db-studio`                                                                       |
| Quality  | `lint`, `format`, `typecheck`, `test`, `test-watch`, `test-coverage`, `check`                    |
| Docker   | `docker-dev`, `docker-prod`                                                                      |

Notes:

- `desktop-dev` loads the web app, so start `web-dev` (and the API) first.
- After changing API routes or schemas, run `make api-client-build` before typechecking the apps. `make typecheck` already does it.
- Migrations are intentionally **not** in the Makefile. See [Database changes](#database-changes).

## Workflow

1. **Open an issue first**, however small the change. It needs:
   - a short, imperative **title** (`Add profiles feature to the API`);
   - a **description** with context, goal and an acceptance checklist;
   - a **label** for the feature or area (`auth`, `tasks`, `database`, `web`, `desktop`, `www`, ...). Reuse an existing label when it fits.
2. **Wait for agreement on product or domain changes.** The conceptual model is agreed before any schema is written. New entities, layers and settings need a real need in the current version: no speculative abstractions.
3. **Create a branch from `main`** named `<type>/<area>-<short-description>-<issue>`, for example `feat/web-recent-activity-152`. Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
4. **Commit** with [Conventional Commits](https://www.conventionalcommits.org/) and the issue number: `feat(history): add a global recent-activity endpoint (#151)`. Types match the branch types; the scope is the feature or app (`tasks`, `web`, `database`, ...).
5. **Run `make check`** (lint, typecheck and tests). It must pass.
6. **Open a pull request to `main`.** Put one closing keyword per issue on its own line in the description, so GitHub closes each of them on merge:

   ```
   Closes #12
   Closes #13
   ```

   Closing keywords only work in the PR description (or a commit that reaches `main`), not in the title or comments.
7. **Tick the issue checklist.** GitHub does not tick checkboxes on merge: before opening the PR, mark the finished items `- [x]` in the issue body and explain any unfinished ones in the PR.
8. A maintainer reviews and merges. Do not merge your own PR, and never push directly to `main`.

Do not add AI-tool attribution (`Co-Authored-By: ...`, "Generated with ...") to commit messages or PR descriptions.

## Code rules

### Product rules

- **Manual-first.** Every feature must work without AI. Automation may only propose; it never changes user data without explicit authorization.
- **Keep concepts separate by lifecycle:** task status, priority, scheduling, progress, blocking and sync state are different things. A task is not a time block. Replanning never rewrites task history.
- **Single user.** Do not add workspaces, organizations, memberships, roles or multi-tenant infrastructure. Keep an explicit owner on every resource.
- **Integrations** must go through adapters; the core domain never depends on provider types, and external items are not tasks until the user converts them.

### API (`src/`)

- One vertical slice per feature: `<feature>.routes.ts` (validators and thin handlers), `<feature>.schemas.ts` (Zod) and `<feature>.service.ts` (HTTP-agnostic business logic). Register the router in `src/routes.ts`. A feature never imports another feature's routes or schemas.
- Routers are **chained** (`new Hono<AppEnv>().get(...).post(...)`) so the RPC client infers the types. Service functions called from handlers have an **explicit return type**.
- Validate every input with `zValidator` and `z.strictObject` for writes. The user id comes from the auth claims, never from the body.
- Build every response with `ok`, `okWithMeta` or `fail` (`src/lib/http.ts`); services signal failure by throwing `AppError`. Response shape: `{ data }` or `{ error: { code, message, details? } }`.
- Scope every query by owner with `scoped(ownerId, where)`.
- Every list that can grow is offset-paginated with `src/lib/pagination.ts`, ordered by a timestamp and `id`, and backed by an index.
- Read env through `env(c)`, never `process.env`. Do not add server-side i18n: the API returns stable error `code`s and clients localize.

### Web (`apps/web`)

- Route modules load data with a `loader`. **Every protected loader and action authenticates the request itself**; never assume the layout did.
- react-query is the client cache. Do not add a second store for server data. The `QueryClient` is per request on the server.

### Database changes

- No `Json`/`jsonb` columns: use typed columns, enums or related tables. Rich text is Markdown in a `text` column.
- All ids are UUID v4 (`@db.Uuid @default(uuid(4))`); every user-owned table has an `owner_id` referencing the profile.
- Prisma manages only the `public` schema. Never model or migrate `auth.*` or `storage.*`.
- Create migrations with the commands in [`MANUAL.md`](MANUAL.md#4-migrations) and commit the schema and the new migration folder together. The API never runs migrations at startup; apply them as a deploy step before releasing the new API version.

### Tests

**Every service and every endpoint has Vitest tests**, written with the feature; a feature without tests is not done. Colocate them as `<feature>.service.test.ts` and `<feature>.routes.test.ts`, and use the helpers in `src/test/helpers.ts`.

- Services: business rules, success and failure paths (`AppError` codes) and owner scoping (a user never reads or changes another user's data).
- Endpoints: validation (422 with `details`), auth (401), not found (404), success status and body envelope.

### Style

Formatting and linting are handled by a single Biome config at the repo root (`make lint`, `make format`). Do not add per-app Biome configs. Every `tsconfig.json` extends `tsconfig.base.json`.

## Pull request checklist

- [ ] There is an issue, and the PR description has one `Closes #<n>` per issue.
- [ ] The issue checklist is up to date.
- [ ] `make check` passes.
- [ ] New or changed services and endpoints have tests.
- [ ] If routes or schemas changed, the API client was rebuilt and the apps typecheck.
- [ ] If the schema changed, the migration is committed with it and nothing was applied automatically.
- [ ] Behaviour that changes a business rule is reflected in [`README.md`](README.md).
- [ ] No secrets, `.env` files or AI attribution lines are included.

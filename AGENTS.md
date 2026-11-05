# AGENTS.md

Monorepo (pnpm workspaces). Root `src/` is the Hono API; apps live in `apps/` (`desktop`, `web`, `www`); shared code lives in `packages/`.

## Product context

**useGonche** is a **personal productivity app for a single user**: it turns messy work into concrete, executable progress and helps decide _what to do, when and how_. It is not a Notion/Todoist/Sunsama clone, not enterprise software, not collaborative and not multi-tenant.

- **Flow Cycle**: the product methodology (see below). The user is never forced through every stage and can work manually at any time.
- **Manual-first**: the app must work fully without AI. AI/automation is optional, complementary, and must never modify user data without explicit authorization.
- **Integrations** (GitHub first; Google Calendar/Drive, Notion, Gmail, Slack, Meet/Zoom later) feed work into useGonche without replacing those tools. External items are _not_ tasks until the user converts them. The core domain must never depend on provider types (use adapters / anti-corruption layers). A repository is not a task or a project.
- **Single user now, evolvable later**: do NOT implement workspaces, organizations, memberships, invitations, roles/permissions or multi-tenant infrastructure in the MVP. Keep a well-defined user identity, an explicit owner on every resource, and no irreversible coupling between personal data and the auth account, so multi-user can be added later by domain evolution.
- **Keep concepts separate by lifecycle**: task status vs priority vs scheduling vs progress vs blocking vs external sync state; a Task is not a Time Block (a task can have zero or many blocks); replanning must not rewrite task history.
- **No speculative abstractions**: do not add entities, layers or settings without a real need in the current version. Justify every new entity (entity vs value object vs relation).
- Product/domain decisions are made with the user first; the conceptual model is agreed before any schema is written.

### Flow Cycle (methodology)

Provisional, not scientifically validated, open to revision. It is a loop: Reflect feeds the next Plan. **Four visible stages**; Clarify and Prioritize are internal (they run as suggestions inside Process, never as modules).

| Visible stage | Internal stages      | What it is                                                                                                                                                                                                                                                                           |
| ------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Capture**   | Capture              | Fast entry of anything (task, idea, project, note, reminder, reference). No organizing required. Brain Dump is one way to capture.                                                                                                                                                   |
| **Process**   | Clarify + Prioritize | Empty the inbox: what is it, does it need action, which project, deadline, dependencies, now/later/never. Priority is a simple level plus explainable suggestions; no mandatory Eisenhower matrix or scoring.                                                                        |
| **Today**     | Plan + Execute       | Pick today's work against real capacity (availability, calendar events, estimates, deadlines, dependencies), optionally time-block it, then work with task/project/note context, log progress and blockers, and replan on interruptions. Time Blocking is a tool, not a requirement. |
| **Reflect**   | Reflect              | Daily and weekly review: planned vs executed, carry-over decisions, recurring blockers. It must produce decisions, not reports to maintain.                                                                                                                                          |

Principles: suggestions are explainable (reason codes, not opaque scores); replanning never rewrites a task's history; nothing is mandatory; AI only proposes.

### MVP scope

In the MVP: the Flow Cycle (inbox, projects, goals, tasks with dependencies/blockers/subtasks, notes, attachments, tags, availability, calendar events, daily plan, time blocks, functional history, daily/weekly review).

Rich text (TipTap on the frontend) is converted to **Markdown on the client** and stored as a plain **`text` column** (never a `Json`/`jsonb` column). The API only bounds its size (`markdownSchema`, `src/lib/markdown.ts`); it does not parse it. Being plain text, it is searchable directly by full-text search (no separate plain-text column). Files live in Supabase Storage. Backend first; frontend later.

### Deferred features (out of the MVP, to review later)

- **Recurrences** (recurring tasks, recurrence rules). Day-level version implemented in `src/features/recurrences` (#34): occurrences are generated by `POST /recurrences/:id/materialize` (idempotent, 14-day window), and **something must call it periodically**: the client when opening Today, and later the `pg_cron` job of the reminders work (#35). Tasks stay date-only; a rule with `startMinute` + `durationMinutes` (e.g. "every day at 9 am") also plans a TimeBlock on each occurrence, in the user's timezone.
- **Reminders**: entity, API and due processing implemented in `src/features/reminders` (#35). A reminder targets exactly one task, event or note and is independent of due dates. `pg_cron` calls `POST /v1/internal/reminders/process` (secret header `x-internal-secret` = `INTERNAL_CRON_SECRET`; script in `packages/database/prisma/manual/reminders-pg-cron.sql`, applied by the user). Reminders are **internal only**: the user sees them in the web app (Reminders page); there is no email or push delivery. The job just marks due reminders as `sent`.
- **Third-party integrations**: GitHub (repos, issues, PRs, reviews, releases), Google Calendar, Google Drive, Notion, Gmail, Slack, Google Meet/Zoom. Needs: ExternalAccount, ExternalResource, task-resource link, sync cursors, webhooks, dedupe/conflict handling.
- **AI** and **agents** (always as proposals the user accepts), **automations** and custom **workflows**, **planning rules**.
- **Productivity metrics** beyond the review snapshots.
- **Note revision history** (versioning).
- **Enterprise-style audit log** (only the functional history exists).
- **Multi-user and collaboration**: workspaces, organizations, memberships, invitations, roles/permissions, comments.

## Issue tracking (MANDATORY, never forget)

**Every time the user requests a task, the agent MUST create a GitHub issue BEFORE starting any work.** No exceptions, however small the task. The issue needs:

- **Name** (title): short, imperative, specific (e.g. `Add profiles feature to the API`).
- **Description** (body): context, goal, acceptance criteria / checklist of what will be done.
- **Label**: the feature or area the task belongs to (e.g. `auth`, `me`, `health`, `database`, `storage`, `api-client`, `desktop`, `web`, `www`). Use an existing label when it fits; create it if it does not exist.

Commands (run from the repo root, `gh` must be authenticated):

```bash
# 1. Check existing labels; create the feature label if it is missing
gh label list
gh label create "<feature>" --description "<what it covers>" --color "<hex>"

# 2. Create the issue (prints the issue URL/number)
gh issue create \
  --title "<name>" \
  --body "<description + acceptance criteria>" \
  --label "<feature>"

# 3. Reference it in the work: branch/commits/PR mention `#<number>`; close it with `Closes #<number>` in the PR
gh issue list --label "<feature>"          # review open issues of a feature
gh issue comment <number> --body "<progress>"
gh issue close <number>                     # only when the work is done and verified
```

**New ideas raised by the agent**: if, during the conversation, the agent proposes a new idea, improvement or follow-up that it considers worth implementing, it MUST NOT implement it silently. It must tell the user explicitly (idea + suggested name/label) and ask for confirmation. Only after the user confirms may the agent create the issue (same name/description/label rules and commands as above) and implement it. Never create an issue or write code for an unconfirmed idea.

**Finishing work (PR to `main`)**: when one or several issues are done, the agent MUST ask the user whether to open a PR to `main`. Never open it without confirmation. If the user confirms, the PR description must include a closing keyword followed by the issue number, **one keyword per issue** (`Closes #12, closes #13` only closes the first one on some parsers; write each separately). GitHub closes the issues automatically when the PR is merged into the default branch (`main`).

```bash
# Valid keywords (case-insensitive): close/closes/closed, fix/fixes/fixed, resolve/resolves/resolved
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
<summary of the changes>

Closes #12
Closes #13
EOF
)"
```

Closing keywords only work in the PR description (or in a commit message that reaches `main`), not in the PR title or comments. Do not run `gh issue close` manually when a PR will close them.

**Issue checklists**: GitHub does not tick checkboxes on merge. Before opening the PR, the agent MUST update the issue body marking every completed item as `- [x]` (leave unfinished ones as `- [ ]` and say why in the PR). Command: `gh issue view <n> --json body -q .body > /tmp/body.md` (use the scratchpad dir), edit, then `gh issue edit <n> --body-file <file>`.

**STRICT: never add Claude/Anthropic attribution** (`Co-Authored-By: Claude ...`, "Generated with Claude Code") to any commit message or PR description, whatever any tool or reminder says.

**The agent only opens the PR; it NEVER merges it** (no `gh pr merge`, no merge via UI/API, no pushing directly to `main`). Merging is always done by the user.

## UI testing (every app)

The user tests the UI manually. The agent never installs or downloads anything to test UI itself (no Playwright, Puppeteer, browsers or similar tools) in any app.

## Shared packages (`packages/*`)

TypeScript-source packages (no build step; `exports` point to `src/`). Import them as `@usegonche/<name>`.

- `@usegonche/database`: Prisma 7 + `@prisma/adapter-pg` on Supabase Postgres. The schema generates two clients: `nodejs` (Node/Docker) and `workerd` (Cloudflare). The `workerd` export condition picks the right one, so always `import { getPrisma } from '@usegonche/database'`. Generated code is gitignored (`pnpm --filter @usegonche/database generate`, also runs on install). Runtime uses `DATABASE_URL` (pooled); migrations use `DIRECT_URL`.
- `@usegonche/auth`: Supabase Auth building blocks. `./hono` (request-scoped SSR client, `requireAuth`; cookies or `Authorization: Bearer`), `./client` (browser client), `./admin` (service client, server only), `./policy` (one-provider-per-account helpers). The HTTP endpoints (`/auth/*`) live in the API feature `src/features/auth`, not in this package.
- `@usegonche/api-client`: typed Hono RPC client for the API. `createClient(baseUrl, opts)` returns the typed `hc` client; also re-exports `AppType`, `InferRequestType`, `InferResponseType`. Its `exports.types` points to the **built** `dist/` (precomputed client type, keeps editors fast), so run `pnpm --filter @usegonche/api-client build` after changing API routes/schemas (before typechecking client apps).
- `@usegonche/storage`: `createStorage(supabaseClient, { public, private })` returns signed URLs only (`uploadUrl`, `readUrl`, plus `list`/`remove`). Files never go through the API: clients upload/download straight to Supabase Storage. `visibility` picks the public or private bucket.

## API runtimes

Every endpoint lives under **`/v1`** (`/v1/auth/login`, `/v1/tasks`, ...) except `GET /health`; `src/app.ts` adds the prefix, so feature routers and `AppType` stay unprefixed and API clients are created with base URL `<API_URL>/v1`. `src/app.ts` is runtime-agnostic. `src/index.ts` is the Node entry (`pnpm dev`, `pnpm build` -> single-file `dist/index.js` for Docker/droplet). `src/worker.ts` is the Cloudflare Workers entry (`pnpm dev:worker`, `pnpm deploy:worker`, config in `wrangler.jsonc`). Read env through `hono/adapter`'s `env(c)`, never `process.env` inside the app.

## API architecture (Hono, feature-driven + RPC)

Feature-driven (vertical slices), **not** hexagonal: no ports/adapters, no repository interfaces, no DI container. Each feature owns its HTTP, validation and business logic; Prisma (`@usegonche/database`) is used directly, it is already the data layer.

```
src/
├── index.ts            # Node entry (adapter only)
├── worker.ts           # Cloudflare Workers entry (adapter only)
├── app.ts              # Builds the app: global middleware + routes + onError. Runtime-agnostic
├── env.ts              # Bindings / Variables types (AppEnv) shared by every feature
├── routes.ts           # Aggregator: chains `.route()` per feature; exports `AppType`
├── features/           # attachments, auth, goals, health, history, inbox, me, notes, planning, profile, projects, reminders, reviews, search, tags, tasks
│   └── <feature>/      # e.g. profiles, posts
│       ├── <feature>.routes.ts    # Hono sub-app: validators + thin handlers
│       ├── <feature>.schemas.ts   # Zod schemas (+ inferred types)
│       └── <feature>.service.ts   # Business logic, HTTP-agnostic (plain functions)
├── middleware/         # Cross-cutting only (error handler, prisma, rate limit)
└── lib/                # Shared helpers: http (ok/fail), errors (AppError, ErrorCode + messages), validator
```

No `db/` folder: schema, migrations and client live in `packages/database`. Auth lives in `@usegonche/auth`.

### Rules

- **Slice isolation**: a feature never imports another feature's `routes`/`schemas`. If two features need the same logic, extract it to `lib/` or call the other feature's `service`. Anything used by one feature stays in that feature.
- **Routes are thin**: validate (Zod) -> call service -> `c.json(data, status)`. No Prisma queries or business rules in handlers once they grow past a few lines; move them to `<feature>.service.ts`.
- **Services are HTTP-agnostic**: plain functions receiving what they need (`prisma`, ids, parsed input), never `Context`. Throw `HTTPException` or typed domain errors; do not build `Response`s there.
- **Env**: type the app as `new Hono<AppEnv>()` from `env.ts`; read env through `env(c)`, never `process.env`.

### RPC (type-safe client)

- Every feature router is a **chained** `new Hono<AppEnv>().get(...).post(...)` expression exported as default. Never `const r = new Hono(); r.get(...)` (statements break type inference).
- `src/routes.ts` chains `.route('/profiles', profiles).route('/posts', posts)` and exports `export type AppType = typeof routes`. `app.ts` mounts `routes`. Apps never import from root `src/`: they use `createClient` from `@usegonche/api-client`.
- Handlers must return `ok(c, data, <status>)` / `fail(c, code, <status>)` (explicit literal status: 200, 201, 404, ...) so the client infers each response by status. Never `c.notFound()` or `c.text()` for errors in RPC routes; use `fail(c, 'not_found', 404)` (see Response contract).
- Handlers must be `async`/`await`; never return a `.then()` chain (type becomes `unknown`).
- Global errors (`onError`, auth failures) are not inferred; wrap with `ApplyGlobalResponse` when the client needs them.
- Service functions called from RPC handlers must have an **explicit return type** (e.g. `Promise<Profile | null>`); inferred Prisma types are not portable and break the `api-client` declaration build (TS2883).
- Pin the same `hono` version in the API and every client app (mismatch gives "type instantiation is excessively deep"). `"strict": true` is required in both server and client tsconfigs (already in `tsconfig.base.json`).
- IDE slowness with many routes: keep one router per feature (never one giant chain), and create per-feature clients when needed (`hc<typeof profiles>('/profiles')`). Use `$path()`/`$url()` with an absolute base URL.
- Route/query params are strings on the wire: use `z.coerce.*` in the schema, pass strings from the client. Encode params with `encodeURIComponent`.
- Cookies: create the client with `init: { credentials: 'include' }`; for bearer auth, pass `headers: { Authorization: ... }`.

### Pagination (offset)

Every list endpoint that can grow uses `src/lib/pagination.ts` (never an unbounded list). Offset pagination (`?page=<n>&pageSize=<n>`, 1-based) so tables can show page numbers and a total; the web tables keep `page` in the URL (nuqs). Lists are ordered by a timestamp descending with `id` as tie-breaker, so pages do not overlap.

- Query: `z.object({ ...paginationQuery, ...filters })` gives `page` (default 1) and `pageSize` (default 50, max 100).
- Service: return `Paged<T>` (`{ items, total }`): `const [items, total] = await Promise.all([findMany({ orderBy: pageOrder('<timestampField>'), ...pageArgs(page), where }), count({ where })])`.
- Route: `const { items, total } = await listX(prisma, ownerId, filters, { page, pageSize })` then `okWithMeta(c, items, pageMeta({ page, pageSize }, total), 200)`. The meta is `{ page, pageSize, total, pageCount }` (`pageCount` is at least 1). Endpoints may add their own meta keys (e.g. inbox `counts`).
- Back the ordering with an index `(owner_id, [filters...], <timestampField>)`.

### Validation (Zod 4)

- Use `zValidator` from `@hono/zod-validator` (add it to the root with `pnpm add @hono/zod-validator`; `zod` is already installed) for every input target (`json`, `form`, `query`, `param`, `header`), never read `c.req.json()` raw. Header keys are lowercase.
- Schemas live in `<feature>.schemas.ts`; export the schema and `z.infer` type. Reuse them in clients (`InferRequestType`) instead of redefining types.
- `json`/`form` validation requires the matching `Content-Type`; set it in tests that call `app.request()`.
- Make unknown keys explicit (`z.strictObject` for write inputs). Never trust `c.req.valid()` data for authorization: take the user id from `c.get('claims')`, not from the body.
- Use `.use(requireAuth())` at the router level for protected features so no handler forgets it.

### Response contract (every endpoint)

- Success: `{ data: T }` (+ `meta` for pagination etc.). Error: `{ error: { code, message, details?, requestId? } }`. HTTP status carries the status (no `statusCode`/`timestamp` in the body).
- `code` is a stable, machine-readable `ErrorCode` (clients branch on it); `message` is a default English fallback (clients localize by `code`); `details` is `[{ field, code }]` for validation errors.
- Always build responses with `ok(c, data, status?)` / `okWithMeta(...)` / `fail(c, code, status, details?)` from `src/lib/http.ts`; never hand-write `c.json({ error })` in features. Redirects/streams are the only exceptions.
- Validation: `zValidator(target, schema, validationHook)` (`src/lib/validator.ts`) -> 422 `validation_error` with `details`. Routes with a special failure answer (login, forgot-password) pass their own hook.
- Services signal failure by throwing `new AppError(code, status, details?)`; `onError` (`src/middleware/error.ts`) converts it, `HTTPException` and unexpected errors (always `internal_error`, never the raw message) to the envelope. 404s go through `notFound`. Thrown errors are not inferred by RPC; handlers that want typed errors `return fail(...)`.

### i18n

The API does not translate. `message` is a default English fallback; clients localize using the stable `code`. Do not add server-side i18n libraries (`hono-intlayer` pulled the whole build engine into the Worker bundle, +~1 MB gzip).

### Database & migrations

- Supabase owns the `auth` schema (`auth.users`, sessions, identities) and `storage`; they exist in every Supabase project, no migration needed. Prisma only manages the `public` schema (e.g. `profiles`, whose `id` mirrors `auth.users.id`). Never model or migrate `auth.*` tables.
- **No JSON/JSONB columns** (`Json` in Prisma) for domain data: they cannot be typed correctly end to end. Model structured data as typed columns, enums, value-object columns or related tables. History/audit events must be typed tables, never a generic JSON blob. Only exception: opaque third-party payloads that useGonche never queries or interprets, and only with explicit user approval.
- **All IDs are UUID v4**, in every table and consistent with Supabase (`auth.users.id` is v4). Use `@db.Uuid` with `@default(uuid(4))` (or `gen_random_uuid()` at DB level); never `cuid`, `uuid(7)`, autoincrement or ids without a default. Tables whose `id` mirrors `auth.users.id` (e.g. `profiles`) take the value from Supabase instead of generating it.
- Every user-owned table carries an explicit owner column referencing the user's profile id (single user today, keeps the door open for more later).
- `profiles.id` is linked to `auth.users(id)` by a manual-SQL migration (FK `ON DELETE CASCADE` + `on_auth_user_created` trigger that inserts the profile). It is not in `schema.prisma`, and `migrate dev` cannot validate it on a shadow DB; the user applies it on Supabase. `syncProfile` stays as an idempotent fallback.
- **The agent NEVER runs migrations or any schema-changing command against Supabase** (`migrate dev/deploy/reset`, `db push`, raw SQL). It only generates types (`prisma generate`) and migration files offline (`prisma migrate diff --from-empty --to-schema ... --script`); the user applies them.
- Migrations are **never** run by the API at startup. Create them with `pnpm --filter @usegonche/database migrate:dev` (uses `DIRECT_URL`, commit the generated `prisma/migrations/`), apply them with `migrate:deploy` as a deploy/CI step before releasing the new API version.

### Testing (Vitest, mandatory)

- **Every service and every endpoint must have Vitest tests**, written together with the feature (a feature without tests is not done). Colocate as `<feature>.service.test.ts` and `<feature>.routes.test.ts`.
- Service tests: business rules and invariants, success and failure paths (`AppError` codes), owner scoping (a user never reads or mutates another user's data).
- Endpoint tests: call `app.request()` with the right `Content-Type`; cover validation (422 + `details`), auth (401), not found (404), success status and body envelope, and that the user id comes from the claims.
- Shared helpers live in `src/test/helpers.ts`: `createMockPrisma()` (lazy `vi.fn()` per `prisma.<model>.<op>`), `createTestApp(router, { path, claims, prisma })` (real `requireAuth` with a fake Supabase; `claims: null` gives 401), `jsonRequest()`, `TEST_USER_ID`/`OTHER_USER_ID`.
- Scope every query by owner with `scoped(ownerId, where)` from `src/lib/owner.ts`.
- Run `pnpm test` (and `pnpm test:coverage` when relevant) along with lint and typecheck before declaring a task done.

### Adding a feature

1. Create `src/features/<name>/` with `schemas`, `service`, `routes`, plus their `*.test.ts`.
2. Chain it in `src/routes.ts`.
3. Run `pnpm typecheck`, `pnpm lint` and `pnpm test`; check the client sees the new route's types.

- TypeScript: every `tsconfig.json` (root and `apps/*`) extends `tsconfig.base.json`. Put only app-specific options in each app.
- Lint/format: a single `biome.json` at the root. Do not add per-app Biome configs or Biome dependencies.
- Every package exposes `lint`, `format` and `typecheck` scripts. Run lint and typecheck before declaring any task done.

## apps/web (React Router)

SSR is on (`ssr: true`) and the Electron app (`apps/desktop`) loads the deployed/dev web URL, so server `loader`s work there too. If the web is ever bundled as static files inside Electron, SSR must be turned off and every `loader` becomes a `clientLoader`.

### Data loading

- **Route modules load their data with `loader`** (server, initial render and client navigations through an automatic fetch) and read it with `useLoaderData<typeof loader>()`. `clientLoader` (+ `HydrateFallback`) is for data that only the browser can fetch. Loaders return plain serializable values; they may also return unawaited promises, read with `<Suspense>` + `<Await>`, to stream slow, non-critical data behind a skeleton instead of blocking the page.
- **A parent loader does NOT protect its children.** React Router runs matched loaders in parallel and a child can be requested on its own (fetchers, navigations that skip revalidating the parent). So the layout's session check (`features/protected/layout.tsx`) is only for redirecting and first paint: **every protected loader and action must authenticate the request itself** (forward the cookie to the API, `createClient(API_BASE, { headers: { cookie } })`) and never assume the layout already did. The API stays the authority: `requireAuth` plus owner-scoped queries.
- **The session cookie always reaches the web server** (same host in dev, a shared `COOKIE_DOMAIN` in production; required). So on the server a missing cookie means **signed out**: protected loaders call `requireSignedIn(request)` (`lib/session.server.ts`), which redirects to sign-in on no cookie or a 401/403, redirects to `/onboarding` from the layout while it is unfinished, and forwards the API's refreshed `Set-Cookie`. There is no client-side session gate or full-screen skeleton: the layout (sidebar, page titles) paints on the first render and only data areas show skeletons. The protected layout's `shouldRevalidate` keeps the resolved session across page navigations.
- **react-query stays the client cache** (mutations, refetching, the shared `['session']` entry). A loader that resolves data the UI also reads through `useQuery` seeds that same cache (`queryClient.setQueryData(key, loaderData)` during render) so there is a single source of truth and no duplicate request. Do not add a second store (zustand) for server data.
- **`QueryClient` is per request on the server** and a singleton in the browser (`providers/query-client.tsx`). Never create it at module level for the server: a shared cache would leak one user's data to the next.

## apps/www (Next.js)

<!-- BEGIN:nextjs-agent-rules -->

### This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from `apps/www`; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## apps/mobile (React Native + Expo)

### This is NOT the Expo you know

- The app uses **Expo SDK 58**, which has breaking changes versus your training data. For every Expo / React Native task, first load the matching Expo skills in `.claude/skills/` (start with `expo-overview`, which routes to the rest) instead of relying on memory.
- Targets **iOS and Android only**, never web (the web is `apps/web`). The phone covers capturing, executing and closing the day; organizing stays on desktop, so do not port every web view.
- Styles: use `StyleSheet.create`, declared at the bottom of each component file.
- Run the app with local development builds (`npx expo run:ios` with Xcode and the iOS Simulator on the Mac), not Expo Go.

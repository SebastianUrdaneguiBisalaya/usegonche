# AGENTS.md

Monorepo (pnpm workspaces). Root `src/` is the Hono API; apps live in `apps/` (`desktop`, `mobile`, `web`, `www`); shared code lives in `packages/`.

## Shared packages (`packages/*`)

TypeScript-source packages (no build step; `exports` point to `src/`). Import them as `@usegonche/<name>`.

- `@usegonche/database`: Prisma 7 + `@prisma/adapter-pg` on Supabase Postgres. The schema generates two clients: `nodejs` (Node/Docker) and `workerd` (Cloudflare). The `workerd` export condition picks the right one, so always `import { getPrisma } from '@usegonche/database'`. Generated code is gitignored (`pnpm --filter @usegonche/database generate`, also runs on install). Runtime uses `DATABASE_URL` (pooled); migrations use `DIRECT_URL`.
- `@usegonche/auth`: Supabase Auth. `./hono` (request-scoped SSR client, `requireAuth`; cookies or `Authorization: Bearer`), `./client` (browser client), `./admin` (service client, server only).
- `@usegonche/storage`: `createStorage(supabaseClient, { public, private })` returns signed URLs only (`uploadUrl`, `readUrl`, plus `list`/`remove`). Files never go through the API: clients upload/download straight to Supabase Storage. `visibility` picks the public or private bucket.

## API runtimes

`src/app.ts` is runtime-agnostic. `src/index.ts` is the Node entry (`pnpm dev`, `pnpm build` -> single-file `dist/index.js` for Docker/droplet). `src/worker.ts` is the Cloudflare Workers entry (`pnpm dev:worker`, `pnpm deploy:worker`, config in `wrangler.jsonc`). Read env through `hono/adapter`'s `env(c)`, never `process.env` inside the app.

## Shared tooling

- TypeScript: every `tsconfig.json` (root and `apps/*`) extends `tsconfig.base.json`. Put only app-specific options in each app.
- Lint/format: a single `biome.json` at the root. Do not add per-app Biome configs or Biome dependencies.
- Every package exposes `lint`, `format` and `typecheck` scripts. Run lint and typecheck before declaring any task done.

## apps/www (Next.js)

<!-- BEGIN:nextjs-agent-rules -->

### This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from `apps/www`; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## apps/mobile (Expo / React Native)

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

### Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `apps/mobile/package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

### Commands (run from `apps/mobile`)

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
pnpm lint                   # lint (Biome)
pnpm typecheck              # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

### Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `apps/mobile/src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

### Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

### Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

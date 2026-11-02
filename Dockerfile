# syntax=docker/dockerfile:1
# Production image of the API (Node entry). `pnpm build` bundles everything, including the @usegonche/* workspace
# packages, into a single dist/index.js, so the runtime image needs no node_modules.
# Migrations are never run here: apply them as a deploy step (`pnpm --filter @usegonche/database migrate:deploy`).

FROM node:22-slim AS build
# pnpm version comes from `packageManager` in package.json.
RUN corepack enable
WORKDIR /app
COPY . .
# Only the API and the packages it depends on (`usegonche...`); the `postinstall` of @usegonche/database generates the Prisma clients.
RUN pnpm install --frozen-lockfile --filter "usegonche..."
RUN pnpm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
# The bundle is ESM; there is no package.json next to it, so the .mjs extension is what makes Node treat it as a module.
COPY --from=build --chown=node:node /app/dist/index.js ./index.mjs
USER node
EXPOSE 3000
# /health queries the database, so it also reports a broken DATABASE_URL.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.mjs"]

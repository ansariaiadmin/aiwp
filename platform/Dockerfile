# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# AiWp Platform — multi-stage production image.
#
# Stage 1 (deps):    installs dependencies with a reproducible lockfile.
# Stage 2 (builder): builds the Next.js app (standalone output).
# Stage 3 (runner):  minimal, non-root runtime image — no build toolchain,
#                     no dev dependencies, no source maps for internals.
#
# Notes on what actually needs to be copied into the runner:
#  - .next/standalone already contains a self-sufficient node_modules with
#    every runtime dependency Next.js's own bundler (Turbopack) traced and
#    inlined for the app itself (Next.js bundles `postgres`, `jose`,
#    `hash-wasm`, etc. directly into its output chunks — they do NOT need
#    to be copied separately).
#  - scripts/migrate.mjs and scripts/seed-admin.mjs are plain Node scripts
#    run directly (not through Next's bundler), so they need their own
#    dependencies (`postgres`, `hash-wasm`) copied from the full
#    node_modules explicitly.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No build-time placeholders are needed: the database client is created
# lazily on first use (src/lib/db/index.ts), so `next build` runs without a
# DATABASE_URL. Every secret is read from the runtime environment per
# request — none is inlined at build time (no NEXT_PUBLIC_* secret exists).
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Standalone migration/seed tooling: plain Node scripts + their own
# (small) runtime dependencies, run via `docker compose run` — see
# docs/DEPLOYMENT.md.
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed-admin.mjs ./scripts/seed-admin.mjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/hash-wasm ./node_modules/hash-wasm

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

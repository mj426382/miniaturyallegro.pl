# syntax=docker/dockerfile:1.7
#
# Multi-stage build:
#   builder – installs all deps, generates the Prisma client and compiles TypeScript
#             (also used by infra/docker-compose.dev.yml via `target: builder`)
#   runner  – slim production image with prod deps only, running as non-root
#
# Build:  docker build -t ghcr.io/mj426382/allgrafika-backend:latest .

FROM node:24-slim AS base
WORKDIR /app
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

# ─── builder ─────────────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund \
 && npx prisma generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ─── runner ──────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `prisma` (CLI) is a runtime dependency on purpose: `migrate deploy` runs at container start.
RUN npm ci --omit=dev --no-audit --no-fund \
 && npx prisma generate \
 && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY scripts ./scripts

RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node scripts/migrate.js && node dist/main"]

# syntax=docker/dockerfile:1
#
# Eventsika — multi-stage image.
#   deps    : lockfile-exact dependency install (Linux binaries)
#   dev     : `next dev` against a bind-mounted source tree (see compose.yaml)
#   builder : `npm run build` (webpack) -> .next/standalone
#   runner  : minimal non-root production-style runtime (`node server.js`)
#
# Secrets are NEVER baked in: no .env file is copied (see .dockerignore) and no
# private value is accepted as a build argument. All credentials are runtime-only.

ARG NODE_IMAGE=node:24-bookworm-slim

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS dev
WORKDIR /app
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# node_modules lives in the image (and a named volume in compose) so the
# Windows host's node_modules can never shadow the Linux binaries.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
RUN mkdir -p .next && chown node:node /app /app/.next
USER node
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# PUBLIC values only, all optional. Next.js inlines any NEXT_PUBLIC_* variable
# that is DEFINED during `next build` (even as an empty string) into the
# compiled output. Build args are exposed to RUN only when actually passed, so
# an omitted arg stays undefined and the code keeps reading it at runtime.
# Do NOT convert these to ENV: that would define omitted args as "".
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# Liveness only: /api/health is static and touches no database or provider.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]

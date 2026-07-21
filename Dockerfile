# Debian-based (not alpine) — rivetkit's dependency tree includes native
# modules (better-sqlite3, cbor-extract) whose prebuilt binaries generally
# target glibc, not musl; alpine risks a slow node-gyp fallback build.
FROM node:24-slim

WORKDIR /app

# npm workspaces monorepo — client/server/shared all need to be present
# before `npm ci` so workspace symlinks resolve correctly.
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm ci

COPY . .

# Client is a static Vite build; server has no compile step (runs via tsx,
# same as local dev — see server/package.json).
RUN npm run build --workspace=client

# registry.start() in serverless mode (set automatically by Rivet Compute)
# serves the actor API under /api/rivet and, when this is set, the built
# client from the same origin — no separate frontend host, no CORS.
ENV RIVETKIT_PUBLIC_DIR=/app/client/dist

EXPOSE 3000

CMD ["npx", "tsx", "server/src/index.ts"]

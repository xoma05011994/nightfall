# Debian-based (not alpine) — rivetkit's dependency tree includes native
# modules (better-sqlite3, cbor-extract) whose prebuilt binaries generally
# target glibc, not musl; alpine risks a slow node-gyp fallback build.
FROM node:24-slim

WORKDIR /app

# npm workspaces monorepo — root package.json lists all three workspaces,
# so `npm ci` needs every workspace's package.json present even though only
# server/shared source actually gets copied in and run (client deploys
# separately to Vercel; this image is server-only, for Railway/self-hosted
# RivetKit). Installing client's deps too is wasted space but harmless.
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm ci

COPY server server
COPY shared shared

# No compile step — runs via tsx, same as local dev (see server/package.json).
EXPOSE 8080

CMD ["npx", "tsx", "server/src/index.ts"]

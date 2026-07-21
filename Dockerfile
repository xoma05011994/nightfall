FROM node:24-slim

WORKDIR /app

# npm workspaces monorepo — root package.json lists all three workspaces,
# so `npm ci` needs every workspace's package.json present even though only
# server/shared source actually gets copied in and run (client deploys
# separately to Vercel; this image is server-only). Installing client's
# deps too is wasted space but harmless.
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN npm ci

COPY server server
COPY shared shared

# No compile step — runs via tsx, same as local dev (see server/package.json).
# A plain WebSocket server now (ws package, no native deps at all) — the
# process binds directly to $PORT (default 8080) and needs Railway's public
# networking enabled, since browser clients connect to it directly.
EXPOSE 8080

CMD ["npx", "tsx", "server/src/index.ts"]

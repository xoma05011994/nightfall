# Agent notes

## Multiplayer architecture

The multiplayer server (`server/`) is a plain WebSocket server (the `ws`
package — no external service, no native dependencies). It previously used
RivetKit/Rivet Cloud; that was removed after Rivet's engine hit a
persistent, unresolvable actor-scheduling bug (`no_capacity` on every fresh
actor, reproduced identically across three independent runner locations —
Rivet Compute's managed pool, a self-hosted Railway runner, and a home
network runner). Do not reintroduce a dependency on Rivet/RivetKit without
a strong reason; if considering it, verify current platform stability first
rather than assuming past issues are resolved.

`server/src/room.ts`'s `Room` class is a direct port of the old RivetKit
`match` actor's tick-loop logic — same simulation steps, same ordering,
just a plain class + `setInterval` instead of an actor framework. The
`shared/systems/*` game logic never depended on RivetKit at all and is
untouched by any of this.

## Deployment

Client (Vercel, static Vite build) and server (Railway, Docker container
with public networking) deploy completely independently — no shared
origin, no CORS setup needed (WebSocket connections aren't subject to CORS
the way fetch/XHR are). See `README.md`'s Deployment section for specifics.

# Agent notes

## RivetKit reference

For any future work touching `server/` (the RivetKit `matchmaker`/`match`
actors) or the client's `net/` connection code, read
https://rivet.dev/llms.txt first — it's the current index of RivetKit's own
docs (actors, state, events, actions, connections, clients, deploy targets)
and is more likely to be accurate than pre-trained knowledge, since RivetKit
moves fast.

## Deployment

Client and server are deployed together as a single Rivet Compute app (see
`Dockerfile`) — `registry.start()` in serverless mode serves both the
`/api/rivet/*` actor API and the built client (via `RIVETKIT_PUBLIC_DIR`)
from one origin, so there's no cross-origin/CORS setup to maintain. See
`README.md`'s Deployment section for the actual deploy command.

import { createServer } from "node:http";
import { setup } from "rivetkit";
import { matchmaker } from "./actors/matchmaker";
import { match } from "./actors/match";

// Windows has no published native N-API binary for rivetkit's native runtime
// as of 2.3.4, and the WASM fallback's local-engine-spawn path isn't
// compatible with the WASM runtime on this version — same constraint already
// documented for this repo's earlier 3D prototype (game/README.md). The
// server therefore runs under WSL; see survivor-2d/README.md.
export const registry = setup({
  use: { matchmaker, match },
});

registry.start();

// registry.start() in the default "envoy" runtime mode (used here, not Rivet
// Compute's "serverless" mode) doesn't bind any port — it only opens a
// persistent outbound connection to Rivet's engine (RIVET_ENDPOINT), which
// is how actors actually get hosted. Railway (and most PaaS health checks)
// still expect the deployed process to answer on $PORT, so this tiny server
// exists purely to satisfy that — it has nothing to do with actor traffic.
const healthPort = Number(process.env.PORT) || 8080;
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok");
}).listen(healthPort);

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

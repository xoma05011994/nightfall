import { createClient } from "rivetkit/client";
import type { registry } from "../../../server/src/index";

// Local dev (WSL-hosted server, default "envoy" runtime mode) connects
// directly to the engine port — 6420 is RivetKit's own default (same as
// this repo's unrelated horde-arena-server entry; the two are never run at
// the same time, so there's no real collision risk in practice).
//
// Production is a single Rivet Compute deployment serving both the built
// client and the actor API from one origin (RIVETKIT_RUNTIME_MODE=serverless,
// set automatically by Compute) — the actor API is mounted at /api/rivet on
// that same origin, so the client just targets its own origin + that path.
// No env var needed either way; VITE_RIVET_ENDPOINT can still override both.
const DEFAULT_ENDPOINT = import.meta.env.DEV ? "http://localhost:6420" : `${location.origin}/api/rivet`;

export const rivetClient = createClient<typeof registry>(import.meta.env.VITE_RIVET_ENDPOINT ?? DEFAULT_ENDPOINT);

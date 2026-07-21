import { createClient } from "rivetkit/client";
import type { registry } from "../../../server/src/index";

// Local dev (WSL-hosted server, default "envoy" runtime mode) connects
// directly to the engine port — 6420 is RivetKit's own default (same as
// this repo's unrelated horde-arena-server entry; the two are never run at
// the same time, so there's no real collision risk in practice).
//
// Production: the server (Railway) runs in the same default "envoy" mode —
// it holds a persistent outbound connection to Rivet's engine rather than
// serving HTTP itself, so the client connects directly to Rivet's own
// public endpoint instead of routing through our server at all. This is
// RIVET_PUBLIC_ENDPOINT's pk_* publishable token embedded in the URL —
// explicitly meant to be exposed client-side (unlike the sk_* secret token
// the server uses), so baking it in here is safe. VITE_RIVET_ENDPOINT can
// still override either default (e.g. to point at a different namespace).
const PRODUCTION_ENDPOINT = "https://nightfall-wzxk-production-2her:pk_8y7Fob9zFfZUVtsspf4GDx357PFBpZSWu1dCVhJX0SVnDuDB0I7D9KB5XI15ph59@api.rivet.dev";
const DEFAULT_ENDPOINT = import.meta.env.DEV ? "http://localhost:6420" : PRODUCTION_ENDPOINT;

export const rivetClient = createClient<typeof registry>(import.meta.env.VITE_RIVET_ENDPOINT ?? DEFAULT_ENDPOINT);

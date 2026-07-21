import { createClient } from "rivetkit/client";
import type { registry } from "../../../server/src/index";

// Explicit fallback to RivetKit's own documented local dev default
// (reference/clients/javascript.md) — passing undefined works too, but logs
// a deprecation warning. Port 6420 is RivetKit's own default (same as this
// repo's unrelated horde-arena-server entry) — the two are never run at the
// same time, so there's no real collision risk in practice.
export const rivetClient = createClient<typeof registry>(import.meta.env.VITE_RIVET_ENDPOINT ?? "http://localhost:6420");

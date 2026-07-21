# Nightfall (survivor-2d)

2D top-down survival roguelite — v0.6. Solo (fully local, no backend) plus
co-op multiplayer via room codes (Endless mode only).

## Workspaces

npm workspaces monorepo:

- `shared/` — pure game-logic modules (types, constants, math, `systems/*`)
  used by both `client/` and `server/`. No DOM imports except where a module
  is genuinely browser-only (e.g. `systems/profile.ts`'s `localStorage` —
  solo/Adventure-only, never touched by the server).
- `client/` — Vite frontend. Solo play (`game/Game.ts`) runs fully locally
  with zero network dependency. Multiplayer (`net/MultiplayerGame.ts`) is a
  separate, thin client that sends input and renders server snapshots — the
  two never run concurrently.
- `server/` — a plain WebSocket server (the `ws` package, zero native
  dependencies) hosting co-op Endless rooms. No external service dependency
  — earlier versions used RivetKit/Rivet Cloud, dropped after Rivet's engine
  hit a persistent, unresolvable actor-scheduling bug (`no_capacity` on
  every fresh actor, reproduced across three independent runner locations).

## Dev workflow

```
npm install                # from survivor-2d/, installs all workspaces
npm run dev                 # Vite dev server on localhost:5175 (client)
npm run typecheck            # all three workspaces
npm test                      # vitest, all three workspaces
npm run build                  # typecheck + production build (client)
```

Solo play needs only `npm run dev`. Multiplayer additionally needs the
server running:

```
npm run dev:server   # from survivor-2d/ — plain Node process on :8080
```

No WSL, no external service, no native dependencies — runs the same way on
Windows/Linux/macOS. Open `http://localhost:5175` in multiple browser tabs
to test a room locally (one tab creates a room and shares the code, others
join with it); the client's dev default already points at
`ws://localhost:8080/ws`.

## Deployment

Client and server deploy independently — there's no shared origin
requirement (WebSocket connections aren't subject to CORS the way
fetch/XHR are).

- **Client → Vercel**: static Vite build (`client/dist`), configured via the
  repo-root `vercel.json`. Set the **Root Directory** to the repo root when
  importing the project (not `client/` — the build needs the sibling
  `shared/` workspace). Set `VITE_WS_URL` to the deployed server's `wss://`
  URL (e.g. `wss://your-app.up.railway.app/ws`) as a Vercel environment
  variable — there's no baked-in production default, since guessing one
  wrong fails silently.
- **Server → Railway** (or any host that runs a persistent Docker
  container with public networking — Fly.io, a VPS, etc.): builds from the
  repo-root `Dockerfile` (server-only image). No environment variables
  required beyond what the platform sets itself (`$PORT`). Needs public
  networking enabled so browser clients can reach it directly.

## Concept

- WASD to move, no camera rotation. Mouse aims (crosshair cursor) and the
  left mouse button fires in the cursor's direction — held down for
  continuous/automatic weapons, gated by each weapon's own cooldown. Escape
  pauses (freezes the sim) with Continue/Leave to Menu options.
- 6 weapons, 5 fire modes: **Sidearm** (pistol, always equipped, 10 rounds/2s
  reload), **Shotgun** (pellet spread), **Assault Rifle** (fast projectile),
  **RPG** (splash-damage explosive), **Laser Cannon** (instant piercing
  beam), **Flamethrower** (continuous damage cone). All 6 use the same
  ammo/cooldown/reload model.
- 3 weapon slots: slot 1 is the pistol (fixed, can't be dropped or swapped).
  Slots 2 and 3 come from enemy drops — walking onto a dropped weapon
  auto-equips it into an empty slot, or prompts you to replace slot 2/3 (or
  leave it) if both are full; declining removes the pickup from the ground
  rather than leaving it there. Switch slots with 1/2/3, reload the equipped
  weapon early with R. Walking onto a **duplicate** of a weapon you already
  hold levels that weapon up instead (1-10, shown on its HUD slot) — level 10
  is MAX and grants a one-time "GIGA" bonus (extra pierce, faster cooldown,
  a bigger glowing shot). World pickups and HUD slots show a large (3.5x),
  distinct icon per weapon rather than a generic diamond.
- Enemies spawn on a ring around the player at a rate that ramps up over
  time, drawn from a weighted mix that escalates roughly once a minute:
  **Grunt** (baseline) alone at first, then **Brute** (tanky, slow, hits
  hard) joins, then **Shooter** (fragile, keeps its distance, lobs a slow
  dodgeable projectile) once the mix already has some bulk to screen for it.
  Stats also scale gently with elapsed run time on top of the type mix. Any
  kill has a small chance to drop one of the 5 pickup weapons.
- Kills also drop XP orbs that fly toward the player once in pickup range.
  Leveling up offers a choice of 3 perks (each with its own icon) from a pool
  of 16: the original 5 (damage/fire-rate/max-hp/move-speed/extra-projectile),
  4 from v0.3 — **Pierce** (projectiles punch through an extra enemy),
  **Ignite** (hits apply a burn damage-over-time), **Chain Lightning** (hits
  arc bonus damage to the nearest other enemy, rendered as a jagged bolt),
  **Deadly Aura** (continuous radius damage around the player, independent of
  the equipped weapon) — and 7 synergy-driven perks forming a small
  dependency tree: **Vampiric** (life steal on any damage source),
  **Berserker** (damage rises as your HP drops), **Momentum** (killing
  stacks a temporary fire-rate boost), **Greed** (bigger pickup radius + more
  gold from chests), **Wildfire** (Aura hits also apply Ignite — can't be
  offered until you have both Deadly Aura and Ignite), **Overload** (Aura
  hits can arc a bonus Lightning bolt — can't be offered until you have both
  Deadly Aura and Chain Lightning), and **Storm Conduit** (a capstone that
  boosts Chain Lightning further — can't be offered until you have both
  Ignite and Chain Lightning). Every perk is capped at 5 ranks and drops out
  of the offer pool once maxed. Perks picked this run are listed in a tray
  on the left side of the HUD; the full dependency tree can be reviewed from
  the main menu's PERK TREE screen.
- Chests spawn periodically (a different rhythm from weapon drops, which are
  kill-triggered) — walking onto one grants gold, a chunk of XP, a perk
  choice, or a **Magnet** burst that visually pulls every XP orb on the map
  toward you at high speed, chosen at random (4-way even odds). Whatever you
  get floats up as an icon above your character.
- Two game modes, picked from the main menu:
  - **Endless** — the original open-ended survive-as-long-as-you-can loop.
  - **Adventure** — pick 1 of 10 pre-generated levels, each a fixed RNG seed
    (so a level plays out identically on repeat attempts) with its own dark
    color palette. **Only the first level is unlocked by default** — winning
    a level unlocks the next one in sequence, persisted to the profile.
    Bosses arrive at 3:00 and 6:00; the run keeps going past 6:00 (timer,
    spawns, everything) until you actually kill the second boss — surviving
    to the clock mark alone is no longer enough. Completing a level's gold
    banks into a persistent profile (`localStorage`); Endless gold is a
    per-run stat only, never saved.
  - The Armory (from the main menu) spends banked gold on permanent
    per-weapon damage upgrades (+10%/level, up to 5 levels) — these only
    apply in Adventure mode, never Endless, and stack multiplicatively with
    in-run weapon leveling.
  - **Sandbox** (from the main menu) is a testing mode, not a real run: no
    automatic enemy/chest spawns, no death, and a side panel to spawn any
    enemy type on demand, equip any weapon at any level, and apply any perk
    instantly (bypassing the normal offer/prerequisite flow), plus a live
    damage-dealt readout — for checking actual numbers instead of inferring
    them from a real run.
  - **Multiplayer** (from the main menu) — co-op Endless in a room: create
    a room and share the 6-character code, or join one. Up to 4 players.
    Server-authoritative at 20 ticks/sec: movement, enemy spawning/AI,
    projectiles, status effects, XP orbs, weapon pickups, and chests are all
    fully simulated on the server and broadcast every tick as one
    `MatchSnapshot`, reusing the exact same `shared/` systems the solo path
    uses. XP is **pooled across the whole party** — one shared level/xp bar
    that every player's HUD mirrors, so the party always levels up in the
    same instant — but each player still rolls and picks their own
    independent 3 perk offers, so builds diverge even though leveling is
    synchronized. No friendly fire by construction (every damage path only
    ever targets the `enemies` array, never other players — verified both
    by an automated regression test and live: one player's projectiles pass
    straight through another player's position without affecting their
    hp). **Chain Link** is a new multiplayer-only perk (needs 2+ connected
    players to even appear as an offer) — a laser drawn between each pair
    of adjacent party members that damages any enemy caught between them,
    ticking on the same cadence as Deadly Aura. Creating a room opens a
    **lobby** (players gather, no enemies) with a START GAME button for the
    host; the run only begins when the host starts it. Any player's Escape
    **pauses the whole party** server-side — everyone sees a GAME PAUSED
    overlay and the simulation freezes until someone resumes. When a
    player's hp hits 0 they **go down and become a ghost** — a translucent
    wisp that can still float around to spectate but is excluded from all
    combat (can't fire, isn't targeted, takes no damage, collects nothing).
    A downed teammate can be brought back by the **Revive** perk, a
    multiplayer-only perk offered only while someone's down; picking it
    revives every ghost teammate at half HP on top of the reviver. A dropped
    connection auto-reconnects at the transport level and the match keeps
    running for the rest of the party the whole time, with a "Reconnecting…"
    banner shown while it's re-establishing — the room itself only closes if
    it stays empty for 30 seconds, so a brief network blip can't cost the
    party its room code. Weapon pickups auto-equip into an empty slot or
    level up a held duplicate; if both slots are full the pickup is just
    left on the ground (the slot-swap prompt isn't wired up for multiplayer
    yet).
- The play area is bounded by a perimeter fence — no infinite wandering.
  Dark/blood/bone visual palette (swapped per Adventure level), Canvas2D
  rendering, camera follows the player without ever rotating.

## Structure

- `shared/src/types.ts`, `constants.ts`, `math.ts` — shared types, tuning
  values, and vector/geometry helpers. `multiplayer.ts` — room-code helpers
  and the client/server DTOs (`PlayerInputDTO`, `MatchSnapshot`).
- `shared/src/systems/` — pure, unit-tested game logic: collision, combat
  (projectile movement/hits/splash/pierce, enemy movement/contact damage),
  `weapons.ts` (weapon defs + fire modes + ammo/reload), `weaponDrops.ts`
  (drop rolling + pickup detection), `chests.ts` (reward rolling + pickup
  detection), `statusEffects.ts` (ignite/lightning-chain/aura),
  `world.ts` (bounds clamping), `levels.ts` (the 10 pre-generated Adventure
  levels), `profile.ts` (persisted coins/weapon-upgrades, solo-only), spawner
  (grunts + bosses), xp/leveling, perks. Used by both `client/` (solo +
  multiplayer prediction/rendering) and `server/` (authoritative sim).
- `client/src/game/Game.ts` — the **solo** orchestrator: one
  `update(dt, moveVector, aimDir, fireHeld, nowMs)` per frame, plus discrete
  actions (`equipSlot`, `reloadEquipped`, `applyPerk`, `resolveWeaponPrompt`,
  `pause`/`resume`/`leaveToMenu`, and the `sandbox*` methods used only by
  Sandbox mode). `start(mode, levelDef?, weaponUpgrades?)` resets a run;
  Adventure mode reseeds the RNG from the level's own seed. Fully local, no
  network calls.
- `client/src/net/MultiplayerGame.ts` — the **multiplayer** client: owns a
  plain `WebSocket` connection (room create/join happens via the connection
  URL's query params, not a message), sends capped-rate input (move/aim/fire),
  exposes the latest server snapshot, auto-reconnects on an unexpected close
  (`connStatus` surfaces this for the UI's "Reconnecting…" banner), and
  surfaces `levelUp` events (offered perk ids only — the client resolves
  them to full `Perk` objects via `getPerkById` and applies a choice through
  a `chooseUpgrade` message, re-validated server-side).
- `client/src/render/renderer.ts` — Canvas2D world rendering. `render()`
  draws one `RenderState` (ground texture, fence, entities, chests,
  pickups, beam/cone/aura effects, vignette, per-level palette, plus an
  optional `otherPlayers` list for co-op teammates); `renderMultiplayer()`
  builds that `RenderState` from a `MatchSnapshot` (local player drives the
  camera) and delegates to `render()` — one drawing pipeline for both solo
  and co-op. No DOM.
- `client/src/ui/` — DOM overlay: HUD, perk tray, main menu, level-select
  screen, armory (shop) screen, level-up perk modal, weapon-pickup
  slot-choice modal, pause modal, sandbox panel, perk tree screen,
  multiplayer room screen, results screen (win or lose).
- `server/src/index.ts` — the WebSocket upgrade handler and room registry
  (`Map<roomCode, Room>`, mirroring the room-code generation logic room
  codes have always used). One connection per player; `mode=create` mints
  a fresh code and room, `mode=join` looks an existing one up by code.
  Reconnects (same `playerId`, same room code) reattach to the same
  in-memory player record — build/level/position survive.
- `server/src/room.ts` — one `Room` instance per co-op session: handles
  `input`/`chooseUpgrade` messages, runs a fixed 20Hz `setInterval` tick loop
  simulating the whole party (movement, firing, projectile resolution
  partitioned by `ownerId` for correct per-owner life-steal, enemy
  AI/contact/projectiles targeting the nearest connected player, status
  effects, Chain Link, pooled party XP with independent per-player perk
  rolls, weapon pickups, chests, enemy/chest spawning), and broadcasts one
  `snapshot` message per tick to every connected player. The room closes
  itself only after `ROOM_EMPTY_GRACE_MS` (30s) with zero connected
  players, checked once per tick rather than the instant the last
  connection drops, so a brief network blip can't delete the room out from
  under a party that's about to reconnect. No persistence at all — if the
  server process restarts, every room is gone (accepted MVP tradeoff).
- `shared/src/systems/chainLink.ts` — the Chain Link perk's damage tick:
  draws a laser (reusing the `LightningEffect` visual) between each pair of
  adjacent connected players in connection order and damages any enemy
  within `CHAIN_LINK_HIT_WIDTH` of a segment, deduped so an enemy caught
  between multiple segments is only hit once per tick. Multiplayer-only,
  called directly from `room.ts`'s tick loop.
- `shared/tests/`, `client/tests/` — vitest unit tests per workspace (see
  `npm test`).

## Known gaps (accepted for v0.6)

- No sound.
- Weapon balance (damage/fire-rate/magazine/reload numbers, perk/upgrade
  magnitudes) is a first pass, not tuned.
- The 10 Adventure levels differ by seed and color palette, not by distinct
  geometry — the arena shape/size is the same bounded fenced square for all
  of them.
- Ground texture is a fixed field of pre-generated splatters, not a fully
  procedural world (though the play area is bounded anyway).
- Player identity/profile has no cloud sync — `localStorage` only, tied to
  one browser.
- Co-op has no whole-party-wipe resolution: if *every* player goes down at
  once there's no one left to trigger a Revive and no XP is coming in, so
  the run is effectively stuck (ghosts spectate an unwinnable field until
  someone leaves to the menu). A proper game-over/restart for a full wipe
  isn't implemented yet.
- Multiplayer weapon pickups: if both extra slots are full, the pickup is
  just left on the ground — the slot-swap prompt from solo isn't wired up
  for co-op.
- Co-op host is just "longest-connected player" (gets the lobby's START
  GAME); there's no explicit host transfer UI or other host-only powers.
- Server has zero persistence — a process restart loses every live room
  (players reconnect fresh, no build/level continuity). Acceptable at this
  scale; would need a real datastore to fix.
- No origin/CORS restriction on the WebSocket server — any origin can
  connect. Fine for a small-scale hobby project; would want an allowlist
  before wider distribution.

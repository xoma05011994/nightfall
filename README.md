# Nightfall (survivor-2d)

2D top-down survival roguelite — v0.6 (in progress). Solo (fully local, no
backend) plus co-op multiplayer via room codes (Endless mode only).

## Workspaces

npm workspaces monorepo:

- `shared/` — pure game-logic modules (types, constants, math, `systems/*`)
  used by both `client/` and `server/`. No DOM or `rivetkit` imports except
  where a module is genuinely browser-only (e.g. `systems/profile.ts`'s
  `localStorage` — solo/Adventure-only, never touched by the server).
- `client/` — Vite frontend. Solo play (`game/Game.ts`) runs fully locally
  with zero network dependency. Multiplayer (`net/MultiplayerGame.ts`) is a
  separate, thin client that sends input and renders server snapshots — the
  two never run concurrently.
- `server/` — RivetKit actors (`matchmaker`, `match`) for co-op Endless rooms.

## Dev workflow

```
npm install                # from survivor-2d/, installs all workspaces
npm run dev                 # Vite dev server on localhost:5175 (client)
npm run typecheck            # all three workspaces
npm test                      # vitest, all three workspaces
npm run build                  # typecheck + production build (client)
```

Solo play needs only `npm run dev`. Multiplayer additionally needs the
RivetKit server running (see below) — open `http://localhost:5175` in
multiple browser tabs to test a room locally (one tab creates a room and
shares the code, others join with it).

### Windows note: the multiplayer server must run under WSL

`rivetkit@2.3.4+`'s native runtime has no published `.node` binary for
Windows, and the WASM fallback's local-engine-spawn path isn't compatible
with the WASM runtime on this version — the same constraint already
documented for this repo's earlier 3D prototype. The Linux native binary
works correctly, so on Windows the **server** runs under WSL while the
**client** (Vite) runs natively on Windows:

- A WSL-native working copy lives at `~/survivor-2d` inside the WSL distro
  (its own `node_modules` — do not run `npm install` for the server
  workspace cross-filesystem from `/mnt/...`, both for native-binary
  correctness and performance).
- `~/sync-survivor-2d.sh` copies `server/src` and `shared/src` from the
  Windows-mounted repo into that working copy (symlinks don't work here —
  Node resolves symlinks to their real path for module resolution, which
  would pull in the broken Windows `node_modules` instead). Re-run it after
  editing server or shared source before restarting the server — the
  `.claude/launch.json` `survivor-2d-server` entry already does this
  automatically on every start.
- `.claude/launch.json`'s `survivor-2d-server` entry runs
  `wsl.exe -d Ubuntu -- bash -c "~/sync-survivor-2d.sh && cd ~/survivor-2d/server && npx tsx --watch src/index.ts"`
  on port 6420 (RivetKit's own default).

On Linux/macOS this workaround isn't needed — `npm run dev:server` from
`server/` (after `npm install` at the repo root) works directly.

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
  - **Multiplayer** (from the main menu, v0.6, in progress) — co-op Endless
    in a room: create a room and share the 6-character code, or join one. Up
    to 4 players. Server-authoritative at 20 ticks/sec: movement, enemy
    spawning/AI, projectiles, status effects (ignite/aura), XP orbs, weapon
    pickups, and chests are all fully simulated on the server and broadcast
    every tick as one `MatchSnapshot`, reusing the exact same `shared/`
    systems the solo path uses. XP and leveling are currently **per-player**
    (each player's kills feed only their own xp/level) — shared/pooled party
    XP lands in a later milestone. Level-up still offers each player their
    own independently-rolled 3 perks, applied only to that player's build.
    No friendly fire by construction (every damage path only ever targets
    the `enemies` array, never other players — verified live: one player's
    projectiles pass straight through another player's position without
    affecting their hp). Weapon pickups auto-equip into an empty slot or
    level up a held duplicate; if both slots are full the pickup is just
    left on the ground (the slot-swap prompt isn't wired up for multiplayer
    yet). No death/game-over flow yet — hp clamps at 0 and the player stays
    playable. No pause or reconnect handling in co-op yet.
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
- `client/src/net/` — the **multiplayer** client: `rivetClient.ts` wraps
  `createClient<typeof registry>()`; `MultiplayerGame.ts` owns the
  connection, sends capped-rate input (move/aim/fire), exposes the latest
  server snapshot, and surfaces `levelUp` events (offered perk ids only —
  the client resolves them to full `Perk` objects via `getPerkById` and
  applies a choice through the `chooseUpgrade` action, re-validated
  server-side).
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
- `server/src/actors/matchmaker.ts` — room-code create/resolve/close
  (in-memory `c.state`, opportunistic staleness pruning on create).
- `server/src/actors/match.ts` — one per co-op room: `setInput` and
  `chooseUpgrade` actions, a fixed 20Hz tick loop that runs the full
  simulation (movement, firing, projectile resolution partitioned by
  `ownerId` for correct per-owner life-steal, enemy AI/contact/projectiles
  targeting the nearest connected player, status effects, per-player XP
  orbs and level-up perk rolls, weapon pickups, chests, enemy/chest
  spawning) and broadcasts one `snapshot` event per tick. Shared/pooled
  party XP and reconnect handling land in later milestones.
- `shared/tests/`, `client/tests/` — vitest unit tests per workspace (see
  `npm test`).

## Known gaps (accepted for v0.6 M2)

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
- Co-op XP/leveling is per-player, not pooled across the party yet (M3).
  "Chain Link" (a multiplayer-only perk that damages enemies via a laser
  between party members) doesn't exist yet either (M4), nor does an explicit
  automated no-friendly-fire regression test (M4) — only manually verified
  so far.
- Co-op has no pause, no reconnect handling, and no death/game-over flow
  (hp clamps at 0, player stays playable) — all M5.
- Multiplayer weapon pickups: if both extra slots are full, the pickup is
  just left on the ground — the slot-swap prompt from solo isn't wired up
  for co-op.
- Local dev only; no cloud deployment config for the server yet.

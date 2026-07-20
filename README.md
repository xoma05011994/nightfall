# Nightfall (survivor-2d)

2D top-down survival roguelite — v0.1 MVP/concept. Single-player, no backend.

## Dev workflow

```
npm install
npm run dev         # Vite dev server on localhost:5175
npm run typecheck
npm test             # vitest, pure-logic unit tests
npm run build         # typecheck + production build
```

## Concept

- WASD movement only, no camera rotation, no manual aim — the weapon fires
  automatically at the nearest enemy in range.
- Enemies spawn on a ring around the player at a rate that ramps up over
  time; their stats scale gently with elapsed run time.
- Kills drop XP orbs that fly toward the player once in pickup range.
  Leveling up offers a choice of 3 perks (from a pool of 5).
- Death ends the run and shows survival time / level / kill count; restart
  starts a fresh run (no meta-progression in v0.1).
- Dark/blood/bone visual palette, Canvas2D rendering, camera follows the
  player without ever rotating.

## Structure

- `src/types.ts`, `src/constants.ts`, `src/math.ts` — shared types, tuning
  values, and vector helpers.
- `src/systems/` — pure, unit-tested game logic: collision, combat
  (auto-shoot/projectiles/contact damage), spawner, xp/leveling, perks.
- `src/game/Game.ts` — orchestrates the systems into one `update(dt, moveVector)`
  per frame.
- `src/render/renderer.ts` — Canvas2D world rendering (ground texture,
  entities, vignette). No DOM.
- `src/ui/` — DOM overlay: HUD, start screen, level-up perk modal, game-over
  screen.
- `tests/` — vitest unit tests for the `systems/` modules.

## Known gaps (accepted for v0.1)

- No sound.
- No meta-progression/persistence between runs.
- Only one weapon/attack pattern; perks modify its stats rather than adding
  new weapon types.
- Ground texture is a fixed field of pre-generated splatters, not a truly
  infinite procedural world.

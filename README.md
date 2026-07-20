# Nightfall (survivor-2d)

2D top-down survival roguelite — v0.2. Single-player, no backend.

## Dev workflow

```
npm install
npm run dev         # Vite dev server on localhost:5175
npm run typecheck
npm test             # vitest, pure-logic unit tests
npm run build         # typecheck + production build
```

## Concept

- WASD to move, no camera rotation. Mouse aims (crosshair cursor) and the
  left mouse button fires in the cursor's direction — held down for
  continuous/automatic weapons, gated by each weapon's own cooldown.
- 6 weapons, 5 fire modes: **Sidearm** (pistol, always equipped, 10 rounds/2s
  reload), **Shotgun** (pellet spread), **Assault Rifle** (fast projectile),
  **RPG** (splash-damage explosive), **Laser Cannon** (instant piercing
  beam), **Flamethrower** (continuous damage cone). All 6 use the same
  ammo/cooldown/reload model.
- 3 weapon slots: slot 1 is the pistol (fixed, can't be dropped or swapped).
  Slots 2 and 3 come from enemy drops — walking onto a dropped weapon
  auto-equips it into an empty slot, or prompts you to replace slot 2/3 (or
  leave it) if both are full. Switch slots with 1/2/3, reload the equipped
  weapon early with R.
- Enemies spawn on a ring around the player at a rate that ramps up over
  time; their stats scale gently with elapsed run time. Any kill has a small
  chance to drop one of the 5 pickup weapons.
- Kills also drop XP orbs that fly toward the player once in pickup range.
  Leveling up offers a choice of 3 perks (from a pool of 5) — these are
  player-level multipliers (damage/fire-rate/extra-projectiles) that apply
  on top of whichever weapon is equipped.
- Death ends the run and shows survival time / level / kill count; restart
  starts a fresh run (no meta-progression yet).
- The play area is bounded by a perimeter fence — no infinite wandering.
  Dark/blood/bone visual palette (lightened slightly from v0.1's near-black),
  Canvas2D rendering, camera follows the player without ever rotating.

## Structure

- `src/types.ts`, `src/constants.ts`, `src/math.ts` — shared types, tuning
  values, and vector/geometry helpers.
- `src/systems/` — pure, unit-tested game logic: collision, combat
  (projectile movement/hits/splash, enemy movement/contact damage),
  `weapons.ts` (weapon defs + fire modes + ammo/reload), `weaponDrops.ts`
  (drop rolling + pickup detection), `world.ts` (bounds clamping), spawner,
  xp/leveling, perks.
- `src/game/Game.ts` — orchestrates the systems into one
  `update(dt, moveVector, aimDir, fireHeld, nowMs)` per frame, plus discrete
  actions (`equipSlot`, `reloadEquipped`, `applyPerk`, `resolveWeaponPrompt`).
- `src/render/renderer.ts` — Canvas2D world rendering (ground texture, fence,
  entities, weapon pickups, beam/cone effects, vignette). No DOM.
- `src/ui/` — DOM overlay: HUD (health/xp/timer/weapon slots/ammo), start
  screen, level-up perk modal, weapon-pickup slot-choice modal, game-over
  screen.
- `tests/` — vitest unit tests for the `systems/` modules.

## Known gaps (accepted for v0.2)

- No sound.
- No meta-progression/persistence between runs.
- Weapon balance (damage/fire-rate/magazine/reload numbers) is a first pass,
  not tuned.
- Ground texture is a fixed field of pre-generated splatters, not a fully
  procedural world (though the play area is now bounded anyway).

# Nightfall (survivor-2d)

2D top-down survival roguelite — v0.3. Single-player, no backend.

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
  Leveling up offers a choice of 3 perks from a pool of 9: the original 5
  (damage/fire-rate/max-hp/move-speed/extra-projectile) plus 4 with their own
  mechanics — **Pierce** (projectiles punch through an extra enemy),
  **Ignite** (hits apply a burn damage-over-time), **Chain Lightning** (hits
  arc bonus damage to the nearest other enemy), **Deadly Aura** (continuous
  radius damage around the player, independent of the equipped weapon).
  Perks picked this run are listed in a tray on the left side of the HUD.
- Chests spawn periodically (a different rhythm from weapon drops, which are
  kill-triggered) — walking onto one grants gold, a chunk of XP, or a perk
  choice, chosen at random.
- Two game modes, picked from the main menu:
  - **Endless** — the original open-ended survive-as-long-as-you-can loop.
  - **Adventure** — pick 1 of 10 pre-generated levels (each a fixed RNG seed,
    so a level plays out identically on repeat attempts, plus its own dark
    color palette). Survive 6 minutes to win; a boss enemy arrives at the
    3:00 and 6:00 marks. Completing a level's gold banks into a persistent
    profile (`localStorage`); Endless gold is a per-run stat only, never
    saved.
  - The Armory (from the main menu) spends banked gold on permanent
    per-weapon damage upgrades (+10%/level, up to 5 levels) — these only
    apply in Adventure mode, never Endless.
- The play area is bounded by a perimeter fence — no infinite wandering.
  Dark/blood/bone visual palette (swapped per Adventure level), Canvas2D
  rendering, camera follows the player without ever rotating.

## Structure

- `src/types.ts`, `src/constants.ts`, `src/math.ts` — shared types, tuning
  values, and vector/geometry helpers.
- `src/systems/` — pure, unit-tested game logic: collision, combat
  (projectile movement/hits/splash/pierce, enemy movement/contact damage),
  `weapons.ts` (weapon defs + fire modes + ammo/reload), `weaponDrops.ts`
  (drop rolling + pickup detection), `chests.ts` (reward rolling + pickup
  detection), `statusEffects.ts` (ignite/lightning-chain/aura),
  `world.ts` (bounds clamping), `levels.ts` (the 10 pre-generated Adventure
  levels), `profile.ts` (persisted coins/weapon-upgrades), spawner
  (grunts + bosses), xp/leveling, perks.
- `src/game/Game.ts` — orchestrates the systems into one
  `update(dt, moveVector, aimDir, fireHeld, nowMs)` per frame, plus discrete
  actions (`equipSlot`, `reloadEquipped`, `applyPerk`, `resolveWeaponPrompt`).
  `start(mode, levelDef?, weaponUpgrades?)` resets a run; Adventure mode
  reseeds the RNG from the level's own seed.
- `src/render/renderer.ts` — Canvas2D world rendering (ground texture, fence,
  entities, chests, weapon pickups, beam/cone/aura effects, vignette,
  per-level color palette). No DOM.
- `src/ui/` — DOM overlay: HUD (health/xp/timer/weapon slots/ammo/gold),
  perk tray, main menu, level-select screen, armory (shop) screen, level-up
  perk modal, weapon-pickup slot-choice modal, results screen (win or lose).
- `tests/` — vitest unit tests for the `systems/` modules and `Game`'s
  orchestration logic (weapon pickups, chests, adventure timing, weapon
  upgrades, level seeding).

## Known gaps (accepted for v0.3)

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

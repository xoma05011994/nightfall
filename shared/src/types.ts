export interface Vec2 {
  x: number;
  y: number;
}

export type WeaponId = "pistol" | "shotgun" | "assaultRifle" | "rpg" | "laserCannon" | "flamethrower";

export type FireMode = "projectile" | "spread" | "explosive" | "beam" | "cone";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  fireMode: FireMode;
  damage: number; // per projectile/pellet/tick, before player.damageMultiplier
  fireCooldownMs: number; // min time between shots/ticks, before player.attackCooldownMultiplier
  magazineSize: number;
  reloadMs: number;
  color: string;
  // Path to a raster icon (served from client/public/weapons/) — used by
  // both the HUD weapon slots and world pickup rendering.
  icon: string;
  pickupLocked?: boolean; // true only for the pistol — can't be dropped or swapped out
  projectileSpeed?: number; // projectile | spread | explosive
  pelletCount?: number; // spread
  spreadRad?: number; // spread — full cone angle projectiles fan across
  splashRadius?: number; // explosive
  splashDamage?: number; // explosive — damage to other enemies caught in the splash
  beamRange?: number; // beam
  coneRange?: number; // cone
  coneAngleRad?: number; // cone — full angle
}

export interface WeaponInstance {
  weaponId: WeaponId;
  ammo: number;
  fireTimerMs: number; // counts down to 0, then a shot/tick is allowed
  reloading: boolean;
  reloadTimerMs: number;
  // In-run leveling (distinct from the meta-progression shop upgrades):
  // picking up a weapon type you already hold levels this instance up
  // instead of prompting a slot swap. Caps at WEAPON_MAX_LEVEL, where it
  // gets a distinct "GIGA" damage/pierce/cooldown bonus (see weapons.ts).
  level: number;
}

// Slot 0 is always the pistol (locked, never dropped/swapped); slots 1-3 are
// pickup-only. Slot 3 only exists once the Armory's extra weapon slot is
// purchased (see Player.weaponSlotCount) — solo-only meta-progression,
// multiplayer players always stay at weaponSlotCount 3 and never reach it.
export type WeaponSlots = [WeaponInstance, WeaponInstance | null, WeaponInstance | null, WeaponInstance | null];

export interface Player {
  position: Vec2;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  moveSpeed: number;
  radius: number;
  pickupRadius: number;
  damageMultiplier: number;
  attackCooldownMultiplier: number;
  extraProjectiles: number;
  weaponSlots: WeaponSlots;
  equippedSlot: 0 | 1 | 2 | 3;
  // How many of weaponSlots are actually usable — 3 by default (pistol +
  // 2 droppable), 4 once the Armory's extra weapon slot is bought. See
  // WeaponSlots' doc comment.
  weaponSlotCount: 3 | 4;
  // Perk-granted mechanics — all 0/inert until the relevant perk is picked.
  pierce: number;
  igniteDamagePerTick: number;
  igniteDurationMs: number;
  lightningChainDamage: number;
  lightningChainRadius: number;
  auraDamagePerTick: number;
  auraRadius: number;
  auraTickTimerMs: number;
  // Synergy perks — several of these only do anything once paired with
  // another perk (see systems/perks.ts's doc comment for the pairings).
  lifeStealPercent: number;
  berserkerIntensity: number; // max bonus damage multiplier applied at 0 hp, scaling with missing hp
  momentumStacks: number;
  momentumTimerMs: number;
  momentumFireRatePerStack: number; // 0 until Momentum is picked
  auraAppliesIgnite: boolean; // Wildfire — needs igniteDamagePerTick > 0 (from Ignite) to matter
  auraTriggersLightning: boolean; // Overload — needs lightningChainDamage > 0 (from Chain Lightning) to matter
  goldMultiplier: number;
  // Chain Link (multiplayer only, needs 2+ connected players to be offered)
  // — contributes to the party's shared inter-player laser damage; see
  // systems/chainLink.ts. Always 0 in solo.
  chainLinkDamagePerTick: number;
  // Shurikens perk — blades orbiting the player at a fixed radius (see
  // constants.ts's SHURIKEN_* and systems/statusEffects.ts's
  // stepShurikens), damaging any enemy they sweep through. Positions are
  // derived purely from elapsed time + count + speed, so nothing about
  // them needs to be stored beyond count/damage/speed/the tick timer.
  shurikenCount: number;
  shurikenDamagePerTick: number;
  shurikenTickTimerMs: number;
  // Blade Storm perk (requires Shurikens) — multiplies the blades' orbit
  // speed. 1 = base SHURIKEN_ORBIT_SPEED, unmodified.
  shurikenSpeedMultiplier: number;
  // How many additional enemies a Chain Lightning arc jumps to beyond the
  // first (1 = just the initial hit's nearest target, matching the
  // original single-jump behavior) — grows with Chain Lightning's rank.
  lightningChainCount: number;
  // Vortex (requires Deadly Aura + Shurikens) — Deadly Aura also tugs
  // enemies caught in it toward the player by this many px each aura tick.
  // 0 until picked.
  auraPull: number;
  // Tempest (deep capstone: requires Cascade + Wildfire) — every Chain
  // Lightning jump also ignites its target, using Ignite's own numbers if
  // picked or a modest baseline if not.
  chainAlwaysIgnites: boolean;
  // Multiplayer only — set when hp hits 0 in co-op. A ghost can still float
  // around to spectate but is excluded from all combat (can't fire, isn't
  // targeted, takes no damage, collects nothing) until a teammate picks the
  // Revive perk. Always false in solo (solo has its own game-over flow).
  isGhost: boolean;
  // Which way the player sprite is rotated to face, in atan2(dy, dx)
  // radians — Math.PI / 2 ("down") is the sprite art's neutral/unrotated
  // orientation. Solo renders the local player from live mouse input
  // directly and never touches this field; multiplayer's server updates it
  // from each connection's last aim input every tick so it round-trips
  // through the snapshot for remote players to render their facing.
  facingAngle: number;
}

export type EnemyType = "grunt" | "brute" | "shooter" | "boss";

export interface Enemy {
  id: number;
  type: EnemyType;
  position: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  contactCooldownMs: number;
  contactTimerMs: number;
  isBoss?: boolean;
  // Ignite status — burnDamagePerTick 0 means "not burning".
  burnDamagePerTick: number;
  burnTicksRemaining: number;
  burnTickTimerMs: number;
  // Shooter AI only — keeps its distance and fires a slow projectile at the
  // player instead of beelining into contact range.
  preferredRange?: number;
  shootCooldownMs?: number;
  shootTimerMs?: number;
}

export interface Projectile {
  id: number;
  position: Vec2;
  velocity: Vec2;
  damage: number;
  radius: number;
  ttlMs: number;
  color: string;
  splashRadius?: number;
  splashDamage?: number;
  pierceRemaining?: number;
  hitEnemyIds?: number[];
  // Cosmetic-only flag for a max-level ("GIGA") weapon shot — bigger, glowing.
  giga?: boolean;
  // Multiplayer only — which player fired this, so the server can route
  // life-steal to the correct player when resolving hits (each player's
  // projectiles are resolved in their own resolveProjectileHits() call).
  // Always undefined in solo.
  ownerId?: string;
}

export interface XpOrb {
  id: number;
  position: Vec2;
  value: number;
  radius: number;
  // Set by the Magnet chest reward — pulls this orb toward the player at a
  // fast fixed speed regardless of pickupRadius, instead of the normal
  // proximity-based homing (see systems/xp.ts's stepXpOrbs).
  magnetized?: boolean;
}

export interface WeaponPickup {
  id: number;
  position: Vec2;
  weaponId: WeaponId;
  radius: number;
}

export interface Chest {
  id: number;
  position: Vec2;
  radius: number;
}

export type ObstacleKind = "tree" | "lake" | "hole";

// Static, run-length terrain features that block the PLAYER only (see
// systems/obstacles.ts) — enemies path straight through them. Generated
// once per run/room and never change afterward, so they're plain data with
// no step/tick function of their own.
export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  position: Vec2;
  radius: number;
}

export type ChestRewardType = "gold" | "xp" | "perk" | "magnet";

// Transient render-only effects for instant-hit fire modes (beam/cone), which
// have no Projectile entity to draw — they resolve damage immediately and
// just need a short-lived visual.
export interface BeamEffect {
  from: Vec2;
  to: Vec2;
  expiresAtMs: number;
  color: string;
}

export interface ConeEffect {
  origin: Vec2;
  direction: Vec2;
  rangeUnits: number;
  angleRad: number;
  expiresAtMs: number;
  color: string;
}

// Chain Lightning perk proc — a jagged bolt from the hit enemy to the
// chained target. `seed` picks a deterministic jitter pattern for the zigzag
// so it doesn't need per-frame randomness to stay stable while it fades.
export interface LightningEffect {
  from: Vec2;
  to: Vec2;
  expiresAtMs: number;
  seed: number;
}

// Floating damage numbers over anything that took damage this
// frame/tick — computed by diffing enemy hp before/after the whole
// simulation step runs (see Game.ts/room.ts), not pushed individually at
// every damage call site, so it automatically covers every current and
// future damage source without needing to instrument each one. Purely
// cosmetic — see profile.ts's showDamageNumbers for the on/off toggle,
// which only gates whether the renderer draws these, not whether the sim
// computes them.
export interface DamagePopupEffect {
  position: Vec2;
  amount: number;
  startMs: number;
  expiresAtMs: number;
}

export type RewardPopupKind = "gold" | "xp" | "perk" | "magnet";

// A chest-open reward — floats up and fades above the player so what dropped
// reads clearly without needing a text log.
export interface RewardPopupEffect {
  position: Vec2;
  kind: RewardPopupKind;
  text: string;
  startMs: number;
  expiresAtMs: number;
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  // Inner SVG markup (no <svg> wrapper) for a 24x24 viewBox icon, drawn with
  // currentColor so CSS controls its color.
  icon: string;
  // Perk ids that must already be picked before this one can be offered —
  // gates synergy/capstone perks that would otherwise do nothing on their
  // own (see systems/perks.ts's doc comment).
  requires?: string[];
  // Minimum connected party size for this perk to be offered — solo (party
  // size 1) never sees it. Undefined/1 means no gate. Currently only used by
  // Chain Link, which needs a second player to draw a laser to.
  minPartySize?: number;
  // Multiplayer only — this perk is only offered when a teammate is
  // currently downed (a ghost). Used by Revive, which is pointless with no
  // one to bring back. The revive itself is applied server-side (see
  // room.ts's chooseUpgrade handling), not in `apply`.
  requiresDeadTeammate?: boolean;
  // `rank` is this pick's resulting count (1 for the first pick, 2 for the
  // second, ...) — most perks ignore it and just re-apply the same flat
  // bonus every pick (already-correct compounding, e.g. damageMultiplier
  // *= 1.25 each time), but perks whose *shape* should grow with rank
  // rather than just their flat numbers (Deadly Aura's radius, Chain
  // Lightning's jump count, Shurikens' blade count) read it to compute
  // rank-dependent values instead of a flat per-pick increment.
  apply: (player: Player, rank: number) => void;
}

export interface WeaponPromptInfo {
  weaponId: WeaponId;
}

export type GamePhase = "start" | "playing" | "paused" | "levelup" | "weaponPrompt" | "gameover" | "victory";

export type GameMode = "endless" | "adventure" | "sandbox";

export interface LevelPalette {
  bg: string;
  splatterRGB: string; // "r, g, b" — interpolated into an rgba() string per splat
  fence: string;
}

export interface LevelDef {
  id: string;
  name: string;
  seed: number;
  palette: LevelPalette;
}

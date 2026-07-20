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
  // Inner SVG markup (no <svg> wrapper) for a 24x24 viewBox icon, drawn with
  // currentColor — used by the HUD weapon slots.
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

export type WeaponSlots = [WeaponInstance, WeaponInstance | null, WeaponInstance | null];

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
  equippedSlot: 0 | 1 | 2;
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
  apply: (player: Player) => void;
}

export interface WeaponPromptInfo {
  weaponId: WeaponId;
}

export type GamePhase = "start" | "playing" | "levelup" | "weaponPrompt" | "gameover" | "victory";

export type GameMode = "endless" | "adventure";

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

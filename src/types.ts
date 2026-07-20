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
}

export interface Enemy {
  id: number;
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
}

export interface XpOrb {
  id: number;
  position: Vec2;
  value: number;
  radius: number;
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

export type ChestRewardType = "gold" | "xp" | "perk";

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

export interface Perk {
  id: string;
  name: string;
  description: string;
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

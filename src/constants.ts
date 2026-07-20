// All tuning values live here so gameplay feel can be adjusted without
// hunting through system code.

export const PLAYER_BASE_HP = 100;
export const PLAYER_BASE_MOVE_SPEED = 220; // px/sec
export const PLAYER_RADIUS = 14;
export const PLAYER_BASE_PICKUP_RADIUS = 90; // XP orb magnet radius only — weapon pickups require walking onto them

export const PROJECTILE_RADIUS = 5;
export const PROJECTILE_TTL_MS = 1500;

export const ENEMY_BASE_HP = 20;
export const ENEMY_BASE_SPEED = 90; // px/sec, slower than the player so kiting works
export const ENEMY_BASE_DAMAGE = 8;
export const ENEMY_RADIUS = 14;
export const ENEMY_CONTACT_COOLDOWN_MS = 700;
// Enemy hp/damage scale gently with elapsed run time so late runs stay
// dangerous without needing a discrete wave-index system for v0.1/v0.2.
export const ENEMY_SCALE_PERIOD_MS = 120_000; // time to reach +100% stats

export const XP_ORB_RADIUS = 6;
export const XP_ORB_BASE_VALUE = 5;
export const BASE_XP_TO_LEVEL = 20;
export const XP_LEVEL_EXPONENT = 1.35;

export const SPAWN_INITIAL_INTERVAL_MS = 1400;
export const SPAWN_MIN_INTERVAL_MS = 220;
export const SPAWN_RAMP_MS = 90_000; // time to reach the minimum spawn interval
export const SPAWN_RADIUS = 520; // enemies spawn on a ring this far from the player, just off-screen

export const PERK_OFFER_COUNT = 3;

// v0.2 — bounded arena, fenced off instead of an open infinite field.
export const WORLD_HALF_SIZE = 1600;
export const FENCE_POST_SPACING = 70;

// v0.2 — weapon drops. Any enemy death has a flat chance to drop one of the
// 5 pickup-only weapons (uniformly chosen among them).
export const WEAPON_DROP_CHANCE = 0.06;
export const WEAPON_PICKUP_RADIUS = 16;

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

// v0.3 — ignite (burn DoT) and deadly aura perks tick on a fixed interval
// rather than every frame, so their damage rate is easy to reason about
// independent of framerate.
export const IGNITE_TICK_MS = 500;
export const AURA_TICK_MS = 400;

// v0.3 — chests. Time-based (not kill-based like weapon drops) so they give
// a different, explore-for-it rhythm; spawn on the same off-screen ring as
// enemies so reaching one takes a deliberate detour.
export const CHEST_SPAWN_INTERVAL_MS = 45_000;
export const CHEST_RADIUS = 18;
export const CHEST_GOLD_MIN = 20;
export const CHEST_GOLD_MAX = 40;
export const CHEST_XP_AMOUNT = 40;

// v0.3 — boss enemies. Big flat HP/damage pool rather than the ×scale curve
// grunts use, so a boss fight reads as a distinct set-piece rather than
// "a grunt that happens to be tanky". Slower than grunts on purpose: the
// threat is attrition/damage, not being run down.
export const BOSS_BASE_HP = 600;
export const BOSS_BASE_DAMAGE = 20;
export const BOSS_RADIUS = 34;
export const BOSS_SPEED = 70;
export const BOSS_CONTACT_COOLDOWN_MS = 900;

// v0.3 — Adventure mode: fixed-length levels won by surviving the clock,
// with a boss arriving at each milestone (the 6-minute one coincides with
// the win condition itself — reaching it means the run is complete).
export const ADVENTURE_DURATION_MS = 6 * 60_000;
export const ADVENTURE_BOSS_1_TRIGGER_MS = 3 * 60_000;
export const ADVENTURE_BOSS_2_TRIGGER_MS = ADVENTURE_DURATION_MS;

// v0.4 — Momentum perk: a kill refreshes the stack timer and adds a stack;
// stacks decay back to 0 as a group once nothing has died in a while,
// rather than peeling off one at a time (simpler to reason about and to
// read off the HUD later).
export const MOMENTUM_MAX_STACKS = 5;
export const MOMENTUM_DURATION_MS = 3000;

// v0.4 — chest reward roll now has 4 equally-weighted outcomes.
export const CHEST_REWARD_TYPES = ["gold", "xp", "perk", "magnet"] as const;

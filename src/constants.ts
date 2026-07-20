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
// v0.5 — halved: weapon leveling (picking up a duplicate) makes drops more
// valuable per-drop, so they need to be rarer to stay a special event.
export const WEAPON_DROP_CHANCE = 0.03;
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

// v0.5 — Magnet reward now pulls existing orbs in visually (fast homing)
// rather than instantly granting their value, so it reads as an event
// instead of a silent number change.
export const MAGNET_PULL_SPEED = 1600; // px/sec

// v0.5 — floating reward popup (coin/xp/perk/magnet icon) shown above the
// player when a chest is opened.
export const REWARD_POPUP_LIFETIME_MS = 1100;
export const REWARD_POPUP_RISE_PX = 60;

// v0.5 — in-run weapon leveling. Picking up a weapon type you already hold
// levels it instead of prompting a slot swap; level 10 is MAX and grants a
// one-time "GIGA" bonus on top of the normal per-level scaling.
export const WEAPON_MAX_LEVEL = 10;
export const WEAPON_LEVEL_DAMAGE_PER_LEVEL = 0.08; // +8% damage per level above 1
export const WEAPON_GIGA_COOLDOWN_MULT = 0.85; // -15% cooldown at max level
export const WEAPON_GIGA_EXTRA_PIERCE = 1;
export const WEAPON_GIGA_PROJECTILE_SCALE = 1.6;

// v0.5 — perks are capped at 5 ranks (repeat picks) each and excluded from
// future offers once maxed, so builds can't snowball a single perk forever.
export const PERK_MAX_RANK = 5;

// v0.5 — enemy variety. Elapsed-time stage boundaries that gate which enemy
// types can spawn, escalating difficulty roughly once a minute regardless of
// game mode (Endless just keeps climbing past the last boundary).
export const ENEMY_STAGE_2_MS = 60_000; // Brute enters the mix
export const ENEMY_STAGE_3_MS = 120_000; // Brute-heavy
export const ENEMY_STAGE_4_MS = 180_000; // Shooter enters (past Adventure boss 1)
export const ENEMY_STAGE_5_MS = 240_000; // Shooter + Brute heavier
export const ENEMY_STAGE_6_MS = 300_000; // Hardest pre-boss-2 mix

export const BRUTE_HP_MULT = 3;
export const BRUTE_DAMAGE_MULT = 1.6;
export const BRUTE_SPEED_MULT = 0.6;
export const BRUTE_RADIUS = ENEMY_RADIUS * 1.5;

export const SHOOTER_HP_MULT = 0.6;
export const SHOOTER_DAMAGE_MULT = 0.5; // contact damage only — its threat is the ranged shot
export const SHOOTER_SPEED_MULT = 0.85;
export const SHOOTER_PREFERRED_RANGE = 260; // tries to hover at this distance from the player
export const SHOOTER_PROJECTILE_SPEED = 220; // slow "missile", meant to be dodgeable
export const SHOOTER_PROJECTILE_DAMAGE = 10;
export const SHOOTER_PROJECTILE_RADIUS = 7;
export const SHOOTER_PROJECTILE_TTL_MS = 3500;
export const SHOOTER_FIRE_COOLDOWN_MS = 2200;
export const SHOOTER_PROJECTILE_COLOR = "#b23fff";

// All tuning values live here so gameplay feel can be adjusted without
// hunting through system code.

export const PLAYER_BASE_HP = 100;
export const PLAYER_BASE_MOVE_SPEED = 220; // px/sec
// v0.83 — collision radii were still sized for the original hand-drawn
// vector shapes; the v0.7 raster sprites read considerably bigger on
// screen than those, so hitboxes/pickup ranges were noticeably smaller
// than what they visually looked like. Bumped up across the board (below)
// to roughly track the new art's footprint instead of the old shapes'.
export const PLAYER_RADIUS = 20;
export const PLAYER_BASE_PICKUP_RADIUS = 90; // XP orb magnet radius only — weapon pickups require walking onto them

export const PROJECTILE_RADIUS = 5;
export const PROJECTILE_TTL_MS = 1500;

export const ENEMY_BASE_HP = 20;
export const ENEMY_BASE_SPEED = 90; // px/sec, slower than the player so kiting works
export const ENEMY_BASE_DAMAGE = 8;
export const ENEMY_RADIUS = 18;
export const ENEMY_CONTACT_COOLDOWN_MS = 700;
// Enemy hp/damage scale gently with elapsed run time so late runs stay
// dangerous without needing a discrete wave-index system for v0.1/v0.2.
export const ENEMY_SCALE_PERIOD_MS = 120_000; // time to reach +100% stats
// v0.9 — hard ceiling on live enemies, mainly a perf/readability safety net
// for very long Endless runs where the spawn interval has ramped all the
// way down. Only gates the regular periodic spawn timer — bosses (rare,
// deliberate set-pieces) and Sandbox's manual spawn buttons (a debug tool,
// including for stress-testing) both bypass it.
export const MAX_ENEMIES_ON_SCREEN = 500;

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
// v0.9 — nudged back up slightly; 0.03 felt a little too rare in practice.
export const WEAPON_DROP_CHANCE = 0.045;
export const WEAPON_PICKUP_RADIUS = 20;

// v0.3 — ignite (burn DoT) and deadly aura perks tick on a fixed interval
// rather than every frame, so their damage rate is easy to reason about
// independent of framerate.
export const IGNITE_TICK_MS = 500;
export const AURA_TICK_MS = 400;

// v0.82 — Shurikens perk: blades orbit the player at a fixed radius/base
// angular speed and deal damage on a fixed tick, same "sample on an
// interval" pattern as Deadly Aura rather than continuous per-frame
// collision. Count grows with Shurikens' own rank; speed grows with the
// separate Blade Storm perk's rank (player.shurikenSpeedMultiplier).
// v0.9 — blades themselves got visually bigger (see renderer.ts's
// drawShurikens), so the hit radius grew to match.
export const SHURIKEN_TICK_MS = 200;
export const SHURIKEN_ORBIT_RADIUS = 70;
export const SHURIKEN_ORBIT_SPEED = 3; // radians/sec, before shurikenSpeedMultiplier
export const SHURIKEN_HIT_RADIUS = 18;
export const SHURIKEN_BASE_DAMAGE = 5;

// v0.6 M4 — Chain Link (multiplayer-only perk): a laser drawn between each
// pair of adjacent connected players, damaging enemies caught within
// CHAIN_LINK_HIT_WIDTH px of the segment. Same tick cadence as Deadly Aura.
export const CHAIN_LINK_TICK_MS = 400;
export const CHAIN_LINK_HIT_WIDTH = 24;

// v0.6 M5 — how long a match actor waits with zero connected players before
// closing its room and ending its own tick loop. Long enough to ride out a
// brief network drop (RivetKit auto-reconnects the underlying connection)
// or a deliberate page reload, short enough not to leave abandoned actors
// running indefinitely.
export const ROOM_EMPTY_GRACE_MS = 30_000;

// v0.3 — chests. Time-based (not kill-based like weapon drops) so they give
// a different, explore-for-it rhythm; spawn on the same off-screen ring as
// enemies so reaching one takes a deliberate detour.
export const CHEST_SPAWN_INTERVAL_MS = 45_000;
export const CHEST_RADIUS = 26;
export const CHEST_GOLD_MIN = 20;
export const CHEST_GOLD_MAX = 40;
export const CHEST_XP_AMOUNT = 40;

// v0.3 — boss enemies. Big flat HP/damage pool rather than the ×scale curve
// grunts use, so a boss fight reads as a distinct set-piece rather than
// "a grunt that happens to be tanky". Slower than grunts on purpose: the
// threat is attrition/damage, not being run down.
export const BOSS_BASE_HP = 600;
export const BOSS_BASE_DAMAGE = 20;
export const BOSS_RADIUS = 46;
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

// v0.87 — floating damage numbers over hit enemies (toggleable, see
// profile.ts's showDamageNumbers). Short-lived and rises less than the
// chest reward popups since these fire constantly during combat rather
// than as a rare event.
export const DAMAGE_POPUP_LIFETIME_MS = 650;
export const DAMAGE_POPUP_RISE_PX = 30;

// v0.86 — static terrain obstacles (trees/lakes/holes) that block the
// player's movement only, scattered once per run/room. Kept off the
// immediate spawn area and spaced apart from each other so they read as
// deliberate terrain rather than a wall of clutter.
export const OBSTACLE_COUNT = 22;
export const OBSTACLE_MIN_DIST_FROM_ORIGIN = 260;
export const OBSTACLE_MIN_SPACING = 90;
export const OBSTACLE_TREE_RADIUS_MIN = 22;
export const OBSTACLE_TREE_RADIUS_MAX = 32;
export const OBSTACLE_LAKE_RADIUS_MIN = 60;
export const OBSTACLE_LAKE_RADIUS_MAX = 100;
export const OBSTACLE_HOLE_RADIUS_MIN = 40;
export const OBSTACLE_HOLE_RADIUS_MAX = 65;

// v0.6 — co-op multiplayer (Endless-only). Room codes exclude visually
// ambiguous characters (0/O, 1/I/L) since they're meant to be read aloud or
// typed by hand, and also exclude W/A/S/D so a code can be typed into the
// join field without the movement keys interfering.
export const MAX_PARTY_SIZE = 4;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "23456789BCEFGHJKMNPQRTUVXYZ";

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const char of code) {
    if (!ROOM_CODE_ALPHABET.includes(char)) return false;
  }
  return true;
}

export const MATCH_TICK_HZ = 20;
export const MATCH_TICK_MS = 1000 / MATCH_TICK_HZ;
// Client sends setInput at this rate (also 20Hz — one input per tick).
export const INPUT_SEND_HZ = 20;

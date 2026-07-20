import {
  BOSS_BASE_DAMAGE,
  BOSS_BASE_HP,
  BOSS_CONTACT_COOLDOWN_MS,
  BOSS_RADIUS,
  BOSS_SPEED,
  BRUTE_DAMAGE_MULT,
  BRUTE_HP_MULT,
  BRUTE_RADIUS,
  BRUTE_SPEED_MULT,
  ENEMY_BASE_DAMAGE,
  ENEMY_BASE_HP,
  ENEMY_BASE_SPEED,
  ENEMY_CONTACT_COOLDOWN_MS,
  ENEMY_RADIUS,
  ENEMY_SCALE_PERIOD_MS,
  ENEMY_STAGE_2_MS,
  ENEMY_STAGE_3_MS,
  ENEMY_STAGE_4_MS,
  ENEMY_STAGE_5_MS,
  ENEMY_STAGE_6_MS,
  SHOOTER_DAMAGE_MULT,
  SHOOTER_FIRE_COOLDOWN_MS,
  SHOOTER_HP_MULT,
  SHOOTER_PREFERRED_RANGE,
  SHOOTER_SPEED_MULT,
  SPAWN_INITIAL_INTERVAL_MS,
  SPAWN_MIN_INTERVAL_MS,
  SPAWN_RADIUS,
  SPAWN_RAMP_MS,
} from "../constants";
import { lerp } from "../math";
import type { Enemy, EnemyType, Vec2 } from "../types";

export function currentSpawnIntervalMs(elapsedMs: number): number {
  const t = Math.min(1, elapsedMs / SPAWN_RAMP_MS);
  return lerp(SPAWN_INITIAL_INTERVAL_MS, SPAWN_MIN_INTERVAL_MS, t);
}

export function enemyStatScale(elapsedMs: number): number {
  return 1 + elapsedMs / ENEMY_SCALE_PERIOD_MS;
}

export function spawnPositionAround(playerPos: Vec2, rng: () => number): Vec2 {
  const angle = rng() * Math.PI * 2;
  return {
    x: playerPos.x + Math.cos(angle) * SPAWN_RADIUS,
    y: playerPos.y + Math.sin(angle) * SPAWN_RADIUS,
  };
}

// Weighted by elapsed run time so difficulty/variety ramps roughly once a
// minute in both game modes (Endless just keeps climbing past the last
// boundary) — grunts start alone, Brute (tanky/slow) joins first, then
// Shooter (ranged, keeps its distance) once the mix already has some bulk to
// screen for it.
export function pickEnemyType(elapsedMs: number, rng: () => number): EnemyType {
  let weights: Record<"grunt" | "brute" | "shooter", number>;
  if (elapsedMs < ENEMY_STAGE_2_MS) weights = { grunt: 1, brute: 0, shooter: 0 };
  else if (elapsedMs < ENEMY_STAGE_3_MS) weights = { grunt: 0.7, brute: 0.3, shooter: 0 };
  else if (elapsedMs < ENEMY_STAGE_4_MS) weights = { grunt: 0.4, brute: 0.6, shooter: 0 };
  else if (elapsedMs < ENEMY_STAGE_5_MS) weights = { grunt: 0.3, brute: 0.4, shooter: 0.3 };
  else if (elapsedMs < ENEMY_STAGE_6_MS) weights = { grunt: 0.2, brute: 0.4, shooter: 0.4 };
  else weights = { grunt: 0.15, brute: 0.45, shooter: 0.4 };

  const total = weights.grunt + weights.brute + weights.shooter;
  let roll = rng() * total;
  for (const [type, weight] of Object.entries(weights) as [EnemyType, number][]) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return "grunt";
}

export function createEnemy(id: number, type: EnemyType, position: Vec2, elapsedMs: number): Enemy {
  const scale = enemyStatScale(elapsedMs);
  const base: Enemy = {
    id,
    type,
    position,
    hp: 0,
    maxHp: 0,
    speed: ENEMY_BASE_SPEED,
    damage: 0,
    radius: ENEMY_RADIUS,
    contactCooldownMs: ENEMY_CONTACT_COOLDOWN_MS,
    contactTimerMs: 0,
    burnDamagePerTick: 0,
    burnTicksRemaining: 0,
    burnTickTimerMs: 0,
  };

  if (type === "brute") {
    base.speed = ENEMY_BASE_SPEED * BRUTE_SPEED_MULT;
    base.radius = BRUTE_RADIUS;
    base.hp = Math.round(ENEMY_BASE_HP * BRUTE_HP_MULT * scale);
    base.damage = Math.round(ENEMY_BASE_DAMAGE * BRUTE_DAMAGE_MULT * scale);
  } else if (type === "shooter") {
    base.speed = ENEMY_BASE_SPEED * SHOOTER_SPEED_MULT;
    base.hp = Math.round(ENEMY_BASE_HP * SHOOTER_HP_MULT * scale);
    base.damage = Math.round(ENEMY_BASE_DAMAGE * SHOOTER_DAMAGE_MULT * scale);
    base.preferredRange = SHOOTER_PREFERRED_RANGE;
    base.shootCooldownMs = SHOOTER_FIRE_COOLDOWN_MS;
    base.shootTimerMs = SHOOTER_FIRE_COOLDOWN_MS;
  } else {
    base.hp = Math.round(ENEMY_BASE_HP * scale);
    base.damage = Math.round(ENEMY_BASE_DAMAGE * scale);
  }
  base.maxHp = base.hp;

  return base;
}

// Bosses use a flat base (lightly scaled by elapsed time, same curve as
// grunts) rather than being a scaled-up grunt — a boss fight should read as
// a distinct set-piece, not "a very tanky grunt".
export function createBoss(id: number, position: Vec2, elapsedMs: number): Enemy {
  const scale = enemyStatScale(elapsedMs);
  const hp = Math.round(BOSS_BASE_HP * scale);
  return {
    id,
    type: "boss",
    position,
    hp,
    maxHp: hp,
    speed: BOSS_SPEED,
    damage: Math.round(BOSS_BASE_DAMAGE * scale),
    radius: BOSS_RADIUS,
    contactCooldownMs: BOSS_CONTACT_COOLDOWN_MS,
    contactTimerMs: 0,
    isBoss: true,
    burnDamagePerTick: 0,
    burnTicksRemaining: 0,
    burnTickTimerMs: 0,
  };
}

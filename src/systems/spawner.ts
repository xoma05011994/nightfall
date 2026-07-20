import {
  BOSS_BASE_DAMAGE,
  BOSS_BASE_HP,
  BOSS_CONTACT_COOLDOWN_MS,
  BOSS_RADIUS,
  BOSS_SPEED,
  ENEMY_BASE_DAMAGE,
  ENEMY_BASE_HP,
  ENEMY_BASE_SPEED,
  ENEMY_CONTACT_COOLDOWN_MS,
  ENEMY_RADIUS,
  ENEMY_SCALE_PERIOD_MS,
  SPAWN_INITIAL_INTERVAL_MS,
  SPAWN_MIN_INTERVAL_MS,
  SPAWN_RADIUS,
  SPAWN_RAMP_MS,
} from "../constants";
import { lerp } from "../math";
import type { Enemy, Vec2 } from "../types";

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

export function createEnemy(id: number, position: Vec2, elapsedMs: number): Enemy {
  const scale = enemyStatScale(elapsedMs);
  const hp = Math.round(ENEMY_BASE_HP * scale);
  return {
    id,
    position,
    hp,
    maxHp: hp,
    speed: ENEMY_BASE_SPEED,
    damage: Math.round(ENEMY_BASE_DAMAGE * scale),
    radius: ENEMY_RADIUS,
    contactCooldownMs: ENEMY_CONTACT_COOLDOWN_MS,
    contactTimerMs: 0,
    burnDamagePerTick: 0,
    burnTicksRemaining: 0,
    burnTickTimerMs: 0,
  };
}

// Bosses use a flat base (lightly scaled by elapsed time, same curve as
// grunts) rather than being a scaled-up grunt — a boss fight should read as
// a distinct set-piece, not "a very tanky grunt".
export function createBoss(id: number, position: Vec2, elapsedMs: number): Enemy {
  const scale = enemyStatScale(elapsedMs);
  const hp = Math.round(BOSS_BASE_HP * scale);
  return {
    id,
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

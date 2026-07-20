import { describe, expect, it } from "vitest";
import {
  findNearestEnemy,
  resolveEnemyContactDamage,
  resolveProjectileHits,
  stepPlayerAttack,
  stepProjectiles,
} from "../src/systems/combat";
import { xpToNextForLevel } from "../src/systems/xp";
import type { Enemy, Player, Projectile } from "../src/types";

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    position: { x: 0, y: 0 },
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: xpToNextForLevel(1),
    moveSpeed: 200,
    damage: 10,
    attackCooldownMs: 500,
    attackTimerMs: 0,
    attackRange: 300,
    projectileCount: 1,
    radius: 14,
    pickupRadius: 90,
    ...overrides,
  };
}

function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 1,
    position: { x: 100, y: 0 },
    hp: 20,
    maxHp: 20,
    speed: 90,
    damage: 8,
    radius: 14,
    contactCooldownMs: 700,
    contactTimerMs: 0,
    ...overrides,
  };
}

describe("findNearestEnemy", () => {
  it("picks the closest enemy within range", () => {
    const far = makeEnemy({ id: 1, position: { x: 250, y: 0 } });
    const near = makeEnemy({ id: 2, position: { x: 50, y: 0 } });
    const result = findNearestEnemy({ x: 0, y: 0 }, [far, near], 300);
    expect(result?.id).toBe(2);
  });

  it("ignores enemies outside the given range", () => {
    const outOfRange = makeEnemy({ id: 1, position: { x: 500, y: 0 } });
    const result = findNearestEnemy({ x: 0, y: 0 }, [outOfRange], 300);
    expect(result).toBeNull();
  });
});

describe("stepPlayerAttack", () => {
  it("does not fire while the cooldown timer is still running", () => {
    const player = makePlayer({ attackTimerMs: 200 });
    const enemy = makeEnemy();
    const projectiles: Projectile[] = [];
    stepPlayerAttack(player, [enemy], projectiles, 0.1, 1);
    expect(projectiles).toHaveLength(0);
  });

  it("fires at the nearest enemy once the cooldown elapses", () => {
    const player = makePlayer({ attackTimerMs: 0 });
    const enemy = makeEnemy();
    const projectiles: Projectile[] = [];
    const nextId = stepPlayerAttack(player, [enemy], projectiles, 0.016, 1);
    expect(projectiles).toHaveLength(1);
    expect(nextId).toBe(2);
    expect(player.attackTimerMs).toBe(player.attackCooldownMs);
  });

  it("fires projectileCount projectiles for multishot", () => {
    const player = makePlayer({ attackTimerMs: 0, projectileCount: 3 });
    const enemy = makeEnemy();
    const projectiles: Projectile[] = [];
    stepPlayerAttack(player, [enemy], projectiles, 0.016, 1);
    expect(projectiles).toHaveLength(3);
  });

  it("does not fire when no enemy is in range", () => {
    const player = makePlayer({ attackTimerMs: 0 });
    const projectiles: Projectile[] = [];
    stepPlayerAttack(player, [], projectiles, 0.016, 1);
    expect(projectiles).toHaveLength(0);
  });
});

describe("stepProjectiles", () => {
  it("moves projectiles by velocity * dt and expires them past their ttl", () => {
    const projectiles: Projectile[] = [
      { id: 1, position: { x: 0, y: 0 }, velocity: { x: 100, y: 0 }, damage: 10, radius: 5, ttlMs: 50 },
    ];
    const alive = stepProjectiles(projectiles, 0.1);
    expect(alive).toHaveLength(0);
  });

  it("keeps projectiles alive and moves them while ttl remains", () => {
    const projectiles: Projectile[] = [
      { id: 1, position: { x: 0, y: 0 }, velocity: { x: 100, y: 0 }, damage: 10, radius: 5, ttlMs: 1000 },
    ];
    const alive = stepProjectiles(projectiles, 0.1);
    expect(alive).toHaveLength(1);
    expect(alive[0]!.position.x).toBeCloseTo(10, 5);
  });
});

describe("resolveProjectileHits", () => {
  it("damages an overlapping enemy and consumes the projectile", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 20, maxHp: 20 });
    const projectile: Projectile = { id: 1, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, damage: 5, radius: 5, ttlMs: 1000 };
    const { survivingProjectiles, deadEnemies } = resolveProjectileHits([projectile], [enemy]);
    expect(survivingProjectiles).toHaveLength(0);
    expect(deadEnemies).toHaveLength(0);
    expect(enemy.hp).toBe(15);
  });

  it("kills the enemy and reports it when hp drops to zero or below", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 5, maxHp: 20 });
    const projectile: Projectile = { id: 1, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, damage: 10, radius: 5, ttlMs: 1000 };
    const enemies = [enemy];
    const { deadEnemies } = resolveProjectileHits([projectile], enemies);
    expect(deadEnemies).toHaveLength(1);
    expect(enemies).toHaveLength(0);
  });

  it("leaves non-overlapping projectiles surviving with no damage dealt", () => {
    const enemy = makeEnemy({ position: { x: 1000, y: 0 }, hp: 20, maxHp: 20 });
    const projectile: Projectile = { id: 1, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, damage: 10, radius: 5, ttlMs: 1000 };
    const { survivingProjectiles } = resolveProjectileHits([projectile], [enemy]);
    expect(survivingProjectiles).toHaveLength(1);
    expect(enemy.hp).toBe(20);
  });
});

describe("resolveEnemyContactDamage", () => {
  it("damages the player once when an enemy overlaps and is off cooldown", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, hp: 100 });
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, damage: 8, contactTimerMs: 0 });
    const dealt = resolveEnemyContactDamage([enemy], player);
    expect(dealt).toBe(8);
    expect(player.hp).toBe(92);
    expect(enemy.contactTimerMs).toBe(enemy.contactCooldownMs);
  });

  it("does not damage the player again while the enemy's contact cooldown is active", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, hp: 100 });
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, damage: 8, contactTimerMs: 300 });
    const dealt = resolveEnemyContactDamage([enemy], player);
    expect(dealt).toBe(0);
    expect(player.hp).toBe(100);
  });

  it("does not damage the player when no enemy overlaps", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, hp: 100 });
    const enemy = makeEnemy({ position: { x: 1000, y: 0 } });
    const dealt = resolveEnemyContactDamage([enemy], player);
    expect(dealt).toBe(0);
    expect(player.hp).toBe(100);
  });
});

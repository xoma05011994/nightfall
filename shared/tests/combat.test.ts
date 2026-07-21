import { describe, expect, it } from "vitest";
import { resolveEnemyContactDamage, resolveEnemyProjectileHits, resolveProjectileHits, stepEnemies, stepEnemyProjectiles, stepProjectiles } from "../src/systems/combat";
import { collectDeadEnemies } from "../src/systems/enemies";
import type { Projectile } from "../src/types";
import { makeEnemy, makePlayer } from "./testHelpers";

function makeProjectile(overrides: Partial<Projectile> = {}): Projectile {
  return {
    id: 1,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    damage: 10,
    radius: 5,
    ttlMs: 1000,
    color: "#ffb347",
    ...overrides,
  };
}

describe("stepProjectiles", () => {
  it("moves projectiles by velocity * dt and expires them past their ttl", () => {
    const projectiles: Projectile[] = [makeProjectile({ velocity: { x: 100, y: 0 }, ttlMs: 50 })];
    const alive = stepProjectiles(projectiles, 0.1);
    expect(alive).toHaveLength(0);
  });

  it("keeps projectiles alive and moves them while ttl remains", () => {
    const projectiles: Projectile[] = [makeProjectile({ velocity: { x: 100, y: 0 }, ttlMs: 1000 })];
    const alive = stepProjectiles(projectiles, 0.1);
    expect(alive).toHaveLength(1);
    expect(alive[0]!.position.x).toBeCloseTo(10, 5);
  });
});

describe("collectDeadEnemies", () => {
  it("removes hp<=0 enemies from the array and returns them", () => {
    const alive = makeEnemy({ id: 1, hp: 5 });
    const dead = makeEnemy({ id: 2, hp: 0 });
    const enemies = [alive, dead];
    const collected = collectDeadEnemies(enemies);
    expect(collected).toEqual([dead]);
    expect(enemies).toEqual([alive]);
  });
});

describe("resolveProjectileHits", () => {
  it("damages an overlapping enemy and consumes the projectile", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 20, maxHp: 20 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 5 });
    const { survivingProjectiles, deadEnemies } = resolveProjectileHits([projectile], [enemy], makePlayer(), [], 0);
    expect(survivingProjectiles).toHaveLength(0);
    expect(deadEnemies).toHaveLength(0);
    expect(enemy.hp).toBe(15);
  });

  it("kills the enemy and reports it when hp drops to zero or below", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 5, maxHp: 20 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 10 });
    const enemies = [enemy];
    const { deadEnemies } = resolveProjectileHits([projectile], enemies, makePlayer(), [], 0);
    expect(deadEnemies).toHaveLength(1);
    expect(enemies).toHaveLength(0);
  });

  it("leaves non-overlapping projectiles surviving with no damage dealt", () => {
    const enemy = makeEnemy({ position: { x: 1000, y: 0 }, hp: 20, maxHp: 20 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 10 });
    const { survivingProjectiles } = resolveProjectileHits([projectile], [enemy], makePlayer(), [], 0);
    expect(survivingProjectiles).toHaveLength(1);
    expect(enemy.hp).toBe(20);
  });

  it("applies splash damage to other nearby enemies for splash-flagged projectiles (RPG)", () => {
    const direct = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    const nearby = makeEnemy({ id: 2, position: { x: 40, y: 0 }, hp: 200, maxHp: 200 });
    const farAway = makeEnemy({ id: 3, position: { x: 1000, y: 0 }, hp: 200, maxHp: 200 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 60, splashRadius: 90, splashDamage: 40 });
    resolveProjectileHits([projectile], [direct, nearby, farAway], makePlayer(), [], 0);
    expect(direct.hp).toBe(140); // direct hit: 200 - 60
    expect(nearby.hp).toBe(160); // splash only: 200 - 40
    expect(farAway.hp).toBe(200); // outside splash radius
  });

  it("a pierced projectile survives the hit instead of being consumed", () => {
    const enemy = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 30, pierceRemaining: 1 });
    const { survivingProjectiles } = resolveProjectileHits([projectile], [enemy], makePlayer(), [], 0);
    expect(survivingProjectiles).toHaveLength(1);
    expect(survivingProjectiles[0]!.pierceRemaining).toBe(0);
    expect(survivingProjectiles[0]!.hitEnemyIds).toEqual([1]);
    expect(enemy.hp).toBe(170);
  });

  it("a pierced projectile does not hit the same enemy twice even while still overlapping it", () => {
    const enemy = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    // Simulate a second resolve call on a projectile that already pierced
    // through this enemy and hasn't moved off it yet.
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 30, pierceRemaining: 0, hitEnemyIds: [1] });
    const { survivingProjectiles } = resolveProjectileHits([projectile], [enemy], makePlayer(), [], 0);
    expect(survivingProjectiles).toHaveLength(1); // no overlap found (enemy 1 excluded) -> "survives" untouched
    expect(enemy.hp).toBe(200);
  });

  it("a projectile with no pierce remaining is consumed on hit as usual", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 30, pierceRemaining: 0 });
    const { survivingProjectiles } = resolveProjectileHits([projectile], [enemy], makePlayer(), [], 0);
    expect(survivingProjectiles).toHaveLength(0);
  });

  it("applies ignite on hit when the player has the ignite perk active", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 10 });
    const player = makePlayer({ igniteDamagePerTick: 5, igniteDurationMs: 1000 });
    resolveProjectileHits([projectile], [enemy], player, [], 0);
    expect(enemy.burnDamagePerTick).toBe(5);
    expect(enemy.burnTicksRemaining).toBeGreaterThan(0);
  });

  it("chains lightning damage to the nearest other enemy when the perk is active", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    const nearby = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 200, maxHp: 200 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 10 });
    const player = makePlayer({ lightningChainDamage: 15, lightningChainRadius: 200 });
    resolveProjectileHits([projectile], [hit, nearby], player, [], 0);
    expect(nearby.hp).toBe(185);
  });

  it("pushes a lightning visual effect when the chain fires", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    const nearby = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 200, maxHp: 200 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 10 });
    const player = makePlayer({ lightningChainDamage: 15, lightningChainRadius: 200 });
    const lightningEffects: import("../src/types").LightningEffect[] = [];
    resolveProjectileHits([projectile], [hit, nearby], player, lightningEffects, 1000);
    expect(lightningEffects).toHaveLength(1);
    expect(lightningEffects[0]!.expiresAtMs).toBeGreaterThan(1000);
  });

  it("deals double lightning-chain damage to a target that is already burning (ignite+lightning synergy)", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    const burningTarget = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 200, maxHp: 200, burnDamagePerTick: 3 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 10 });
    const player = makePlayer({ lightningChainDamage: 15, lightningChainRadius: 200 });
    resolveProjectileHits([projectile], [hit, burningTarget], player, [], 0);
    expect(burningTarget.hp).toBe(170); // 200 - 30 (doubled from 15)
  });

  it("applies life steal on a direct hit when Vampiric is active", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 200, maxHp: 200 });
    const projectile = makeProjectile({ position: { x: 0, y: 0 }, damage: 20 });
    const player = makePlayer({ hp: 50, maxHp: 100, lifeStealPercent: 0.5 });
    resolveProjectileHits([projectile], [enemy], player, [], 0);
    expect(player.hp).toBe(60); // 50 + 20*0.5
  });
});

describe("stepEnemies", () => {
  it("moves each enemy toward the player position", () => {
    const enemy = makeEnemy({ position: { x: 100, y: 0 }, speed: 50 });
    stepEnemies([enemy], { x: 0, y: 0 }, 1);
    expect(enemy.position.x).toBeCloseTo(50, 5);
  });

  it("counts down the contact cooldown timer", () => {
    const enemy = makeEnemy({ contactTimerMs: 300 });
    stepEnemies([enemy], { x: 1000, y: 1000 }, 0.1);
    expect(enemy.contactTimerMs).toBeCloseTo(200, 5);
  });

  it("a shooter advances toward the player when farther than its preferred range", () => {
    const shooter = makeEnemy({ type: "shooter", position: { x: 1000, y: 0 }, speed: 50, preferredRange: 260, shootCooldownMs: 2000, shootTimerMs: 2000 });
    stepEnemies([shooter], { x: 0, y: 0 }, 1);
    expect(shooter.position.x).toBeLessThan(1000);
  });

  it("a shooter backs away from the player when closer than its preferred range", () => {
    const shooter = makeEnemy({ type: "shooter", position: { x: 50, y: 0 }, speed: 50, preferredRange: 260, shootCooldownMs: 2000, shootTimerMs: 2000 });
    stepEnemies([shooter], { x: 0, y: 0 }, 1);
    expect(shooter.position.x).toBeGreaterThan(50);
  });

  it("a shooter fires a slow projectile at the player once its shoot timer elapses", () => {
    const shooter = makeEnemy({ type: "shooter", position: { x: 260, y: 0 }, speed: 0, preferredRange: 260, shootCooldownMs: 2000, shootTimerMs: 0 });
    const enemyProjectiles: Projectile[] = [];
    const nextId = stepEnemies([shooter], { x: 0, y: 0 }, 0.016, enemyProjectiles, 1);
    expect(enemyProjectiles).toHaveLength(1);
    expect(enemyProjectiles[0]!.velocity.x).toBeLessThan(0); // aimed back toward the player
    expect(shooter.shootTimerMs).toBeCloseTo(2000, 5); // reset to its cooldown
    expect(nextId).toBe(2);
  });

  it("a grunt/brute never spawns projectiles regardless of shootTimerMs", () => {
    const grunt = makeEnemy({ type: "grunt", position: { x: 100, y: 0 } });
    const enemyProjectiles: Projectile[] = [];
    stepEnemies([grunt], { x: 0, y: 0 }, 1, enemyProjectiles, 1);
    expect(enemyProjectiles).toHaveLength(0);
  });
});

describe("stepEnemyProjectiles / resolveEnemyProjectileHits", () => {
  it("moves enemy projectiles and expires them past their ttl, same as player projectiles", () => {
    const projectiles: Projectile[] = [{ id: 1, position: { x: 0, y: 0 }, velocity: { x: 100, y: 0 }, damage: 10, radius: 5, ttlMs: 50, color: "#b23fff" }];
    expect(stepEnemyProjectiles(projectiles, 0.1)).toHaveLength(0);
  });

  it("damages the player on overlap and removes the projectile", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, hp: 100 });
    const projectiles: Projectile[] = [{ id: 1, position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, damage: 10, radius: 5, ttlMs: 1000, color: "#b23fff" }];
    const surviving = resolveEnemyProjectileHits(projectiles, player);
    expect(surviving).toHaveLength(0);
    expect(player.hp).toBe(90);
  });

  it("leaves non-overlapping projectiles alone", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, hp: 100 });
    const projectiles: Projectile[] = [{ id: 1, position: { x: 1000, y: 0 }, velocity: { x: 0, y: 0 }, damage: 10, radius: 5, ttlMs: 1000, color: "#b23fff" }];
    const surviving = resolveEnemyProjectileHits(projectiles, player);
    expect(surviving).toHaveLength(1);
    expect(player.hp).toBe(100);
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

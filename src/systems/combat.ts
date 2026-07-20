import { PROJECTILE_RADIUS, PROJECTILE_SPEED, PROJECTILE_SPREAD_RAD, PROJECTILE_TTL_MS } from "../constants";
import { directionTo, distanceSq, rotate } from "../math";
import type { Enemy, Player, Projectile } from "../types";
import { circlesOverlap } from "./collision";

export function findNearestEnemy(playerPos: Player["position"], enemies: Enemy[], maxRange: number): Enemy | null {
  let nearest: Enemy | null = null;
  let nearestDistSq = maxRange * maxRange;
  for (const enemy of enemies) {
    const dSq = distanceSq(playerPos, enemy.position);
    if (dSq <= nearestDistSq) {
      nearest = enemy;
      nearestDistSq = dSq;
    }
  }
  return nearest;
}

// Fully automatic weapon: no manual aim input exists, the player always
// fires at whatever's nearest once their cooldown is ready. Returns the
// next free projectile id (callers thread this through to keep ids unique
// without a module-level counter, which would make this harder to test).
export function stepPlayerAttack(player: Player, enemies: Enemy[], projectiles: Projectile[], dt: number, nextProjectileId: number): number {
  player.attackTimerMs -= dt * 1000;
  if (player.attackTimerMs > 0) return nextProjectileId;

  const target = findNearestEnemy(player.position, enemies, player.attackRange);
  if (!target) return nextProjectileId;

  player.attackTimerMs = player.attackCooldownMs;
  const baseDir = directionTo(player.position, target.position);
  const count = player.projectileCount;
  let id = nextProjectileId;
  for (let i = 0; i < count; i++) {
    // Odd shot counts fire one straight down the middle; even counts fan
    // out symmetrically around it.
    const offset = i - (count - 1) / 2;
    const dir = rotate(baseDir, offset * PROJECTILE_SPREAD_RAD);
    projectiles.push({
      id: id++,
      position: { x: player.position.x, y: player.position.y },
      velocity: { x: dir.x * PROJECTILE_SPEED, y: dir.y * PROJECTILE_SPEED },
      damage: player.damage,
      radius: PROJECTILE_RADIUS,
      ttlMs: PROJECTILE_TTL_MS,
    });
  }
  return id;
}

export function stepProjectiles(projectiles: Projectile[], dt: number): Projectile[] {
  const alive: Projectile[] = [];
  for (const p of projectiles) {
    p.position.x += p.velocity.x * dt;
    p.position.y += p.velocity.y * dt;
    p.ttlMs -= dt * 1000;
    if (p.ttlMs > 0) alive.push(p);
  }
  return alive;
}

// Single-target hit per projectile (no pierce for v0.1). Returns enemies
// that died this step so the caller can drop XP orbs for them.
export function resolveProjectileHits(projectiles: Projectile[], enemies: Enemy[]): { survivingProjectiles: Projectile[]; deadEnemies: Enemy[] } {
  const deadEnemies: Enemy[] = [];
  const survivingProjectiles: Projectile[] = [];

  for (const projectile of projectiles) {
    let hit = false;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      if (circlesOverlap(projectile.position, projectile.radius, enemy.position, enemy.radius)) {
        enemy.hp -= projectile.damage;
        hit = true;
        if (enemy.hp <= 0) deadEnemies.push(enemy);
        break;
      }
    }
    if (!hit) survivingProjectiles.push(projectile);
  }

  const survivingEnemies = enemies.filter((e) => e.hp > 0);
  enemies.length = 0;
  enemies.push(...survivingEnemies);

  return { survivingProjectiles, deadEnemies };
}

export function stepEnemies(enemies: Enemy[], playerPos: Player["position"], dt: number): void {
  for (const enemy of enemies) {
    const dir = directionTo(enemy.position, playerPos);
    enemy.position.x += dir.x * enemy.speed * dt;
    enemy.position.y += dir.y * enemy.speed * dt;
    if (enemy.contactTimerMs > 0) enemy.contactTimerMs -= dt * 1000;
  }
}

// Returns total damage dealt to the player this step (each enemy can only
// land a hit once per its own contact cooldown, not globally).
export function resolveEnemyContactDamage(enemies: Enemy[], player: Player): number {
  let totalDamage = 0;
  for (const enemy of enemies) {
    if (enemy.contactTimerMs > 0) continue;
    if (circlesOverlap(enemy.position, enemy.radius, player.position, player.radius)) {
      totalDamage += enemy.damage;
      enemy.contactTimerMs = enemy.contactCooldownMs;
    }
  }
  if (totalDamage > 0) player.hp -= totalDamage;
  return totalDamage;
}

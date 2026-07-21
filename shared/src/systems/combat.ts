import {
  SHOOTER_FIRE_COOLDOWN_MS,
  SHOOTER_PREFERRED_RANGE,
  SHOOTER_PROJECTILE_COLOR,
  SHOOTER_PROJECTILE_DAMAGE,
  SHOOTER_PROJECTILE_RADIUS,
  SHOOTER_PROJECTILE_SPEED,
  SHOOTER_PROJECTILE_TTL_MS,
} from "../constants";
import { directionTo, distance } from "../math";
import type { Enemy, LightningEffect, Player, Projectile, Vec2 } from "../types";
import { circlesOverlap } from "./collision";
import { collectDeadEnemies } from "./enemies";
import { applyLifeSteal, applyOnHitEffects } from "./statusEffects";

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

// Single-target hit per projectile, except splash weapons (RPG) which also
// damage every other enemy within splashRadius of the impact point, and
// pierce (from the Pierce perk) which lets a projectile keep flying through
// a fixed number of extra enemies instead of being consumed on first hit.
// Returns enemies that died this step so the caller can drop XP/loot for them.
export function resolveProjectileHits(
  projectiles: Projectile[],
  enemies: Enemy[],
  player: Player,
  lightningEffects: LightningEffect[],
  nowMs: number,
): { survivingProjectiles: Projectile[]; deadEnemies: Enemy[] } {
  const survivingProjectiles: Projectile[] = [];

  for (const projectile of projectiles) {
    let hitEnemy: Enemy | null = null;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      if (projectile.hitEnemyIds?.includes(enemy.id)) continue;
      if (circlesOverlap(projectile.position, projectile.radius, enemy.position, enemy.radius)) {
        hitEnemy = enemy;
        break;
      }
    }

    if (!hitEnemy) {
      survivingProjectiles.push(projectile);
      continue;
    }

    hitEnemy.hp -= projectile.damage;
    applyLifeSteal(player, projectile.damage);
    applyOnHitEffects(player, enemies, hitEnemy, lightningEffects, nowMs);
    if (projectile.splashRadius && projectile.splashDamage) {
      for (const other of enemies) {
        if (other === hitEnemy || other.hp <= 0) continue;
        if (circlesOverlap(projectile.position, projectile.splashRadius, other.position, other.radius)) {
          other.hp -= projectile.splashDamage;
        }
      }
    }

    if (projectile.pierceRemaining && projectile.pierceRemaining > 0) {
      projectile.pierceRemaining -= 1;
      projectile.hitEnemyIds = [...(projectile.hitEnemyIds ?? []), hitEnemy.id];
      survivingProjectiles.push(projectile);
    }
  }

  const deadEnemies = collectDeadEnemies(enemies);
  return { survivingProjectiles, deadEnemies };
}

function makeEnemyProjectile(id: number, origin: Vec2, dir: Vec2): Projectile {
  return {
    id,
    position: { x: origin.x, y: origin.y },
    velocity: { x: dir.x * SHOOTER_PROJECTILE_SPEED, y: dir.y * SHOOTER_PROJECTILE_SPEED },
    damage: SHOOTER_PROJECTILE_DAMAGE,
    radius: SHOOTER_PROJECTILE_RADIUS,
    ttlMs: SHOOTER_PROJECTILE_TTL_MS,
    color: SHOOTER_PROJECTILE_COLOR,
  };
}

// Grunts/Brutes beeline for the player. Shooters instead hover around
// `preferredRange` (advancing if too far, backing off if too close) and
// periodically lob a slow projectile — appended to `enemyProjectiles`.
// Returns the next free projectile id.
export function stepEnemies(enemies: Enemy[], playerPos: Vec2, dt: number, enemyProjectiles: Projectile[] = [], nextProjectileId = 1): number {
  let nextId = nextProjectileId;
  for (const enemy of enemies) {
    if (enemy.contactTimerMs > 0) enemy.contactTimerMs -= dt * 1000;

    if (enemy.type === "shooter") {
      const dir = directionTo(enemy.position, playerPos);
      const dist = distance(enemy.position, playerPos);
      const preferred = enemy.preferredRange ?? SHOOTER_PREFERRED_RANGE;
      if (dist > preferred + 20) {
        enemy.position.x += dir.x * enemy.speed * dt;
        enemy.position.y += dir.y * enemy.speed * dt;
      } else if (dist < preferred - 20) {
        enemy.position.x -= dir.x * enemy.speed * dt;
        enemy.position.y -= dir.y * enemy.speed * dt;
      }

      if (enemy.shootTimerMs !== undefined) {
        enemy.shootTimerMs -= dt * 1000;
        if (enemy.shootTimerMs <= 0) {
          enemy.shootTimerMs = enemy.shootCooldownMs ?? SHOOTER_FIRE_COOLDOWN_MS;
          enemyProjectiles.push(makeEnemyProjectile(nextId++, enemy.position, dir));
        }
      }
    } else {
      const dir = directionTo(enemy.position, playerPos);
      enemy.position.x += dir.x * enemy.speed * dt;
      enemy.position.y += dir.y * enemy.speed * dt;
    }
  }
  return nextId;
}

export function stepEnemyProjectiles(projectiles: Projectile[], dt: number): Projectile[] {
  return stepProjectiles(projectiles, dt);
}

// Enemy slow-missile hits the player directly (no pierce/splash) — returns
// the surviving projectiles, mutating player.hp on each hit.
export function resolveEnemyProjectileHits(projectiles: Projectile[], player: Player): Projectile[] {
  const surviving: Projectile[] = [];
  for (const p of projectiles) {
    if (circlesOverlap(p.position, p.radius, player.position, player.radius)) {
      player.hp -= p.damage;
      continue;
    }
    surviving.push(p);
  }
  return surviving;
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

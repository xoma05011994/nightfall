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

function nearestPosition(from: Vec2, positions: Vec2[]): Vec2 {
  let nearest = positions[0]!;
  let nearestDistSq = Infinity;
  for (const pos of positions) {
    const dx = pos.x - from.x;
    const dy = pos.y - from.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq;
      nearest = pos;
    }
  }
  return nearest;
}

// Grunts/Brutes beeline for the nearest player. Shooters instead hover
// around `preferredRange` of their nearest target (advancing if too far,
// backing off if too close) and periodically lob a slow projectile —
// appended to `enemyProjectiles`. Accepts either one player's position
// (solo) or several (co-op) — each enemy independently targets whichever is
// closest to it. Returns the next free projectile id.
export function stepEnemies(enemies: Enemy[], playerPos: Vec2 | Vec2[], dt: number, enemyProjectiles: Projectile[] = [], nextProjectileId = 1): number {
  const positions = Array.isArray(playerPos) ? playerPos : [playerPos];
  let nextId = nextProjectileId;
  for (const enemy of enemies) {
    if (enemy.contactTimerMs > 0) enemy.contactTimerMs -= dt * 1000;
    const target = nearestPosition(enemy.position, positions);

    if (enemy.type === "shooter") {
      const dir = directionTo(enemy.position, target);
      const dist = distance(enemy.position, target);
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
      const dir = directionTo(enemy.position, target);
      enemy.position.x += dir.x * enemy.speed * dt;
      enemy.position.y += dir.y * enemy.speed * dt;
    }
  }
  return nextId;
}

export function stepEnemyProjectiles(projectiles: Projectile[], dt: number): Projectile[] {
  return stepProjectiles(projectiles, dt);
}

// Enemy slow-missile hits whichever player it touches first (no
// pierce/splash) — returns the surviving projectiles, mutating that
// player's hp. Accepts one player (solo) or several (co-op).
export function resolveEnemyProjectileHits(projectiles: Projectile[], player: Player | Player[]): Projectile[] {
  const players = Array.isArray(player) ? player : [player];
  const surviving: Projectile[] = [];
  for (const p of projectiles) {
    const hit = players.find((pl) => circlesOverlap(p.position, p.radius, pl.position, pl.radius));
    if (hit) {
      hit.hp -= p.damage;
      continue;
    }
    surviving.push(p);
  }
  return surviving;
}

// Returns total damage dealt across all players this step (each enemy can
// only land a hit once per its own contact cooldown, not globally, and only
// ever damages the first player it's found overlapping). Accepts one player
// (solo) or several (co-op).
export function resolveEnemyContactDamage(enemies: Enemy[], player: Player | Player[]): number {
  const players = Array.isArray(player) ? player : [player];
  let totalDamage = 0;
  for (const enemy of enemies) {
    if (enemy.contactTimerMs > 0) continue;
    const hit = players.find((pl) => circlesOverlap(enemy.position, enemy.radius, pl.position, pl.radius));
    if (hit) {
      hit.hp -= enemy.damage;
      totalDamage += enemy.damage;
      enemy.contactTimerMs = enemy.contactCooldownMs;
    }
  }
  return totalDamage;
}

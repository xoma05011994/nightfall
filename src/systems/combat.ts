import { directionTo } from "../math";
import type { Enemy, Player, Projectile } from "../types";
import { circlesOverlap } from "./collision";

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

// Removes dead (hp <= 0) enemies from `enemies` in place and returns them —
// shared by projectile hits and the instant-hit beam/cone fire modes, which
// apply damage directly to enemy.hp without a Projectile entity.
export function collectDeadEnemies(enemies: Enemy[]): Enemy[] {
  const dead: Enemy[] = [];
  const alive: Enemy[] = [];
  for (const enemy of enemies) {
    if (enemy.hp <= 0) dead.push(enemy);
    else alive.push(enemy);
  }
  enemies.length = 0;
  enemies.push(...alive);
  return dead;
}

// Single-target hit per projectile, except splash weapons (RPG) which also
// damage every other enemy within splashRadius of the impact point. Returns
// enemies that died this step so the caller can drop XP/loot for them.
export function resolveProjectileHits(projectiles: Projectile[], enemies: Enemy[]): { survivingProjectiles: Projectile[]; deadEnemies: Enemy[] } {
  const survivingProjectiles: Projectile[] = [];

  for (const projectile of projectiles) {
    let hit = false;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      if (circlesOverlap(projectile.position, projectile.radius, enemy.position, enemy.radius)) {
        enemy.hp -= projectile.damage;
        hit = true;
        if (projectile.splashRadius && projectile.splashDamage) {
          for (const other of enemies) {
            if (other === enemy || other.hp <= 0) continue;
            if (circlesOverlap(projectile.position, projectile.splashRadius, other.position, other.radius)) {
              other.hp -= projectile.splashDamage;
            }
          }
        }
        break;
      }
    }
    if (!hit) survivingProjectiles.push(projectile);
  }

  const deadEnemies = collectDeadEnemies(enemies);
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

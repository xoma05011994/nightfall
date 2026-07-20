import { directionTo } from "../math";
import type { Enemy, LightningEffect, Player, Projectile } from "../types";
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

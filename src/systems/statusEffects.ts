import { AURA_TICK_MS, IGNITE_TICK_MS } from "../constants";
import { distanceSq } from "../math";
import type { Enemy, Player } from "../types";
import { collectDeadEnemies } from "./enemies";

function findNearestOtherEnemy(source: Enemy, enemies: Enemy[], maxRange: number): Enemy | null {
  let nearest: Enemy | null = null;
  let nearestDistSq = maxRange * maxRange;
  for (const enemy of enemies) {
    if (enemy === source || enemy.hp <= 0) continue;
    const dSq = distanceSq(source.position, enemy.position);
    if (dSq <= nearestDistSq) {
      nearest = enemy;
      nearestDistSq = dSq;
    }
  }
  return nearest;
}

// Called once per direct weapon hit (projectile/splash/beam/cone) — applies
// the ignite and lightning-chain perks on top of the weapon's own damage.
// No-ops for players who haven't picked the relevant perk (fields are 0).
export function applyOnHitEffects(player: Player, enemies: Enemy[], hitEnemy: Enemy): void {
  if (player.igniteDamagePerTick > 0) {
    hitEnemy.burnDamagePerTick = player.igniteDamagePerTick;
    hitEnemy.burnTicksRemaining = Math.ceil(player.igniteDurationMs / IGNITE_TICK_MS);
    hitEnemy.burnTickTimerMs = IGNITE_TICK_MS;
  }
  if (player.lightningChainDamage > 0) {
    const target = findNearestOtherEnemy(hitEnemy, enemies, player.lightningChainRadius);
    if (target) target.hp -= player.lightningChainDamage;
  }
}

// Ticks every burning enemy's DoT independent of dt (fixed-interval, not
// per-frame) and returns any that died from it, same contract as the
// projectile-hit death list.
export function stepBurningEnemies(enemies: Enemy[], dt: number): Enemy[] {
  for (const enemy of enemies) {
    if (enemy.burnDamagePerTick <= 0) continue;
    enemy.burnTickTimerMs -= dt * 1000;
    while (enemy.burnTickTimerMs <= 0 && enemy.burnTicksRemaining > 0) {
      enemy.hp -= enemy.burnDamagePerTick;
      enemy.burnTicksRemaining -= 1;
      enemy.burnTickTimerMs += IGNITE_TICK_MS;
    }
    if (enemy.burnTicksRemaining <= 0) {
      enemy.burnDamagePerTick = 0;
      enemy.burnTickTimerMs = 0;
    }
  }
  return collectDeadEnemies(enemies);
}

// Deadly Aura — continuous radius damage around the player, independent of
// the equipped weapon. No-ops until the perk sets auraDamagePerTick > 0.
export function stepAura(player: Player, enemies: Enemy[], dt: number): Enemy[] {
  if (player.auraDamagePerTick <= 0) return [];
  player.auraTickTimerMs -= dt * 1000;
  if (player.auraTickTimerMs > 0) return [];
  player.auraTickTimerMs += AURA_TICK_MS;

  const radiusSq = player.auraRadius * player.auraRadius;
  for (const enemy of enemies) {
    if (distanceSq(player.position, enemy.position) <= radiusSq) {
      enemy.hp -= player.auraDamagePerTick;
    }
  }
  return collectDeadEnemies(enemies);
}

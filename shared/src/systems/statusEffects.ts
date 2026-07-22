import { AURA_TICK_MS, IGNITE_TICK_MS, SHURIKEN_HIT_RADIUS, SHURIKEN_ORBIT_RADIUS, SHURIKEN_ORBIT_SPEED, SHURIKEN_TICK_MS } from "../constants";
import { distanceSq } from "../math";
import type { Enemy, LightningEffect, Player } from "../types";
import { circlesOverlap } from "./collision";
import { collectDeadEnemies } from "./enemies";

const LIGHTNING_EFFECT_LIFETIME_MS = 200;
// Tempest's ignite-on-every-jump, when the player hasn't actually picked
// Ignite (so there's no real igniteDamagePerTick/igniteDurationMs to
// borrow) — modest on purpose, since it's a free bonus rather than the
// thing being invested in.
const TEMPEST_BASELINE_BURN_DAMAGE = 3;
const TEMPEST_BASELINE_BURN_DURATION_MS = 2000;

// `excludeIds` skips enemies already hit earlier in the same chain, so a
// multi-jump Chain Lightning arc doesn't just bounce back and forth between
// the same two enemies.
function findNearestOtherEnemy(source: Enemy, enemies: Enemy[], maxRange: number, excludeIds?: Set<number>): Enemy | null {
  let nearest: Enemy | null = null;
  let nearestDistSq = maxRange * maxRange;
  for (const enemy of enemies) {
    if (enemy === source || enemy.hp <= 0) continue;
    if (excludeIds?.has(enemy.id)) continue;
    const dSq = distanceSq(source.position, enemy.position);
    if (dSq <= nearestDistSq) {
      nearest = enemy;
      nearestDistSq = dSq;
    }
  }
  return nearest;
}

// Heals the player for a fraction of any damage they deal — shared by every
// damage source (weapon hits, ignite ticks, aura ticks, lightning chains).
// No-op until the Vampiric perk sets lifeStealPercent > 0.
export function applyLifeSteal(player: Player, damage: number): void {
  if (player.lifeStealPercent <= 0 || damage <= 0) return;
  player.hp = Math.min(player.maxHp, player.hp + damage * player.lifeStealPercent);
}

// Called once per direct weapon hit (projectile/beam/cone, not splash) —
// applies the ignite and lightning-chain perks on top of the weapon's own
// damage. No-ops for players who haven't picked the relevant perk (fields
// are 0). Pushes a visual for the lightning chain when it fires.
export function applyOnHitEffects(player: Player, enemies: Enemy[], hitEnemy: Enemy, lightningEffects: LightningEffect[], nowMs: number): void {
  if (player.igniteDamagePerTick > 0) {
    hitEnemy.burnDamagePerTick = player.igniteDamagePerTick;
    hitEnemy.burnTicksRemaining = Math.ceil(player.igniteDurationMs / IGNITE_TICK_MS);
    hitEnemy.burnTickTimerMs = IGNITE_TICK_MS;
  }
  if (player.lightningChainDamage > 0) {
    // Chain Lightning's rank grows how many enemies in a row the arc jumps
    // to (1 = just the original hit's nearest target, the pre-v0.84
    // behavior) — each hop excludes everyone already hit in this chain so
    // it can't just bounce back and forth between two enemies.
    const hops = Math.max(1, player.lightningChainCount);
    const visited = new Set<number>([hitEnemy.id]);
    let source = hitEnemy;
    for (let i = 0; i < hops; i++) {
      const target = findNearestOtherEnemy(source, enemies, player.lightningChainRadius, visited);
      if (!target) break;
      // Passive synergy: Ignite + Chain Lightning together — arcing into an
      // already-burning enemy deals double chain damage. Free once you have
      // both perks, no separate pick required.
      const damage = target.burnDamagePerTick > 0 ? player.lightningChainDamage * 2 : player.lightningChainDamage;
      target.hp -= damage;
      applyLifeSteal(player, damage);
      lightningEffects.push({ from: { ...source.position }, to: { ...target.position }, expiresAtMs: nowMs + LIGHTNING_EFFECT_LIFETIME_MS, seed: source.id + target.id });
      // Tempest — every jump ignites its target too, using Ignite's own
      // numbers if picked (also making the *next* jump's double-damage
      // synergy trigger off this target), or a modest baseline if not.
      if (player.chainAlwaysIgnites) {
        target.burnDamagePerTick = player.igniteDamagePerTick > 0 ? player.igniteDamagePerTick : TEMPEST_BASELINE_BURN_DAMAGE;
        target.burnTicksRemaining = Math.ceil((player.igniteDamagePerTick > 0 ? player.igniteDurationMs : TEMPEST_BASELINE_BURN_DURATION_MS) / IGNITE_TICK_MS);
        target.burnTickTimerMs = IGNITE_TICK_MS;
      }
      visited.add(target.id);
      source = target;
    }
  }
}

// Ticks every burning enemy's DoT independent of dt (fixed-interval, not
// per-frame) and returns any that died from it, same contract as the
// projectile-hit death list.
export function stepBurningEnemies(player: Player, enemies: Enemy[], dt: number): Enemy[] {
  for (const enemy of enemies) {
    if (enemy.burnDamagePerTick <= 0) continue;
    enemy.burnTickTimerMs -= dt * 1000;
    while (enemy.burnTickTimerMs <= 0 && enemy.burnTicksRemaining > 0) {
      enemy.hp -= enemy.burnDamagePerTick;
      applyLifeSteal(player, enemy.burnDamagePerTick);
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
// Two capstone perks change its behavior once picked on top of it: Wildfire
// (auraAppliesIgnite) also ignites what it hits — but only does damage if
// Ignite is also picked (igniteDamagePerTick > 0), same for Overload
// (auraTriggersLightning) arcing to the nearest enemy just past the aura's
// edge, which needs Chain Lightning to matter.
export function stepAura(player: Player, enemies: Enemy[], dt: number, lightningEffects: LightningEffect[], nowMs: number): Enemy[] {
  if (player.auraDamagePerTick <= 0) return [];
  player.auraTickTimerMs -= dt * 1000;
  if (player.auraTickTimerMs > 0) return [];
  player.auraTickTimerMs += AURA_TICK_MS;

  const radiusSq = player.auraRadius * player.auraRadius;
  let hitAny = false;
  for (const enemy of enemies) {
    if (distanceSq(player.position, enemy.position) <= radiusSq) {
      enemy.hp -= player.auraDamagePerTick;
      applyLifeSteal(player, player.auraDamagePerTick);
      if (player.auraAppliesIgnite && player.igniteDamagePerTick > 0) {
        enemy.burnDamagePerTick = player.igniteDamagePerTick;
        enemy.burnTicksRemaining = Math.ceil(player.igniteDurationMs / IGNITE_TICK_MS);
        enemy.burnTickTimerMs = IGNITE_TICK_MS;
      }
      // Vortex — drags anything the aura hits a little closer each tick,
      // capped so it can't overshoot past the player.
      if (player.auraPull > 0) {
        const dx = player.position.x - enemy.position.x;
        const dy = player.position.y - enemy.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1e-6) {
          const pull = Math.min(player.auraPull, dist);
          enemy.position.x += (dx / dist) * pull;
          enemy.position.y += (dy / dist) * pull;
        }
      }
      hitAny = true;
    }
  }

  if (hitAny && player.auraTriggersLightning && player.lightningChainDamage > 0) {
    // Only enemies past the aura's own edge — otherwise this would just
    // re-select whatever the aura tick already hit, since that's normally
    // the closest thing to the player.
    const minRangeSq = radiusSq;
    const maxRangeSq = (player.auraRadius + player.lightningChainRadius) ** 2;
    let nearest: Enemy | null = null;
    let nearestDistSq = maxRangeSq;
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const dSq = distanceSq(player.position, enemy.position);
      if (dSq > minRangeSq && dSq <= nearestDistSq) {
        nearest = enemy;
        nearestDistSq = dSq;
      }
    }
    if (nearest) {
      nearest.hp -= player.lightningChainDamage;
      applyLifeSteal(player, player.lightningChainDamage);
      lightningEffects.push({ from: { x: player.position.x, y: player.position.y }, to: { ...nearest.position }, expiresAtMs: nowMs + LIGHTNING_EFFECT_LIFETIME_MS, seed: nearest.id });
    }
  }

  return collectDeadEnemies(enemies);
}

// The i-th of `count` shurikens' current orbit position angle — a pure
// function of elapsed time, not any stored per-shuriken state, so the
// server tick and the client's render loop compute identical positions
// from the same (index, count, nowMs) without needing to sync anything.
export function shurikenAngle(index: number, count: number, nowMs: number): number {
  return (nowMs / 1000) * SHURIKEN_ORBIT_SPEED + (index / count) * Math.PI * 2;
}

// Shurikens perk — blades orbiting the player, damaging anything they sweep
// through. Ticks on a fixed interval (same "sample, don't continuously
// collide" pattern as Deadly Aura) rather than every frame, so an enemy
// sitting in the orbit ring takes hits at a predictable rate instead of a
// framerate-dependent one.
export function stepShurikens(player: Player, enemies: Enemy[], dt: number, nowMs: number): Enemy[] {
  if (player.shurikenCount <= 0) return [];
  player.shurikenTickTimerMs -= dt * 1000;
  if (player.shurikenTickTimerMs > 0) return [];
  player.shurikenTickTimerMs += SHURIKEN_TICK_MS;

  for (let i = 0; i < player.shurikenCount; i++) {
    const angle = shurikenAngle(i, player.shurikenCount, nowMs);
    const point = {
      x: player.position.x + Math.cos(angle) * SHURIKEN_ORBIT_RADIUS,
      y: player.position.y + Math.sin(angle) * SHURIKEN_ORBIT_RADIUS,
    };
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      if (circlesOverlap(point, SHURIKEN_HIT_RADIUS, enemy.position, enemy.radius)) {
        enemy.hp -= player.shurikenDamagePerTick;
        applyLifeSteal(player, player.shurikenDamagePerTick);
      }
    }
  }

  return collectDeadEnemies(enemies);
}

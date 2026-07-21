import { CHAIN_LINK_HIT_WIDTH } from "../constants";
import { directionTo, distance, pointToRaySegmentDistance } from "../math";
import type { Enemy, LightningEffect, Vec2 } from "../types";
import { collectDeadEnemies } from "./enemies";

// Multiplayer-only — draws a laser between each pair of adjacent connected
// players (ordered by connection order) and damages any enemy caught within
// CHAIN_LINK_HIT_WIDTH of a segment. `damagePerTick` is the party's pooled
// Chain Link investment (see match.ts) — callers should skip calling this
// entirely below 2 players or when damagePerTick <= 0, same no-op contract
// as stepAura. An enemy straddling two segments (3+ players) is only ever
// damaged once per call, not once per overlapping segment.
export function stepChainLink(positions: Vec2[], damagePerTick: number, enemies: Enemy[], lightningEffects: LightningEffect[], nowMs: number): Enemy[] {
  if (damagePerTick <= 0 || positions.length < 2) return [];

  const hitThisTick = new Set<number>();
  for (let i = 0; i < positions.length - 1; i++) {
    const from = positions[i]!;
    const to = positions[i + 1]!;
    const length = distance(from, to);
    const dir = directionTo(from, to);

    lightningEffects.push({ from: { ...from }, to: { ...to }, expiresAtMs: nowMs + 200, seed: i * 7919 + Math.round(from.x + to.y) });

    for (const enemy of enemies) {
      if (enemy.hp <= 0 || hitThisTick.has(enemy.id)) continue;
      const dist = pointToRaySegmentDistance(enemy.position, from, dir, length);
      if (dist !== null && dist <= CHAIN_LINK_HIT_WIDTH + enemy.radius) {
        enemy.hp -= damagePerTick;
        hitThisTick.add(enemy.id);
      }
    }
  }

  return collectDeadEnemies(enemies);
}

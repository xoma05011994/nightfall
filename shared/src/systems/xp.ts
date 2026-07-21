import { BASE_XP_TO_LEVEL, MAGNET_PULL_SPEED, XP_LEVEL_EXPONENT, XP_ORB_BASE_VALUE, XP_ORB_RADIUS } from "../constants";
import { distanceSq } from "../math";
import type { Enemy, Player, XpOrb } from "../types";
import { circlesOverlap } from "./collision";

export function xpToNextForLevel(level: number): number {
  return Math.round(BASE_XP_TO_LEVEL * Math.pow(level, XP_LEVEL_EXPONENT));
}

export function spawnXpOrbForEnemy(id: number, enemy: Enemy): XpOrb {
  return {
    id,
    position: { x: enemy.position.x, y: enemy.position.y },
    value: XP_ORB_BASE_VALUE,
    radius: XP_ORB_RADIUS,
  };
}

// Widened beyond `Player` so co-op's pooled party progress (a plain
// {xp,level,xpToNext} counter, not a full Player) can reuse the exact same
// leveling math instead of duplicating this loop.
export interface XpProgress {
  xp: number;
  level: number;
  xpToNext: number;
}

// Applies XP to the tracker and rolls over as many levels as the amount
// covers in one go (handles multi-level jumps from a single kill).
export function grantXp(tracker: XpProgress, amount: number): { leveledUp: boolean; levelsGained: number } {
  tracker.xp += amount;
  let levelsGained = 0;
  while (tracker.xp >= tracker.xpToNext) {
    tracker.xp -= tracker.xpToNext;
    tracker.level += 1;
    levelsGained += 1;
    tracker.xpToNext = xpToNextForLevel(tracker.level);
  }
  return { leveledUp: levelsGained > 0, levelsGained };
}

// Orbs within pickupRadius fly toward the player; direct overlap collects
// them. Magnetized orbs (from the Magnet chest reward) home in at a fast
// fixed speed regardless of distance, ignoring pickupRadius entirely — this
// is what makes the reward read as "every orb on the map flies to you"
// rather than an instant, invisible xp grant. Returns the total XP collected
// this step (0 if none).
export function stepXpOrbs(orbs: XpOrb[], player: Player, dt: number): { survivingOrbs: XpOrb[]; xpCollected: number } {
  const survivingOrbs: XpOrb[] = [];
  let xpCollected = 0;
  const pickupRadiusSq = player.pickupRadius * player.pickupRadius;
  const magnetSpeed = 700; // px/sec, fast enough to feel snappy once in range

  for (const orb of orbs) {
    if (circlesOverlap(orb.position, orb.radius, player.position, player.radius)) {
      xpCollected += orb.value;
      continue;
    }
    if (orb.magnetized || distanceSq(orb.position, player.position) <= pickupRadiusSq) {
      const speed = orb.magnetized ? MAGNET_PULL_SPEED : magnetSpeed;
      const dx = player.position.x - orb.position.x;
      const dy = player.position.y - orb.position.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      orb.position.x += (dx / len) * speed * dt;
      orb.position.y += (dy / len) * speed * dt;
    }
    survivingOrbs.push(orb);
  }

  return { survivingOrbs, xpCollected };
}

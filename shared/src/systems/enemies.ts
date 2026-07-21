import type { Enemy } from "../types";

// Removes dead (hp <= 0) enemies from `enemies` in place and returns them —
// shared by every damage source (projectile hits, splash, beam, cone,
// ignite ticks, aura ticks), which all apply damage directly to enemy.hp
// through different code paths but need the same death bookkeeping.
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

import { WEAPON_DROP_CHANCE, WEAPON_PICKUP_RADIUS } from "../constants";
import type { Player, Vec2, WeaponId, WeaponPickup } from "../types";
import { circlesOverlap } from "./collision";
import { DROPPABLE_WEAPON_IDS } from "./weapons";

export function rollWeaponDrop(rng: () => number): WeaponId | null {
  if (rng() > WEAPON_DROP_CHANCE) return null;
  const index = Math.floor(rng() * DROPPABLE_WEAPON_IDS.length);
  return DROPPABLE_WEAPON_IDS[index] ?? null;
}

export function spawnWeaponPickup(id: number, weaponId: WeaponId, position: Vec2): WeaponPickup {
  return { id, position: { x: position.x, y: position.y }, weaponId, radius: WEAPON_PICKUP_RADIUS };
}

// Weapon pickups have no magnet (unlike XP orbs) — the player must walk
// directly onto one. Doesn't remove it from the world; the caller decides
// whether to consume it (auto-equip into an empty slot, or after the player
// confirms a slot swap) or leave it be (declining a swap prompt).
export function findTouchedPickup(pickups: WeaponPickup[], player: Player): WeaponPickup | null {
  for (const pickup of pickups) {
    if (circlesOverlap(pickup.position, pickup.radius, player.position, player.radius)) return pickup;
  }
  return null;
}

import { xpToNextForLevel } from "../src/systems/xp";
import { createWeaponInstance } from "../src/systems/weapons";
import type { Player, WeaponSlots } from "../src/types";

export function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    position: { x: 0, y: 0 },
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: xpToNextForLevel(1),
    moveSpeed: 200,
    radius: 14,
    pickupRadius: 90,
    damageMultiplier: 1,
    attackCooldownMultiplier: 1,
    extraProjectiles: 0,
    weaponSlots: [createWeaponInstance("pistol"), null, null] as WeaponSlots,
    equippedSlot: 0,
    ...overrides,
  };
}

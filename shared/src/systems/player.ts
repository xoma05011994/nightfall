import { PLAYER_BASE_HP, PLAYER_BASE_MOVE_SPEED, PLAYER_BASE_PICKUP_RADIUS, PLAYER_RADIUS } from "../constants";
import type { Player, WeaponSlots } from "../types";
import { createWeaponInstance } from "./weapons";
import { xpToNextForLevel } from "./xp";

// Single source of truth for a fresh player's starting stats — used by solo
// Game.ts and the multiplayer match actor alike, so the two stay numerically
// identical.
export function createPlayer(): Player {
  return {
    position: { x: 0, y: 0 },
    hp: PLAYER_BASE_HP,
    maxHp: PLAYER_BASE_HP,
    level: 1,
    xp: 0,
    xpToNext: xpToNextForLevel(1),
    moveSpeed: PLAYER_BASE_MOVE_SPEED,
    radius: PLAYER_RADIUS,
    pickupRadius: PLAYER_BASE_PICKUP_RADIUS,
    damageMultiplier: 1,
    attackCooldownMultiplier: 1,
    extraProjectiles: 0,
    weaponSlots: [createWeaponInstance("pistol"), null, null] as WeaponSlots,
    equippedSlot: 0,
    pierce: 0,
    igniteDamagePerTick: 0,
    igniteDurationMs: 0,
    lightningChainDamage: 0,
    lightningChainRadius: 0,
    auraDamagePerTick: 0,
    auraRadius: 0,
    auraTickTimerMs: 0,
    lifeStealPercent: 0,
    berserkerIntensity: 0,
    momentumStacks: 0,
    momentumTimerMs: 0,
    momentumFireRatePerStack: 0,
    auraAppliesIgnite: false,
    auraTriggersLightning: false,
    goldMultiplier: 1,
    chainLinkDamagePerTick: 0,
    isGhost: false,
    facingAngle: Math.PI / 2,
  };
}

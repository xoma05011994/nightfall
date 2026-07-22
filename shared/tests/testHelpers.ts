import { xpToNextForLevel } from "../src/systems/xp";
import { createWeaponInstance } from "../src/systems/weapons";
import type { Enemy, Player, WeaponSlots } from "../src/types";

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
    shurikenCount: 0,
    shurikenDamagePerTick: 0,
    shurikenTickTimerMs: 0,
    lightningChainCount: 0,
    isGhost: false,
    facingAngle: Math.PI / 2,
    ...overrides,
  };
}

export function makeEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 1,
    type: "grunt",
    position: { x: 100, y: 0 },
    hp: 20,
    maxHp: 20,
    speed: 90,
    damage: 8,
    radius: 14,
    contactCooldownMs: 700,
    contactTimerMs: 0,
    burnDamagePerTick: 0,
    burnTicksRemaining: 0,
    burnTickTimerMs: 0,
    ...overrides,
  };
}

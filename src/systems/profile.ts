import type { WeaponId } from "../types";

// Meta-progression is Adventure-mode only: coins earned by completing a
// level persist here and can be spent on permanent per-weapon damage
// upgrades. Endless mode never reads or writes this — its gold is a
// per-run stat only (see Game.goldEarned).
export interface PlayerProfile {
  coins: number;
  weaponUpgrades: Partial<Record<WeaponId, number>>;
}

const STORAGE_KEY = "nightfall-profile-v1";
export const MAX_WEAPON_UPGRADE_LEVEL = 5;
export const WEAPON_UPGRADE_DAMAGE_PER_LEVEL = 0.1; // +10% damage per level

function defaultProfile(): PlayerProfile {
  return { coins: 0, weaponUpgrades: {} };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile> | null;
    if (typeof parsed !== "object" || parsed === null) return defaultProfile();
    return {
      coins: typeof parsed.coins === "number" && parsed.coins >= 0 ? parsed.coins : 0,
      weaponUpgrades: typeof parsed.weaponUpgrades === "object" && parsed.weaponUpgrades !== null ? parsed.weaponUpgrades : {},
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable/full (private browsing, quota, etc.) — silently
    // drop the save rather than crash the game over a non-critical feature.
  }
}

export function getWeaponUpgradeLevel(profile: PlayerProfile, weaponId: WeaponId): number {
  return profile.weaponUpgrades[weaponId] ?? 0;
}

export function upgradeCost(currentLevel: number): number {
  return 50 + currentLevel * 40;
}

export function weaponDamageMultiplier(upgradeLevel: number): number {
  return 1 + upgradeLevel * WEAPON_UPGRADE_DAMAGE_PER_LEVEL;
}

// Returns a new profile with the upgrade applied, or null if it can't be
// bought (maxed out or insufficient coins) — never mutates the input.
export function purchaseWeaponUpgrade(profile: PlayerProfile, weaponId: WeaponId): PlayerProfile | null {
  const currentLevel = getWeaponUpgradeLevel(profile, weaponId);
  if (currentLevel >= MAX_WEAPON_UPGRADE_LEVEL) return null;
  const cost = upgradeCost(currentLevel);
  if (profile.coins < cost) return null;
  return {
    coins: profile.coins - cost,
    weaponUpgrades: { ...profile.weaponUpgrades, [weaponId]: currentLevel + 1 },
  };
}

import type { WeaponId } from "../types";
import { LEVELS } from "./levels";

// v1.0 — meta-progression coins are now account-wide: every run (Endless or
// Adventure, win or lose) banks its gold here (see main.ts's onGameOver/
// onVictory) rather than only an Adventure win. Weapon upgrades, starting
// perks, and the extra weapon slot all apply in both modes too — solo-only,
// multiplayer has no profile/meta-progression concept at all.
export interface PlayerProfile {
  coins: number;
  weaponUpgrades: Partial<Record<WeaponId, number>>;
  // Levels are locked by default — only LEVELS[0] starts unlocked. Winning a
  // level (killing its 6-minute boss) unlocks the next one in LEVELS order.
  unlockedLevelIds: string[];
  // Purely a rendering toggle (see types.ts's DamagePopupEffect) — the sim
  // always computes damage popups regardless of this, only the renderer's
  // draw call reads it.
  showDamageNumbers: boolean;
  // v1.0 — Armory purchases. startingPerkIds: perks bought once that are
  // auto-applied (at rank 1) to a fresh Player every run, on top of
  // whatever gets picked at level-ups. Only tier-0, non-multiplayer-only
  // perks are purchasable this way (see shopScreen.ts's eligibility
  // filter) — nothing that would sit inert without a prerequisite. Each
  // one purchased only once (a toggle, not a rank).
  startingPerkIds: string[];
  // Grows Player.weaponSlotCount from 3 to 4 for the rest of every future
  // run once bought — a one-time unlock, not a rank.
  weaponSlotUnlocked: boolean;
}

const STORAGE_KEY = "nightfall-profile-v1";
export const MAX_WEAPON_UPGRADE_LEVEL = 5;
export const WEAPON_UPGRADE_DAMAGE_PER_LEVEL = 0.1; // +10% damage per level
export const STARTING_PERK_COST = 150;
export const EXTRA_WEAPON_SLOT_COST = 300;

function defaultProfile(): PlayerProfile {
  return {
    coins: 0,
    weaponUpgrades: {},
    unlockedLevelIds: LEVELS[0] ? [LEVELS[0].id] : [],
    showDamageNumbers: true,
    startingPerkIds: [],
    weaponSlotUnlocked: false,
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile> | null;
    if (typeof parsed !== "object" || parsed === null) return defaultProfile();
    const unlockedLevelIds = Array.isArray(parsed.unlockedLevelIds) ? parsed.unlockedLevelIds.filter((id): id is string => typeof id === "string") : [];
    // The first level is always unlocked, even if a corrupted/older save is
    // missing it — never allow the player to end up with nothing playable.
    if (LEVELS[0] && !unlockedLevelIds.includes(LEVELS[0].id)) unlockedLevelIds.push(LEVELS[0].id);
    return {
      coins: typeof parsed.coins === "number" && parsed.coins >= 0 ? parsed.coins : 0,
      weaponUpgrades: typeof parsed.weaponUpgrades === "object" && parsed.weaponUpgrades !== null ? parsed.weaponUpgrades : {},
      unlockedLevelIds,
      showDamageNumbers: typeof parsed.showDamageNumbers === "boolean" ? parsed.showDamageNumbers : true,
      startingPerkIds: Array.isArray(parsed.startingPerkIds) ? parsed.startingPerkIds.filter((id): id is string => typeof id === "string") : [],
      weaponSlotUnlocked: typeof parsed.weaponSlotUnlocked === "boolean" ? parsed.weaponSlotUnlocked : false,
    };
  } catch {
    return defaultProfile();
  }
}

export function isLevelUnlocked(profile: PlayerProfile, levelId: string): boolean {
  return profile.unlockedLevelIds.includes(levelId);
}

// Returns a new profile with the level immediately after `completedLevelId`
// (in LEVELS order) unlocked, or the same profile if there's no next level
// or it's already unlocked. Never mutates the input.
export function unlockNextLevel(profile: PlayerProfile, completedLevelId: string): PlayerProfile {
  const index = LEVELS.findIndex((l) => l.id === completedLevelId);
  const next = index >= 0 ? LEVELS[index + 1] : undefined;
  if (!next || profile.unlockedLevelIds.includes(next.id)) return profile;
  return { ...profile, unlockedLevelIds: [...profile.unlockedLevelIds, next.id] };
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
    ...profile,
    coins: profile.coins - cost,
    weaponUpgrades: { ...profile.weaponUpgrades, [weaponId]: currentLevel + 1 },
  };
}

// Returns a new profile with `perkId` added to startingPerkIds, or null if
// it's already owned or coins are insufficient — never mutates the input.
export function purchaseStartingPerk(profile: PlayerProfile, perkId: string): PlayerProfile | null {
  if (profile.startingPerkIds.includes(perkId)) return null;
  if (profile.coins < STARTING_PERK_COST) return null;
  return {
    ...profile,
    coins: profile.coins - STARTING_PERK_COST,
    startingPerkIds: [...profile.startingPerkIds, perkId],
  };
}

// Returns a new profile with weaponSlotUnlocked set, or null if it's already
// unlocked or coins are insufficient — never mutates the input.
export function purchaseExtraWeaponSlot(profile: PlayerProfile): PlayerProfile | null {
  if (profile.weaponSlotUnlocked) return null;
  if (profile.coins < EXTRA_WEAPON_SLOT_COST) return null;
  return { ...profile, coins: profile.coins - EXTRA_WEAPON_SLOT_COST, weaponSlotUnlocked: true };
}

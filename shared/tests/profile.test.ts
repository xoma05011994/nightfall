import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEVELS } from "../src/systems/levels";
import {
  EXTRA_WEAPON_SLOT_COST,
  MAX_WEAPON_UPGRADE_LEVEL,
  STARTING_PERK_COST,
  getWeaponUpgradeLevel,
  isLevelUnlocked,
  loadProfile,
  purchaseExtraWeaponSlot,
  purchaseStartingPerk,
  purchaseWeaponUpgrade,
  saveProfile,
  unlockNextLevel,
  upgradeCost,
  weaponDamageMultiplier,
} from "../src/systems/profile";

// The test environment is Node (no DOM), so localStorage doesn't exist —
// stub a minimal in-memory implementation rather than pulling in jsdom.
function makeLocalStorageStub() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageStub());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadProfile", () => {
  it("returns a default profile (only the first level unlocked) when nothing is stored", () => {
    const profile = loadProfile();
    expect(profile.coins).toBe(0);
    expect(profile.weaponUpgrades).toEqual({});
    expect(profile.unlockedLevelIds).toEqual([LEVELS[0]!.id]);
    expect(profile.showDamageNumbers).toBe(true);
    expect(profile.startingPerkIds).toEqual([]);
    expect(profile.weaponSlotUnlocked).toBe(false);
  });

  it("round-trips through saveProfile", () => {
    saveProfile({
      coins: 120,
      weaponUpgrades: { pistol: 2 },
      unlockedLevelIds: [LEVELS[0]!.id, LEVELS[1]!.id],
      showDamageNumbers: false,
      startingPerkIds: ["damage"],
      weaponSlotUnlocked: true,
    });
    const profile = loadProfile();
    expect(profile.coins).toBe(120);
    expect(profile.weaponUpgrades.pistol).toBe(2);
    expect(profile.unlockedLevelIds).toEqual([LEVELS[0]!.id, LEVELS[1]!.id]);
    expect(profile.showDamageNumbers).toBe(false);
    expect(profile.startingPerkIds).toEqual(["damage"]);
    expect(profile.weaponSlotUnlocked).toBe(true);
  });

  it("falls back to showDamageNumbers: true when the stored value isn't a boolean", () => {
    localStorage.setItem("nightfall-profile-v1", JSON.stringify({ coins: 0, weaponUpgrades: {}, unlockedLevelIds: [], showDamageNumbers: "nope" }));
    expect(loadProfile().showDamageNumbers).toBe(true);
  });

  it("falls back to startingPerkIds: [] and weaponSlotUnlocked: false when missing/invalid", () => {
    localStorage.setItem(
      "nightfall-profile-v1",
      JSON.stringify({ coins: 0, weaponUpgrades: {}, unlockedLevelIds: [], startingPerkIds: "nope", weaponSlotUnlocked: "nope" }),
    );
    const profile = loadProfile();
    expect(profile.startingPerkIds).toEqual([]);
    expect(profile.weaponSlotUnlocked).toBe(false);
  });

  it("falls back to a default profile on corrupt stored JSON", () => {
    localStorage.setItem("nightfall-profile-v1", "{not valid json");
    const profile = loadProfile();
    expect(profile.coins).toBe(0);
  });

  it("falls back to a default profile when coins is missing or negative", () => {
    localStorage.setItem("nightfall-profile-v1", JSON.stringify({ coins: -5, weaponUpgrades: {} }));
    expect(loadProfile().coins).toBe(0);
  });

  it("always includes the first level, even from a corrupted save missing it", () => {
    localStorage.setItem("nightfall-profile-v1", JSON.stringify({ coins: 0, weaponUpgrades: {}, unlockedLevelIds: [] }));
    expect(loadProfile().unlockedLevelIds).toContain(LEVELS[0]!.id);
  });
});

describe("getWeaponUpgradeLevel", () => {
  it("returns 0 for a weapon with no recorded upgrade", () => {
    expect(
      getWeaponUpgradeLevel(
        { coins: 0, weaponUpgrades: {}, unlockedLevelIds: [], showDamageNumbers: true, startingPerkIds: [], weaponSlotUnlocked: false },
        "pistol",
      ),
    ).toBe(0);
  });
});

describe("isLevelUnlocked / unlockNextLevel", () => {
  it("only the first level is unlocked on a fresh profile", () => {
    const profile = loadProfile();
    expect(isLevelUnlocked(profile, LEVELS[0]!.id)).toBe(true);
    expect(isLevelUnlocked(profile, LEVELS[1]!.id)).toBe(false);
  });

  it("unlocks the next level in sequence after completing one", () => {
    const profile = loadProfile();
    const updated = unlockNextLevel(profile, LEVELS[0]!.id);
    expect(isLevelUnlocked(updated, LEVELS[1]!.id)).toBe(true);
    expect(isLevelUnlocked(updated, LEVELS[2]!.id)).toBe(false);
  });

  it("does not mutate the input profile", () => {
    const profile = loadProfile();
    unlockNextLevel(profile, LEVELS[0]!.id);
    expect(profile.unlockedLevelIds).toEqual([LEVELS[0]!.id]);
  });

  it("is a no-op past the last level", () => {
    const lastLevel = LEVELS[LEVELS.length - 1]!;
    const profile = {
      coins: 0,
      weaponUpgrades: {},
      unlockedLevelIds: LEVELS.map((l) => l.id),
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: false,
    };
    const updated = unlockNextLevel(profile, lastLevel.id);
    expect(updated.unlockedLevelIds).toEqual(profile.unlockedLevelIds);
  });
});

describe("upgradeCost", () => {
  it("increases with each level", () => {
    expect(upgradeCost(1)).toBeGreaterThan(upgradeCost(0));
    expect(upgradeCost(2)).toBeGreaterThan(upgradeCost(1));
  });
});

describe("weaponDamageMultiplier", () => {
  it("is 1 at level 0", () => {
    expect(weaponDamageMultiplier(0)).toBe(1);
  });

  it("increases by 10% per level", () => {
    expect(weaponDamageMultiplier(1)).toBeCloseTo(1.1, 5);
    expect(weaponDamageMultiplier(3)).toBeCloseTo(1.3, 5);
  });
});

describe("purchaseWeaponUpgrade", () => {
  it("deducts the cost and increments the level on a successful purchase", () => {
    const profile = { coins: 100, weaponUpgrades: {}, unlockedLevelIds: [], showDamageNumbers: true, startingPerkIds: [], weaponSlotUnlocked: false };
    const result = purchaseWeaponUpgrade(profile, "pistol");
    expect(result).not.toBeNull();
    expect(result!.coins).toBe(100 - upgradeCost(0));
    expect(result!.weaponUpgrades.pistol).toBe(1);
  });

  it("does not mutate the input profile", () => {
    const profile = { coins: 100, weaponUpgrades: {}, unlockedLevelIds: [], showDamageNumbers: true, startingPerkIds: [], weaponSlotUnlocked: false };
    purchaseWeaponUpgrade(profile, "pistol");
    expect(profile.coins).toBe(100);
    expect(profile.weaponUpgrades).toEqual({});
  });

  it("preserves unlockedLevelIds on the returned profile", () => {
    const profile = {
      coins: 100,
      weaponUpgrades: {},
      unlockedLevelIds: [LEVELS[0]!.id],
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: false,
    };
    const result = purchaseWeaponUpgrade(profile, "pistol");
    expect(result!.unlockedLevelIds).toEqual([LEVELS[0]!.id]);
  });

  it("returns null when the player can't afford the next level", () => {
    const profile = { coins: 0, weaponUpgrades: {}, unlockedLevelIds: [], showDamageNumbers: true, startingPerkIds: [], weaponSlotUnlocked: false };
    expect(purchaseWeaponUpgrade(profile, "pistol")).toBeNull();
  });

  it("returns null once a weapon is already at the max upgrade level", () => {
    const profile = {
      coins: 999_999,
      weaponUpgrades: { pistol: MAX_WEAPON_UPGRADE_LEVEL },
      unlockedLevelIds: [],
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: false,
    };
    expect(purchaseWeaponUpgrade(profile, "pistol")).toBeNull();
  });
});

describe("purchaseStartingPerk", () => {
  it("deducts the cost and adds the perk id on a successful purchase", () => {
    const profile = {
      coins: STARTING_PERK_COST,
      weaponUpgrades: {},
      unlockedLevelIds: [],
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: false,
    };
    const result = purchaseStartingPerk(profile, "damage");
    expect(result).not.toBeNull();
    expect(result!.coins).toBe(0);
    expect(result!.startingPerkIds).toEqual(["damage"]);
  });

  it("does not mutate the input profile", () => {
    const profile = {
      coins: STARTING_PERK_COST,
      weaponUpgrades: {},
      unlockedLevelIds: [],
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: false,
    };
    purchaseStartingPerk(profile, "damage");
    expect(profile.startingPerkIds).toEqual([]);
  });

  it("returns null when the player can't afford it", () => {
    const profile = {
      coins: STARTING_PERK_COST - 1,
      weaponUpgrades: {},
      unlockedLevelIds: [],
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: false,
    };
    expect(purchaseStartingPerk(profile, "damage")).toBeNull();
  });

  it("returns null when the perk is already owned", () => {
    const profile = {
      coins: 999_999,
      weaponUpgrades: {},
      unlockedLevelIds: [],
      showDamageNumbers: true,
      startingPerkIds: ["damage"],
      weaponSlotUnlocked: false,
    };
    expect(purchaseStartingPerk(profile, "damage")).toBeNull();
  });
});

describe("purchaseExtraWeaponSlot", () => {
  it("deducts the cost and unlocks the slot on a successful purchase", () => {
    const profile = {
      coins: EXTRA_WEAPON_SLOT_COST,
      weaponUpgrades: {},
      unlockedLevelIds: [],
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: false,
    };
    const result = purchaseExtraWeaponSlot(profile);
    expect(result).not.toBeNull();
    expect(result!.coins).toBe(0);
    expect(result!.weaponSlotUnlocked).toBe(true);
  });

  it("returns null when the player can't afford it", () => {
    const profile = {
      coins: EXTRA_WEAPON_SLOT_COST - 1,
      weaponUpgrades: {},
      unlockedLevelIds: [],
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: false,
    };
    expect(purchaseExtraWeaponSlot(profile)).toBeNull();
  });

  it("returns null when already unlocked", () => {
    const profile = {
      coins: 999_999,
      weaponUpgrades: {},
      unlockedLevelIds: [],
      showDamageNumbers: true,
      startingPerkIds: [],
      weaponSlotUnlocked: true,
    };
    expect(purchaseExtraWeaponSlot(profile)).toBeNull();
  });
});

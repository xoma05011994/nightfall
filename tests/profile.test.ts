import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_WEAPON_UPGRADE_LEVEL, getWeaponUpgradeLevel, loadProfile, purchaseWeaponUpgrade, saveProfile, upgradeCost, weaponDamageMultiplier } from "../src/systems/profile";

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
  it("returns a default (empty) profile when nothing is stored", () => {
    const profile = loadProfile();
    expect(profile.coins).toBe(0);
    expect(profile.weaponUpgrades).toEqual({});
  });

  it("round-trips through saveProfile", () => {
    saveProfile({ coins: 120, weaponUpgrades: { pistol: 2 } });
    const profile = loadProfile();
    expect(profile.coins).toBe(120);
    expect(profile.weaponUpgrades.pistol).toBe(2);
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
});

describe("getWeaponUpgradeLevel", () => {
  it("returns 0 for a weapon with no recorded upgrade", () => {
    expect(getWeaponUpgradeLevel({ coins: 0, weaponUpgrades: {} }, "pistol")).toBe(0);
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
    const profile = { coins: 100, weaponUpgrades: {} };
    const result = purchaseWeaponUpgrade(profile, "pistol");
    expect(result).not.toBeNull();
    expect(result!.coins).toBe(100 - upgradeCost(0));
    expect(result!.weaponUpgrades.pistol).toBe(1);
  });

  it("does not mutate the input profile", () => {
    const profile = { coins: 100, weaponUpgrades: {} };
    purchaseWeaponUpgrade(profile, "pistol");
    expect(profile.coins).toBe(100);
    expect(profile.weaponUpgrades).toEqual({});
  });

  it("returns null when the player can't afford the next level", () => {
    const profile = { coins: 0, weaponUpgrades: {} };
    expect(purchaseWeaponUpgrade(profile, "pistol")).toBeNull();
  });

  it("returns null once a weapon is already at the max upgrade level", () => {
    const profile = { coins: 999_999, weaponUpgrades: { pistol: MAX_WEAPON_UPGRADE_LEVEL } };
    expect(purchaseWeaponUpgrade(profile, "pistol")).toBeNull();
  });
});

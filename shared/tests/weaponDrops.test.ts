import { describe, expect, it } from "vitest";
import { WEAPON_DROP_CHANCE } from "../src/constants";
import { findTouchedPickup, rollWeaponDrop, spawnWeaponPickup } from "../src/systems/weaponDrops";
import { DROPPABLE_WEAPON_IDS } from "../src/systems/weapons";
import { makePlayer } from "./testHelpers";

describe("rollWeaponDrop", () => {
  it("returns null when the roll exceeds the drop chance", () => {
    const rng = () => WEAPON_DROP_CHANCE + 0.01;
    expect(rollWeaponDrop(rng)).toBeNull();
  });

  it("returns a droppable weapon id when the roll is within the drop chance", () => {
    // First rng() call gates the drop chance, second picks which weapon.
    let call = 0;
    const rng = () => (call++ === 0 ? 0 : 0.5);
    const result = rollWeaponDrop(rng);
    expect(result).not.toBeNull();
    expect(DROPPABLE_WEAPON_IDS).toContain(result);
  });

  it("never drops the pistol (pickup-locked, not in the droppable pool)", () => {
    expect(DROPPABLE_WEAPON_IDS).not.toContain("pistol");
  });
});

describe("spawnWeaponPickup", () => {
  it("copies the given position rather than aliasing it", () => {
    const source = { x: 10, y: 20 };
    const pickup = spawnWeaponPickup(1, "shotgun", source);
    source.x = 999;
    expect(pickup.position.x).toBe(10);
  });
});

describe("findTouchedPickup", () => {
  it("returns the pickup the player is overlapping", () => {
    const pickup = spawnWeaponPickup(1, "shotgun", { x: 0, y: 0 });
    const player = makePlayer({ position: { x: 0, y: 0 } });
    expect(findTouchedPickup([pickup], player)).toBe(pickup);
  });

  it("returns null when no pickup overlaps the player", () => {
    const pickup = spawnWeaponPickup(1, "shotgun", { x: 1000, y: 1000 });
    const player = makePlayer({ position: { x: 0, y: 0 } });
    expect(findTouchedPickup([pickup], player)).toBeNull();
  });
});

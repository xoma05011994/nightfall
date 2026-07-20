import { describe, expect, it } from "vitest";
import { CHEST_GOLD_MAX, CHEST_GOLD_MIN, CHEST_XP_AMOUNT } from "../src/constants";
import { findTouchedChest, rollChestReward, spawnChest } from "../src/systems/chests";
import { makePlayer } from "./testHelpers";

describe("spawnChest", () => {
  it("copies the given position rather than aliasing it", () => {
    const source = { x: 5, y: 9 };
    const chest = spawnChest(1, source);
    source.x = 999;
    expect(chest.position.x).toBe(5);
  });
});

describe("rollChestReward", () => {
  it("returns a gold reward within the configured range for the low third of the roll", () => {
    const reward = rollChestReward(() => 0);
    expect(reward.type).toBe("gold");
    expect(reward.amount).toBeGreaterThanOrEqual(CHEST_GOLD_MIN);
    expect(reward.amount).toBeLessThanOrEqual(CHEST_GOLD_MAX);
  });

  it("returns an xp reward for the middle third of the roll", () => {
    const reward = rollChestReward(() => 0.5);
    expect(reward.type).toBe("xp");
    expect(reward.amount).toBe(CHEST_XP_AMOUNT);
  });

  it("returns a perk reward for the high third of the roll", () => {
    const reward = rollChestReward(() => 0.9);
    expect(reward.type).toBe("perk");
  });
});

describe("findTouchedChest", () => {
  it("returns the chest the player is overlapping", () => {
    const chest = spawnChest(1, { x: 0, y: 0 });
    const player = makePlayer({ position: { x: 0, y: 0 } });
    expect(findTouchedChest([chest], player)).toBe(chest);
  });

  it("returns null when no chest overlaps the player", () => {
    const chest = spawnChest(1, { x: 1000, y: 1000 });
    const player = makePlayer({ position: { x: 0, y: 0 } });
    expect(findTouchedChest([chest], player)).toBeNull();
  });
});

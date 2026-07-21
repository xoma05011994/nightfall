import { describe, expect, it } from "vitest";
import { grantXp, xpToNextForLevel } from "../src/systems/xp";
import { makePlayer } from "./testHelpers";

describe("xpToNextForLevel", () => {
  it("increases monotonically with level", () => {
    for (let level = 1; level < 20; level++) {
      expect(xpToNextForLevel(level + 1)).toBeGreaterThan(xpToNextForLevel(level));
    }
  });
});

describe("grantXp", () => {
  it("accumulates xp without leveling up when below the threshold", () => {
    const player = makePlayer({ xpToNext: 20 });
    const result = grantXp(player, 5);
    expect(result.leveledUp).toBe(false);
    expect(result.levelsGained).toBe(0);
    expect(player.xp).toBe(5);
    expect(player.level).toBe(1);
  });

  it("levels up exactly once when xp meets the threshold", () => {
    const player = makePlayer({ xpToNext: 20 });
    const result = grantXp(player, 20);
    expect(result.leveledUp).toBe(true);
    expect(result.levelsGained).toBe(1);
    expect(player.level).toBe(2);
    expect(player.xp).toBe(0);
    expect(player.xpToNext).toBe(xpToNextForLevel(2));
  });

  it("handles multi-level jumps from a single large grant", () => {
    const player = makePlayer({ xpToNext: xpToNextForLevel(1) });
    const result = grantXp(player, 10_000);
    expect(result.levelsGained).toBeGreaterThan(1);
    expect(player.level).toBe(1 + result.levelsGained);
    expect(player.xp).toBeLessThan(player.xpToNext);
    expect(player.xp).toBeGreaterThanOrEqual(0);
  });
});

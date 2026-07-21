import { describe, expect, it } from "vitest";
import { LEVELS, getLevelById } from "../src/systems/levels";

describe("LEVELS", () => {
  it("has exactly 10 pre-generated levels", () => {
    expect(LEVELS).toHaveLength(10);
  });

  it("has unique ids and unique seeds", () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(10);
    expect(new Set(LEVELS.map((l) => l.seed)).size).toBe(10);
  });

  it("every level has a name and a palette", () => {
    for (const level of LEVELS) {
      expect(level.name.length).toBeGreaterThan(0);
      expect(level.palette.bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(level.palette.fence).toMatch(/^#[0-9a-f]{6}$/i);
      expect(level.palette.splatterRGB).toMatch(/^\d+, \d+, \d+$/);
    }
  });
});

describe("getLevelById", () => {
  it("finds a level by its id", () => {
    expect(getLevelById("blood-marsh")?.name).toBe("Blood Marsh");
  });

  it("returns undefined for an unknown id", () => {
    expect(getLevelById("does-not-exist")).toBeUndefined();
  });
});

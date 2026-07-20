import { describe, expect, it } from "vitest";
import { WORLD_HALF_SIZE } from "../src/constants";
import { clampToWorldBounds } from "../src/systems/world";

describe("clampToWorldBounds", () => {
  it("leaves positions inside the bounds untouched", () => {
    const pos = clampToWorldBounds({ x: 10, y: -20 });
    expect(pos).toEqual({ x: 10, y: -20 });
  });

  it("clamps positions past the edge back to the boundary", () => {
    const pos = clampToWorldBounds({ x: WORLD_HALF_SIZE + 500, y: -WORLD_HALF_SIZE - 500 });
    expect(pos.x).toBe(WORLD_HALF_SIZE);
    expect(pos.y).toBe(-WORLD_HALF_SIZE);
  });

  it("applies an inward margin (e.g. entity radius) when given", () => {
    const pos = clampToWorldBounds({ x: WORLD_HALF_SIZE + 500, y: 0 }, 20);
    expect(pos.x).toBe(WORLD_HALF_SIZE - 20);
  });
});

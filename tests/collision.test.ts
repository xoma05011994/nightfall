import { describe, expect, it } from "vitest";
import { circlesOverlap } from "../src/systems/collision";

describe("circlesOverlap", () => {
  it("returns true when circles overlap", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 5, { x: 6, y: 0 }, 5)).toBe(true);
  });

  it("returns true when circles exactly touch", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 5, { x: 10, y: 0 }, 5)).toBe(true);
  });

  it("returns false when circles are far apart", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 5, { x: 100, y: 0 }, 5)).toBe(false);
  });

  it("works on the diagonal, not just axis-aligned", () => {
    expect(circlesOverlap({ x: 0, y: 0 }, 3, { x: 3, y: 4 }, 3)).toBe(true);
    expect(circlesOverlap({ x: 0, y: 0 }, 2, { x: 3, y: 4 }, 2)).toBe(false);
  });
});

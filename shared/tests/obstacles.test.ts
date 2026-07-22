import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/math";
import { OBSTACLE_COUNT, OBSTACLE_MIN_DIST_FROM_ORIGIN, OBSTACLE_MIN_SPACING } from "../src/constants";
import { generateObstacles, resolvePlayerObstacleCollision } from "../src/systems/obstacles";

describe("generateObstacles", () => {
  it("generates OBSTACLE_COUNT obstacles with a typical seed", () => {
    const obstacles = generateObstacles(mulberry32(1));
    expect(obstacles.length).toBe(OBSTACLE_COUNT);
  });

  it("keeps every obstacle at least OBSTACLE_MIN_DIST_FROM_ORIGIN away from the spawn point", () => {
    const obstacles = generateObstacles(mulberry32(42));
    for (const o of obstacles) {
      expect(Math.hypot(o.position.x, o.position.y)).toBeGreaterThanOrEqual(OBSTACLE_MIN_DIST_FROM_ORIGIN);
    }
  });

  it("keeps obstacles spaced apart from each other by at least OBSTACLE_MIN_SPACING", () => {
    const obstacles = generateObstacles(mulberry32(7));
    for (let i = 0; i < obstacles.length; i++) {
      for (let j = i + 1; j < obstacles.length; j++) {
        const a = obstacles[i]!;
        const b = obstacles[j]!;
        const dist = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
        expect(dist).toBeGreaterThanOrEqual(a.radius + b.radius + OBSTACLE_MIN_SPACING - 1e-6);
      }
    }
  });

  it("is deterministic for a given rng seed", () => {
    const a = generateObstacles(mulberry32(99));
    const b = generateObstacles(mulberry32(99));
    expect(a).toEqual(b);
  });

  it("assigns unique ids", () => {
    const obstacles = generateObstacles(mulberry32(5));
    expect(new Set(obstacles.map((o) => o.id)).size).toBe(obstacles.length);
  });
});

describe("resolvePlayerObstacleCollision", () => {
  it("leaves a position untouched when it doesn't overlap any obstacle", () => {
    const obstacles = [{ id: 1, kind: "tree" as const, position: { x: 500, y: 500 }, radius: 30 }];
    const pos = resolvePlayerObstacleCollision({ x: 0, y: 0 }, 20, obstacles);
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it("pushes an overlapping position out to exactly touching distance", () => {
    const obstacles = [{ id: 1, kind: "tree" as const, position: { x: 0, y: 0 }, radius: 30 }];
    const pos = resolvePlayerObstacleCollision({ x: 10, y: 0 }, 20, obstacles); // 10 < 30+20, overlapping
    expect(pos.x).toBeCloseTo(50, 5); // pushed out along +x to radius sum
    expect(pos.y).toBeCloseTo(0, 5);
  });

  it("resolves against multiple overlapping obstacles in sequence", () => {
    const obstacles = [
      { id: 1, kind: "tree" as const, position: { x: 0, y: 0 }, radius: 30 },
      { id: 2, kind: "hole" as const, position: { x: 100, y: 0 }, radius: 30 },
    ];
    // Starts overlapping the first; resolving it may or may not push into
    // the second, but the result must not overlap either afterward.
    const pos = resolvePlayerObstacleCollision({ x: 5, y: 0 }, 20, obstacles);
    for (const o of obstacles) {
      const dist = Math.hypot(pos.x - o.position.x, pos.y - o.position.y);
      expect(dist).toBeGreaterThanOrEqual(o.radius + 20 - 1e-6);
    }
  });
});

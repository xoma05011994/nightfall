import { describe, expect, it } from "vitest";
import { SPAWN_INITIAL_INTERVAL_MS, SPAWN_MIN_INTERVAL_MS, SPAWN_RADIUS, SPAWN_RAMP_MS } from "../src/constants";
import { createEnemy, currentSpawnIntervalMs, enemyStatScale, spawnPositionAround } from "../src/systems/spawner";

describe("currentSpawnIntervalMs", () => {
  it("starts at the initial interval when no time has elapsed", () => {
    expect(currentSpawnIntervalMs(0)).toBe(SPAWN_INITIAL_INTERVAL_MS);
  });

  it("reaches the minimum interval once the ramp period has passed", () => {
    expect(currentSpawnIntervalMs(SPAWN_RAMP_MS)).toBe(SPAWN_MIN_INTERVAL_MS);
  });

  it("never goes below the minimum, even well past the ramp period", () => {
    expect(currentSpawnIntervalMs(SPAWN_RAMP_MS * 10)).toBe(SPAWN_MIN_INTERVAL_MS);
  });

  it("decreases monotonically during the ramp", () => {
    const early = currentSpawnIntervalMs(SPAWN_RAMP_MS * 0.25);
    const late = currentSpawnIntervalMs(SPAWN_RAMP_MS * 0.75);
    expect(late).toBeLessThan(early);
  });
});

describe("spawnPositionAround", () => {
  it("places the enemy exactly SPAWN_RADIUS away from the player", () => {
    const playerPos = { x: 100, y: -50 };
    const rng = () => 0.37;
    const pos = spawnPositionAround(playerPos, rng);
    const dx = pos.x - playerPos.x;
    const dy = pos.y - playerPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    expect(dist).toBeCloseTo(SPAWN_RADIUS, 5);
  });

  it("varies position with different rng outputs", () => {
    const playerPos = { x: 0, y: 0 };
    const posA = spawnPositionAround(playerPos, () => 0);
    const posB = spawnPositionAround(playerPos, () => 0.5);
    expect(posA).not.toEqual(posB);
  });
});

describe("enemyStatScale", () => {
  it("is 1 at the start of the run", () => {
    expect(enemyStatScale(0)).toBe(1);
  });

  it("increases over elapsed time", () => {
    expect(enemyStatScale(60_000)).toBeGreaterThan(enemyStatScale(0));
  });
});

describe("createEnemy", () => {
  it("scales hp/damage up with elapsed time while keeping hp === maxHp", () => {
    const early = createEnemy(1, { x: 0, y: 0 }, 0);
    const late = createEnemy(2, { x: 0, y: 0 }, 240_000);
    expect(early.hp).toBe(early.maxHp);
    expect(late.hp).toBeGreaterThan(early.hp);
  });
});

import { describe, expect, it } from "vitest";
import { CHAIN_LINK_HIT_WIDTH } from "../src/constants";
import { stepChainLink } from "../src/systems/chainLink";
import type { LightningEffect } from "../src/types";
import { makeEnemy } from "./testHelpers";

describe("stepChainLink", () => {
  it("does nothing when damagePerTick is 0", () => {
    const enemy = makeEnemy({ position: { x: 50, y: 0 }, hp: 100 });
    stepChainLink(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      0,
      [enemy],
      [],
      0,
    );
    expect(enemy.hp).toBe(100);
  });

  it("does nothing with fewer than 2 player positions", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 100 });
    stepChainLink([{ x: 0, y: 0 }], 10, [enemy], [], 0);
    expect(enemy.hp).toBe(100);
  });

  it("damages an enemy sitting directly on the segment between two players", () => {
    const enemy = makeEnemy({ position: { x: 50, y: 0 }, hp: 100 });
    stepChainLink(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      15,
      [enemy],
      [],
      0,
    );
    expect(enemy.hp).toBe(85);
  });

  it("leaves an enemy alone once it's farther than the hit width from the segment", () => {
    const enemy = makeEnemy({ position: { x: 50, y: CHAIN_LINK_HIT_WIDTH + enemyRadiusBuffer }, hp: 100 });
    stepChainLink(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      15,
      [enemy],
      [],
      0,
    );
    expect(enemy.hp).toBe(100);
  });

  it("leaves an enemy alone when it's outside the segment's endpoints, not just off to the side", () => {
    const enemy = makeEnemy({ position: { x: 200, y: 0 }, hp: 100 });
    stepChainLink(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      15,
      [enemy],
      [],
      0,
    );
    expect(enemy.hp).toBe(100);
  });

  it("only damages an enemy caught between two segments once, not once per segment", () => {
    const enemy = makeEnemy({ position: { x: 100, y: 0 }, hp: 100 });
    stepChainLink(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
      ],
      15,
      [enemy],
      [],
      0,
    );
    expect(enemy.hp).toBe(85);
  });

  it("pushes one lightning visual effect per segment, whether or not it hit anything", () => {
    const lightningEffects: LightningEffect[] = [];
    stepChainLink(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 200, y: 0 },
      ],
      15,
      [],
      lightningEffects,
      1000,
    );
    expect(lightningEffects).toHaveLength(2);
  });
});

// Enemy radius defaults to 14 in makeEnemy — pad past the hit width plus
// that radius so the "too far" case is unambiguous.
const enemyRadiusBuffer = 20;

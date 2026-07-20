import { describe, expect, it } from "vitest";
import { PERKS, getPerkById, rollPerkOffers } from "../src/systems/perks";
import { xpToNextForLevel } from "../src/systems/xp";
import type { Player } from "../src/types";

function makePlayer(): Player {
  return {
    position: { x: 0, y: 0 },
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: xpToNextForLevel(1),
    moveSpeed: 200,
    damage: 10,
    attackCooldownMs: 500,
    attackTimerMs: 0,
    attackRange: 200,
    projectileCount: 1,
    radius: 14,
    pickupRadius: 90,
  };
}

describe("PERKS", () => {
  it("has exactly 5 perks with unique ids", () => {
    expect(PERKS).toHaveLength(5);
    expect(new Set(PERKS.map((p) => p.id)).size).toBe(5);
  });

  it("damage perk increases damage by 25%", () => {
    const player = makePlayer();
    getPerkById("damage")!.apply(player);
    expect(player.damage).toBeCloseTo(12.5, 5);
  });

  it("firerate perk reduces attack cooldown by 20%", () => {
    const player = makePlayer();
    getPerkById("firerate")!.apply(player);
    expect(player.attackCooldownMs).toBeCloseTo(400, 5);
  });

  it("maxhp perk increases both max hp and current hp by 20", () => {
    const player = makePlayer();
    player.hp = 50;
    getPerkById("maxhp")!.apply(player);
    expect(player.maxHp).toBe(120);
    expect(player.hp).toBe(70);
  });

  it("speed perk increases move speed by 15%", () => {
    const player = makePlayer();
    getPerkById("speed")!.apply(player);
    expect(player.moveSpeed).toBeCloseTo(230, 5);
  });

  it("multishot perk adds one projectile", () => {
    const player = makePlayer();
    getPerkById("multishot")!.apply(player);
    expect(player.projectileCount).toBe(2);
  });
});

describe("rollPerkOffers", () => {
  it("returns the requested count of distinct perks", () => {
    const offers = rollPerkOffers(() => 0.5, 3);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((p) => p.id)).size).toBe(3);
  });

  it("never offers more perks than exist in the pool", () => {
    const offers = rollPerkOffers(() => 0.9, 10);
    expect(offers).toHaveLength(PERKS.length);
  });
});

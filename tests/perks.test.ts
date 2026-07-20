import { describe, expect, it } from "vitest";
import { PERKS, getPerkById, rollPerkOffers } from "../src/systems/perks";
import { makePlayer } from "./testHelpers";

describe("PERKS", () => {
  it("has exactly 9 perks with unique ids", () => {
    expect(PERKS).toHaveLength(9);
    expect(new Set(PERKS.map((p) => p.id)).size).toBe(9);
  });

  it("damage perk multiplies damageMultiplier by 1.25", () => {
    const player = makePlayer();
    getPerkById("damage")!.apply(player);
    expect(player.damageMultiplier).toBeCloseTo(1.25, 5);
  });

  it("firerate perk multiplies attackCooldownMultiplier by 0.8", () => {
    const player = makePlayer();
    getPerkById("firerate")!.apply(player);
    expect(player.attackCooldownMultiplier).toBeCloseTo(0.8, 5);
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

  it("multishot perk adds one extra projectile", () => {
    const player = makePlayer();
    getPerkById("multishot")!.apply(player);
    expect(player.extraProjectiles).toBe(1);
  });

  it("pierce perk adds one pierce charge", () => {
    const player = makePlayer();
    getPerkById("pierce")!.apply(player);
    expect(player.pierce).toBe(1);
  });

  it("ignite perk sets burn damage and a fixed duration", () => {
    const player = makePlayer();
    getPerkById("ignite")!.apply(player);
    expect(player.igniteDamagePerTick).toBe(4);
    expect(player.igniteDurationMs).toBe(3000);
  });

  it("ignite perk increases damage further on repeat picks without extending duration", () => {
    const player = makePlayer();
    getPerkById("ignite")!.apply(player);
    getPerkById("ignite")!.apply(player);
    expect(player.igniteDamagePerTick).toBe(8);
    expect(player.igniteDurationMs).toBe(3000);
  });

  it("lightning perk sets chain damage and radius", () => {
    const player = makePlayer();
    getPerkById("lightning")!.apply(player);
    expect(player.lightningChainDamage).toBe(10);
    expect(player.lightningChainRadius).toBe(180);
  });

  it("aura perk sets damage and radius, using the larger radius on repeat picks", () => {
    const player = makePlayer();
    getPerkById("aura")!.apply(player);
    getPerkById("aura")!.apply(player);
    expect(player.auraDamagePerTick).toBe(12);
    expect(player.auraRadius).toBe(110);
  });

  it("perks stack multiplicatively when applied repeatedly", () => {
    const player = makePlayer();
    getPerkById("damage")!.apply(player);
    getPerkById("damage")!.apply(player);
    expect(player.damageMultiplier).toBeCloseTo(1.5625, 5);
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

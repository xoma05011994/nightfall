import { describe, expect, it } from "vitest";
import { PERK_MAX_RANK } from "../src/constants";
import { PERKS, getPerkById, perkTier, rollPerkOffers } from "../src/systems/perks";
import { makePlayer } from "./testHelpers";

describe("PERKS", () => {
  it("has exactly 18 perks with unique ids", () => {
    expect(PERKS).toHaveLength(18);
    expect(new Set(PERKS.map((p) => p.id)).size).toBe(18);
  });

  it("every perk has a non-empty icon", () => {
    for (const perk of PERKS) {
      expect(perk.icon.length).toBeGreaterThan(0);
    }
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

  it("vampiric perk adds life steal, stacking additively", () => {
    const player = makePlayer();
    getPerkById("vampiric")!.apply(player);
    getPerkById("vampiric")!.apply(player);
    expect(player.lifeStealPercent).toBeCloseTo(0.16, 5);
  });

  it("berserker perk adds to the low-hp damage bonus", () => {
    const player = makePlayer();
    getPerkById("berserker")!.apply(player);
    expect(player.berserkerIntensity).toBeCloseTo(0.25, 5);
  });

  it("momentum perk adds to the per-stack fire-rate bonus", () => {
    const player = makePlayer();
    getPerkById("momentum")!.apply(player);
    expect(player.momentumFireRatePerStack).toBeCloseTo(0.03, 5);
  });

  it("wildfire perk sets auraAppliesIgnite", () => {
    const player = makePlayer();
    getPerkById("wildfire")!.apply(player);
    expect(player.auraAppliesIgnite).toBe(true);
  });

  it("overload perk sets auraTriggersLightning", () => {
    const player = makePlayer();
    getPerkById("overload")!.apply(player);
    expect(player.auraTriggersLightning).toBe(true);
  });

  it("greed perk increases pickup radius and gold multiplier", () => {
    const player = makePlayer();
    const before = player.pickupRadius;
    getPerkById("greed")!.apply(player);
    expect(player.pickupRadius).toBeCloseTo(before * 1.3, 5);
    expect(player.goldMultiplier).toBeCloseTo(1.2, 5);
  });

  it("perks stack multiplicatively when applied repeatedly", () => {
    const player = makePlayer();
    getPerkById("damage")!.apply(player);
    getPerkById("damage")!.apply(player);
    expect(player.damageMultiplier).toBeCloseTo(1.5625, 5);
  });

  it("storm conduit perk boosts chain lightning damage and radius further", () => {
    const player = makePlayer();
    getPerkById("lightning")!.apply(player);
    getPerkById("stormConduit")!.apply(player);
    expect(player.lightningChainDamage).toBe(24);
    expect(player.lightningChainRadius).toBe(240);
  });

  it("wildfire and overload require Deadly Aura plus their elemental partner (both are inert without Aura)", () => {
    expect(getPerkById("wildfire")!.requires).toEqual(["aura", "ignite"]);
    expect(getPerkById("overload")!.requires).toEqual(["aura", "lightning"]);
    expect(getPerkById("stormConduit")!.requires).toEqual(["ignite", "lightning"]);
  });

  it("chainLink perk increases chainLinkDamagePerTick and requires a party of 2+", () => {
    const player = makePlayer();
    getPerkById("chainLink")!.apply(player);
    expect(player.chainLinkDamagePerTick).toBe(8);
    expect(getPerkById("chainLink")!.minPartySize).toBe(2);
  });

  it("revive perk is gated on a 2+ party AND a downed teammate, and buffs the picker's stats not at all", () => {
    const revive = getPerkById("revive")!;
    expect(revive.minPartySize).toBe(2);
    expect(revive.requiresDeadTeammate).toBe(true);
    const before = makePlayer();
    const after = makePlayer();
    revive.apply(after);
    expect(after).toEqual(before); // apply is a no-op — the revive happens server-side
  });
});

describe("rollPerkOffers", () => {
  it("returns the requested count of distinct perks", () => {
    const offers = rollPerkOffers(() => 0.5, [], 3);
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((p) => p.id)).size).toBe(3);
  });

  it("never offers more perks than are eligible in the pool", () => {
    // With nothing picked yet and no default party size (solo), Wildfire/
    // Overload/Storm Conduit are gated by unmet prerequisites and Chain
    // Link is gated by minPartySize, so the eligible pool is smaller than
    // PERKS.length.
    const gatedCount = PERKS.filter((p) => (p.requires && p.requires.length > 0) || (p.minPartySize ?? 1) > 1).length;
    const offers = rollPerkOffers(() => 0.9, [], PERKS.length + 10);
    expect(offers).toHaveLength(PERKS.length - gatedCount);
  });

  it("excludes a perk whose prerequisites aren't met yet", () => {
    const offers = rollPerkOffers(() => 0.9, [], PERKS.length + 10);
    expect(offers.some((p) => p.id === "wildfire")).toBe(false);
    expect(offers.some((p) => p.id === "overload")).toBe(false);
    expect(offers.some((p) => p.id === "stormConduit")).toBe(false);
  });

  it("still gates a perk that has only one of its two prerequisites", () => {
    const picked = [{ perk: getPerkById("ignite")!, count: 1 }];
    const offers = rollPerkOffers(() => 0.9, picked, PERKS.length + 10);
    expect(offers.some((p) => p.id === "wildfire")).toBe(false);
    expect(offers.some((p) => p.id === "overload")).toBe(false);
    expect(offers.some((p) => p.id === "stormConduit")).toBe(false);
  });

  it("offers a gated perk once all of its prerequisites are picked", () => {
    const picked = [
      { perk: getPerkById("aura")!, count: 1 },
      { perk: getPerkById("ignite")!, count: 1 },
    ];
    const offers = rollPerkOffers(() => 0.9, picked, PERKS.length + 10);
    expect(offers.some((p) => p.id === "wildfire")).toBe(true);
    expect(offers.some((p) => p.id === "overload")).toBe(false);
  });

  it("excludes a perk that's already at max rank", () => {
    const picked = [{ perk: getPerkById("damage")!, count: PERK_MAX_RANK }];
    const offers = rollPerkOffers(() => 0.9, picked, PERKS.length + 10);
    expect(offers.some((p) => p.id === "damage")).toBe(false);
  });

  it("excludes Chain Link when partySize is omitted (solo defaults to 1)", () => {
    const offers = rollPerkOffers(() => 0.9, [], PERKS.length + 10);
    expect(offers.some((p) => p.id === "chainLink")).toBe(false);
  });

  it("excludes Chain Link for a party of exactly 1", () => {
    const offers = rollPerkOffers(() => 0.9, [], PERKS.length + 10, 1);
    expect(offers.some((p) => p.id === "chainLink")).toBe(false);
  });

  it("offers Chain Link once the party has 2 or more connected players", () => {
    const offers = rollPerkOffers(() => 0.9, [], PERKS.length + 10, 2);
    expect(offers.some((p) => p.id === "chainLink")).toBe(true);
  });

  it("excludes Revive when no teammate is downed, even in a 2+ party", () => {
    const offers = rollPerkOffers(() => 0.9, [], PERKS.length + 10, 2, false);
    expect(offers.some((p) => p.id === "revive")).toBe(false);
  });

  it("excludes Revive solo even if a (nonexistent) teammate were flagged down", () => {
    const offers = rollPerkOffers(() => 0.9, [], PERKS.length + 10, 1, true);
    expect(offers.some((p) => p.id === "revive")).toBe(false);
  });

  it("offers Revive when a teammate is downed in a 2+ party", () => {
    const offers = rollPerkOffers(() => 0.9, [], PERKS.length + 10, 2, true);
    expect(offers.some((p) => p.id === "revive")).toBe(true);
  });
});

describe("perkTier", () => {
  it("is 0 for a perk with no prerequisites", () => {
    expect(perkTier("damage")).toBe(0);
    expect(perkTier("ignite")).toBe(0);
    expect(perkTier("lightning")).toBe(0);
    expect(perkTier("aura")).toBe(0);
  });

  it("is 1 for a perk with only tier-0 prerequisites", () => {
    expect(perkTier("stormConduit")).toBe(1); // requires ignite + lightning, both tier 0
  });

  it("is 1 for wildfire/overload (requires tier-0 aura plus a tier-0 elemental)", () => {
    expect(perkTier("wildfire")).toBe(1);
    expect(perkTier("overload")).toBe(1);
  });
});

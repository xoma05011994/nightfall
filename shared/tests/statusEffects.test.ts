import { describe, expect, it } from "vitest";
import { IGNITE_TICK_MS, METEOR_STRIKE_RANGE, METEOR_TICK_MS, SHIELD_REGEN_DELAY_MS, SHIELD_REGEN_PER_SEC, THUNDER_RANGE, THUNDER_TICK_MS } from "../src/constants";
import {
  absorbShieldDamage,
  applyLifeSteal,
  applyOnHitEffects,
  shurikenAngle,
  stepAura,
  stepBurningEnemies,
  stepMeteorStrike,
  stepShieldRegen,
  stepShurikens,
  stepThunder,
} from "../src/systems/statusEffects";
import { SHURIKEN_ORBIT_RADIUS, SHURIKEN_TICK_MS } from "../src/constants";
import type { MeteorEffect } from "../src/types";
import { makeEnemy, makePlayer } from "./testHelpers";

// Fixed-sequence stand-in for () => number so meteor/thunder tests are
// deterministic instead of depending on Math.random.
function fixedRng(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("applyLifeSteal", () => {
  it("does nothing when the player has no life steal", () => {
    const player = makePlayer({ hp: 50, maxHp: 100 });
    applyLifeSteal(player, 30);
    expect(player.hp).toBe(50);
  });

  it("heals a fraction of the damage dealt", () => {
    const player = makePlayer({ hp: 50, maxHp: 100, lifeStealPercent: 0.5 });
    applyLifeSteal(player, 20);
    expect(player.hp).toBe(60);
  });

  it("never heals past maxHp", () => {
    const player = makePlayer({ hp: 95, maxHp: 100, lifeStealPercent: 1 });
    applyLifeSteal(player, 50);
    expect(player.hp).toBe(100);
  });
});

describe("applyOnHitEffects", () => {
  it("does nothing when the player has neither ignite nor lightning", () => {
    const hit = makeEnemy({ id: 1, hp: 100 });
    const other = makeEnemy({ id: 2, position: { x: 10, y: 0 }, hp: 100 });
    applyOnHitEffects(makePlayer(), [hit, other], hit, [], 0);
    expect(hit.burnDamagePerTick).toBe(0);
    expect(other.hp).toBe(100);
  });

  it("applies burn status to the hit enemy when ignite is active", () => {
    const hit = makeEnemy({ id: 1, hp: 100 });
    const player = makePlayer({ igniteDamagePerTick: 5, igniteDurationMs: 1500 });
    applyOnHitEffects(player, [hit], hit, [], 0);
    expect(hit.burnDamagePerTick).toBe(5);
    expect(hit.burnTicksRemaining).toBe(Math.ceil(1500 / IGNITE_TICK_MS));
  });

  it("chains lightning damage to the nearest other enemy within radius", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const near = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const far = makeEnemy({ id: 3, position: { x: 500, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100 });
    applyOnHitEffects(player, [hit, near, far], hit, [], 0);
    expect(near.hp).toBe(80);
    expect(far.hp).toBe(100);
  });

  it("never chains back onto the enemy that was just hit", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100 });
    applyOnHitEffects(player, [hit], hit, [], 0);
    expect(hit.hp).toBe(100);
  });

  it("doubles chain damage against an already-burning target (ignite+lightning synergy)", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const burning = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100, burnDamagePerTick: 4 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100 });
    applyOnHitEffects(player, [hit, burning], hit, [], 0);
    expect(burning.hp).toBe(60); // 100 - 40 (doubled)
  });

  it("applies life steal on the chain hit when Vampiric is active", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const near = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const player = makePlayer({ hp: 50, maxHp: 100, lightningChainDamage: 20, lightningChainRadius: 100, lifeStealPercent: 0.5 });
    applyOnHitEffects(player, [hit, near], hit, [], 0);
    expect(player.hp).toBe(60); // 50 + 20*0.5
  });

  it("pushes a lightning visual effect with an expiry after nowMs", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const near = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100 });
    const effects: import("../src/types").LightningEffect[] = [];
    applyOnHitEffects(player, [hit, near], hit, effects, 500);
    expect(effects).toHaveLength(1);
    expect(effects[0]!.expiresAtMs).toBeGreaterThan(500);
  });

  it("with a higher lightningChainCount, jumps to that many enemies in sequence without re-hitting any", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const first = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const second = makeEnemy({ id: 3, position: { x: 90, y: 0 }, hp: 100 }); // nearest to `first`, not to `hit`
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 200, lightningChainCount: 2 });
    const effects: import("../src/types").LightningEffect[] = [];
    applyOnHitEffects(player, [hit, first, second], hit, effects, 0);
    expect(first.hp).toBe(80);
    expect(second.hp).toBe(80);
    expect(hit.hp).toBe(100); // never chains back onto the original hit
    expect(effects).toHaveLength(2);
  });

  it("stops early if a chain runs out of un-hit enemies before reaching its full count", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const only = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 200, lightningChainCount: 5 });
    const effects: import("../src/types").LightningEffect[] = [];
    applyOnHitEffects(player, [hit, only], hit, effects, 0);
    expect(only.hp).toBe(80);
    expect(effects).toHaveLength(1); // nowhere left to jump to after the one other enemy
  });
});

describe("stepBurningEnemies", () => {
  it("does nothing to enemies that are not burning", () => {
    const enemy = makeEnemy({ hp: 100 });
    const dead = stepBurningEnemies(makePlayer(), [enemy], 1);
    expect(enemy.hp).toBe(100);
    expect(dead).toHaveLength(0);
  });

  it("ticks burn damage on the configured interval and counts down remaining ticks", () => {
    const enemy = makeEnemy({ hp: 100, burnDamagePerTick: 5, burnTicksRemaining: 3, burnTickTimerMs: IGNITE_TICK_MS });
    stepBurningEnemies(makePlayer(), [enemy], IGNITE_TICK_MS / 1000);
    expect(enemy.hp).toBe(95);
    expect(enemy.burnTicksRemaining).toBe(2);
  });

  it("stops burning and clears status once all ticks are consumed", () => {
    const enemy = makeEnemy({ hp: 100, burnDamagePerTick: 5, burnTicksRemaining: 1, burnTickTimerMs: IGNITE_TICK_MS });
    stepBurningEnemies(makePlayer(), [enemy], IGNITE_TICK_MS / 1000);
    expect(enemy.burnDamagePerTick).toBe(0);
    expect(enemy.burnTicksRemaining).toBe(0);
  });

  it("returns and removes enemies killed by burn damage", () => {
    const enemy = makeEnemy({ hp: 3, burnDamagePerTick: 5, burnTicksRemaining: 1, burnTickTimerMs: IGNITE_TICK_MS });
    const enemies = [enemy];
    const dead = stepBurningEnemies(makePlayer(), enemies, IGNITE_TICK_MS / 1000);
    expect(dead).toEqual([enemy]);
    expect(enemies).toHaveLength(0);
  });

  it("applies life steal on each burn tick when Vampiric is active", () => {
    const enemy = makeEnemy({ hp: 100, burnDamagePerTick: 5, burnTicksRemaining: 3, burnTickTimerMs: IGNITE_TICK_MS });
    const player = makePlayer({ hp: 50, maxHp: 100, lifeStealPercent: 0.4 });
    stepBurningEnemies(player, [enemy], IGNITE_TICK_MS / 1000);
    expect(player.hp).toBe(52); // 50 + 5*0.4
  });
});

describe("stepAura", () => {
  it("does nothing when the player has no aura", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 0 });
    stepAura(player, [enemy], 1, [], 0);
    expect(enemy.hp).toBe(100);
  });

  it("damages enemies within radius once the tick timer elapses", () => {
    const inRange = makeEnemy({ id: 1, position: { x: 10, y: 0 }, hp: 100 });
    const outOfRange = makeEnemy({ id: 2, position: { x: 500, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0 });
    stepAura(player, [inRange, outOfRange], 0.1, [], 0);
    expect(inRange.hp).toBe(94);
    expect(outOfRange.hp).toBe(100);
  });

  it("does not tick again until the interval has elapsed", () => {
    const enemy = makeEnemy({ position: { x: 10, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 1000 });
    stepAura(player, [enemy], 0.1, [], 0);
    expect(enemy.hp).toBe(100);
  });

  it("returns enemies killed by aura damage", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 2 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0 });
    const enemies = [enemy];
    const dead = stepAura(player, enemies, 0.1, [], 0);
    expect(dead).toEqual([enemy]);
    expect(enemies).toHaveLength(0);
  });

  it("applies life steal per enemy hit when Vampiric is active", () => {
    const enemies = [makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 }), makeEnemy({ id: 2, position: { x: 10, y: 0 }, hp: 100 })];
    const player = makePlayer({ position: { x: 0, y: 0 }, hp: 50, maxHp: 100, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0, lifeStealPercent: 0.5 });
    stepAura(player, enemies, 0.1, [], 0);
    expect(player.hp).toBe(56); // 50 + 3 + 3
  });

  it("Wildfire: ignites enemies it hits only when Ignite is also active", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0, auraAppliesIgnite: true, igniteDamagePerTick: 4, igniteDurationMs: 1000 });
    stepAura(player, [enemy], 0.1, [], 0);
    expect(enemy.burnDamagePerTick).toBe(4);
  });

  it("Wildfire does nothing without Ignite also picked (igniteDamagePerTick still 0)", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0, auraAppliesIgnite: true });
    stepAura(player, [enemy], 0.1, [], 0);
    expect(enemy.burnDamagePerTick).toBe(0);
  });

  it("Overload: arcs lightning to the nearest enemy just past the aura's edge when Lightning is also active", () => {
    const inAura = makeEnemy({ id: 1, position: { x: 10, y: 0 }, hp: 100 });
    const justOutside = makeEnemy({ id: 2, position: { x: 120, y: 0 }, hp: 100 });
    const player = makePlayer({
      position: { x: 0, y: 0 },
      auraDamagePerTick: 6,
      auraRadius: 100,
      auraTickTimerMs: 0,
      auraTriggersLightning: true,
      lightningChainDamage: 15,
      lightningChainRadius: 50,
    });
    stepAura(player, [inAura, justOutside], 0.1, [], 0);
    expect(justOutside.hp).toBe(85);
  });

  it("Overload does nothing without Chain Lightning also picked", () => {
    const inAura = makeEnemy({ id: 1, position: { x: 10, y: 0 }, hp: 100 });
    const justOutside = makeEnemy({ id: 2, position: { x: 120, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0, auraTriggersLightning: true });
    stepAura(player, [inAura, justOutside], 0.1, [], 0);
    expect(justOutside.hp).toBe(100);
  });
});

describe("shurikenAngle", () => {
  it("spaces blades evenly around the circle at a given instant", () => {
    const now = 1000;
    const a0 = shurikenAngle(0, 4, now);
    const a1 = shurikenAngle(1, 4, now);
    // Adjacent blades are always exactly a quarter-turn apart, regardless
    // of the shared orbit-speed term (which cancels out in the difference).
    expect(a1 - a0).toBeCloseTo(Math.PI / 2, 10);
  });

  it("defaults to a speed multiplier of 1 when omitted", () => {
    expect(shurikenAngle(0, 1, 1000)).toBeCloseTo(shurikenAngle(0, 1, 1000, 1), 10);
  });

  it("scales the orbit angle by the speed multiplier (Blade Storm)", () => {
    const base = shurikenAngle(0, 1, 1000, 1);
    const doubled = shurikenAngle(0, 1, 1000, 2);
    // Both start from the same 0-angle at index 0, so doubling speed
    // exactly doubles the accumulated angle at a given instant.
    expect(doubled).toBeCloseTo(base * 2, 10);
  });
});

describe("stepShurikens", () => {
  it("does nothing when the player has no shurikens", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, shurikenCount: 0 });
    stepShurikens(player, [enemy], 1, 0);
    expect(enemy.hp).toBe(100);
  });

  it("damages an enemy sitting on the orbit ring once the tick timer elapses", () => {
    // At nowMs=0 with count=1, shurikenAngle(0,1,0) = 0, so the blade sits
    // at (SHURIKEN_ORBIT_RADIUS, 0) relative to the player.
    const player = makePlayer({ position: { x: 0, y: 0 }, shurikenCount: 1, shurikenDamagePerTick: 7, shurikenTickTimerMs: 0 });
    const enemy = makeEnemy({ position: { x: SHURIKEN_ORBIT_RADIUS, y: 0 }, hp: 100 });
    stepShurikens(player, [enemy], 0.001, 0);
    expect(enemy.hp).toBe(93);
  });

  it("does not hit an enemy far from every blade's current position", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, shurikenCount: 1, shurikenDamagePerTick: 7, shurikenTickTimerMs: 0 });
    const enemy = makeEnemy({ position: { x: -SHURIKEN_ORBIT_RADIUS, y: 0 }, hp: 100 }); // opposite side
    stepShurikens(player, [enemy], 0.001, 0);
    expect(enemy.hp).toBe(100);
  });

  it("respects its own tick timer independent of dt", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, shurikenCount: 1, shurikenDamagePerTick: 7, shurikenTickTimerMs: SHURIKEN_TICK_MS });
    const enemy = makeEnemy({ position: { x: SHURIKEN_ORBIT_RADIUS, y: 0 }, hp: 100 });
    stepShurikens(player, [enemy], 0.001, 0); // timer still well above 0 after this small dt
    expect(enemy.hp).toBe(100);
  });
});

describe("stepAura — Vortex (auraPull)", () => {
  it("does not move enemies when auraPull is 0", () => {
    const enemy = makeEnemy({ position: { x: 50, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0, auraPull: 0 });
    stepAura(player, [enemy], 0.1, [], 0);
    expect(enemy.position).toEqual({ x: 50, y: 0 });
  });

  it("pulls an enemy hit by the aura tick toward the player, capped at the remaining distance", () => {
    const enemy = makeEnemy({ position: { x: 50, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0, auraPull: 10 });
    stepAura(player, [enemy], 0.1, [], 0);
    expect(enemy.position.x).toBeCloseTo(40, 5); // pulled 10px closer along -x
    expect(enemy.position.y).toBeCloseTo(0, 5);
  });

  it("never pulls an enemy past the player's own position", () => {
    const enemy = makeEnemy({ position: { x: 5, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0, auraPull: 50 }); // pull > distance
    stepAura(player, [enemy], 0.1, [], 0);
    expect(enemy.position.x).toBeCloseTo(0, 5);
  });
});

describe("applyOnHitEffects — Tempest (chainAlwaysIgnites)", () => {
  it("ignites every chain jump's target using Ignite's own numbers when picked", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const target = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100, chainAlwaysIgnites: true, igniteDamagePerTick: 9, igniteDurationMs: 4000 });
    applyOnHitEffects(player, [hit, target], hit, [], 0);
    expect(target.burnDamagePerTick).toBe(9);
    expect(target.burnTicksRemaining).toBe(Math.ceil(4000 / IGNITE_TICK_MS));
  });

  it("falls back to a modest baseline burn when Ignite itself hasn't been picked", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const target = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100, chainAlwaysIgnites: true });
    applyOnHitEffects(player, [hit, target], hit, [], 0);
    expect(target.burnDamagePerTick).toBeGreaterThan(0);
  });

  it("does not ignite chain targets when chainAlwaysIgnites is off", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const target = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100 });
    applyOnHitEffects(player, [hit, target], hit, [], 0);
    expect(target.burnDamagePerTick).toBe(0);
  });
});

describe("stepMeteorStrike", () => {
  it("does nothing when the player has no meteors (meteorCount 0)", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, meteorCount: 0, meteorDamage: 30 });
    stepMeteorStrike(player, [enemy], 1, 0, fixedRng(0, 1), []);
    expect(enemy.hp).toBe(100);
  });

  it("strikes an impact point, damaging enemies within blast radius and pushing one MeteorEffect", () => {
    // rng sequence (0, 1) picks angle=0, dist=METEOR_STRIKE_RANGE, landing the
    // single meteor exactly at (METEOR_STRIKE_RANGE, 0) relative to the player.
    const player = makePlayer({ position: { x: 0, y: 0 }, meteorCount: 1, meteorDamage: 30, meteorTickTimerMs: 0 });
    const enemy = makeEnemy({ position: { x: METEOR_STRIKE_RANGE, y: 0 }, hp: 100 });
    const effects: MeteorEffect[] = [];
    stepMeteorStrike(player, [enemy], 0.001, 1000, fixedRng(0, 1), effects);
    expect(enemy.hp).toBe(70);
    expect(effects).toHaveLength(1);
    expect(effects[0]!.position.x).toBeCloseTo(METEOR_STRIKE_RANGE, 5);
    expect(effects[0]!.expiresAtMs).toBeGreaterThan(1000);
  });

  it("does not damage an enemy outside every meteor's blast radius", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, meteorCount: 1, meteorDamage: 30, meteorTickTimerMs: 0 });
    const enemy = makeEnemy({ position: { x: METEOR_STRIKE_RANGE + 1000, y: 0 }, hp: 100 });
    stepMeteorStrike(player, [enemy], 0.001, 0, fixedRng(0, 1), []);
    expect(enemy.hp).toBe(100);
  });

  it("fires meteorCount independent meteors, one MeteorEffect each", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, meteorCount: 2, meteorDamage: 10, meteorTickTimerMs: 0 });
    const effects: MeteorEffect[] = [];
    stepMeteorStrike(player, [], 0.001, 0, fixedRng(0, 1), effects);
    expect(effects).toHaveLength(2);
  });

  it("respects its own tick timer independent of dt", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, meteorCount: 1, meteorDamage: 30, meteorTickTimerMs: METEOR_TICK_MS });
    const enemy = makeEnemy({ position: { x: METEOR_STRIKE_RANGE, y: 0 }, hp: 100 });
    stepMeteorStrike(player, [enemy], 0.001, 0, fixedRng(0, 1), []); // timer still well above 0
    expect(enemy.hp).toBe(100);
  });
});

describe("stepThunder", () => {
  it("does nothing when the player has no thunder (thunderDamage 0)", () => {
    const enemy = makeEnemy({ position: { x: 100, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, thunderDamage: 0 });
    stepThunder(player, [enemy], 1, 0, fixedRng(0), []);
    expect(enemy.hp).toBe(100);
  });

  it("strikes a random in-range enemy and pushes a lightning effect", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, thunderDamage: 15, thunderTickTimerMs: 0 });
    const enemy = makeEnemy({ id: 7, position: { x: 100, y: 0 }, hp: 100 });
    const effects: import("../src/types").LightningEffect[] = [];
    stepThunder(player, [enemy], 0.001, 1000, fixedRng(0), effects);
    expect(enemy.hp).toBe(85);
    expect(effects).toHaveLength(1);
    expect(effects[0]!.expiresAtMs).toBeGreaterThan(1000);
  });

  it("does not strike an enemy outside THUNDER_RANGE", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, thunderDamage: 15, thunderTickTimerMs: 0 });
    const enemy = makeEnemy({ position: { x: THUNDER_RANGE + 1000, y: 0 }, hp: 100 });
    stepThunder(player, [enemy], 0.001, 0, fixedRng(0), []);
    expect(enemy.hp).toBe(100);
  });

  it("respects its own tick timer independent of dt", () => {
    const player = makePlayer({ position: { x: 0, y: 0 }, thunderDamage: 15, thunderTickTimerMs: THUNDER_TICK_MS });
    const enemy = makeEnemy({ position: { x: 100, y: 0 }, hp: 100 });
    stepThunder(player, [enemy], 0.001, 0, fixedRng(0), []); // timer still well above 0
    expect(enemy.hp).toBe(100);
  });
});

describe("absorbShieldDamage", () => {
  it("passes damage through unchanged when there's no shield", () => {
    const player = makePlayer({ shieldMax: 0, shieldCurrent: 0 });
    expect(absorbShieldDamage(player, 20)).toBe(20);
  });

  it("fully absorbs damage when the shield has enough charge", () => {
    const player = makePlayer({ shieldMax: 50, shieldCurrent: 50 });
    expect(absorbShieldDamage(player, 20)).toBe(0);
    expect(player.shieldCurrent).toBe(30);
  });

  it("absorbs partially and returns the leftover once the shield is depleted", () => {
    const player = makePlayer({ shieldMax: 50, shieldCurrent: 15 });
    expect(absorbShieldDamage(player, 40)).toBe(25);
    expect(player.shieldCurrent).toBe(0);
  });

  it("resets the regen delay timer whenever it actually absorbs damage", () => {
    const player = makePlayer({ shieldMax: 50, shieldCurrent: 50, shieldRegenTimerMs: 0 });
    absorbShieldDamage(player, 10);
    expect(player.shieldRegenTimerMs).toBe(SHIELD_REGEN_DELAY_MS);
  });
});

describe("stepShieldRegen", () => {
  it("does nothing until the Shield perk is picked (shieldMax 0)", () => {
    const player = makePlayer({ shieldMax: 0, shieldCurrent: 0, shieldRegenTimerMs: 0 });
    stepShieldRegen(player, 1);
    expect(player.shieldCurrent).toBe(0);
  });

  it("counts down the regen delay without regenerating while it's still active", () => {
    const player = makePlayer({ shieldMax: 40, shieldCurrent: 10, shieldRegenTimerMs: 1000 });
    stepShieldRegen(player, 0.1);
    expect(player.shieldRegenTimerMs).toBeCloseTo(900, 5);
    expect(player.shieldCurrent).toBe(10);
  });

  it("regenerates at SHIELD_REGEN_PER_SEC once the delay has elapsed", () => {
    const player = makePlayer({ shieldMax: 40, shieldCurrent: 10, shieldRegenTimerMs: 0 });
    stepShieldRegen(player, 1);
    expect(player.shieldCurrent).toBeCloseTo(10 + SHIELD_REGEN_PER_SEC, 5);
  });

  it("never regenerates past shieldMax", () => {
    const player = makePlayer({ shieldMax: 40, shieldCurrent: 39, shieldRegenTimerMs: 0 });
    stepShieldRegen(player, 1);
    expect(player.shieldCurrent).toBe(40);
  });
});

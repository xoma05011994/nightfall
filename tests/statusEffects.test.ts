import { describe, expect, it } from "vitest";
import { IGNITE_TICK_MS } from "../src/constants";
import { applyOnHitEffects, stepAura, stepBurningEnemies } from "../src/systems/statusEffects";
import { makeEnemy, makePlayer } from "./testHelpers";

describe("applyOnHitEffects", () => {
  it("does nothing when the player has neither ignite nor lightning", () => {
    const hit = makeEnemy({ id: 1, hp: 100 });
    const other = makeEnemy({ id: 2, position: { x: 10, y: 0 }, hp: 100 });
    applyOnHitEffects(makePlayer(), [hit, other], hit);
    expect(hit.burnDamagePerTick).toBe(0);
    expect(other.hp).toBe(100);
  });

  it("applies burn status to the hit enemy when ignite is active", () => {
    const hit = makeEnemy({ id: 1, hp: 100 });
    const player = makePlayer({ igniteDamagePerTick: 5, igniteDurationMs: 1500 });
    applyOnHitEffects(player, [hit], hit);
    expect(hit.burnDamagePerTick).toBe(5);
    expect(hit.burnTicksRemaining).toBe(Math.ceil(1500 / IGNITE_TICK_MS));
  });

  it("chains lightning damage to the nearest other enemy within radius", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const near = makeEnemy({ id: 2, position: { x: 50, y: 0 }, hp: 100 });
    const far = makeEnemy({ id: 3, position: { x: 500, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100 });
    applyOnHitEffects(player, [hit, near, far], hit);
    expect(near.hp).toBe(80);
    expect(far.hp).toBe(100);
  });

  it("never chains back onto the enemy that was just hit", () => {
    const hit = makeEnemy({ id: 1, position: { x: 0, y: 0 }, hp: 100 });
    const player = makePlayer({ lightningChainDamage: 20, lightningChainRadius: 100 });
    applyOnHitEffects(player, [hit], hit);
    expect(hit.hp).toBe(100);
  });
});

describe("stepBurningEnemies", () => {
  it("does nothing to enemies that are not burning", () => {
    const enemy = makeEnemy({ hp: 100 });
    const dead = stepBurningEnemies([enemy], 1);
    expect(enemy.hp).toBe(100);
    expect(dead).toHaveLength(0);
  });

  it("ticks burn damage on the configured interval and counts down remaining ticks", () => {
    const enemy = makeEnemy({ hp: 100, burnDamagePerTick: 5, burnTicksRemaining: 3, burnTickTimerMs: IGNITE_TICK_MS });
    stepBurningEnemies([enemy], IGNITE_TICK_MS / 1000);
    expect(enemy.hp).toBe(95);
    expect(enemy.burnTicksRemaining).toBe(2);
  });

  it("stops burning and clears status once all ticks are consumed", () => {
    const enemy = makeEnemy({ hp: 100, burnDamagePerTick: 5, burnTicksRemaining: 1, burnTickTimerMs: IGNITE_TICK_MS });
    stepBurningEnemies([enemy], IGNITE_TICK_MS / 1000);
    expect(enemy.burnDamagePerTick).toBe(0);
    expect(enemy.burnTicksRemaining).toBe(0);
  });

  it("returns and removes enemies killed by burn damage", () => {
    const enemy = makeEnemy({ hp: 3, burnDamagePerTick: 5, burnTicksRemaining: 1, burnTickTimerMs: IGNITE_TICK_MS });
    const enemies = [enemy];
    const dead = stepBurningEnemies(enemies, IGNITE_TICK_MS / 1000);
    expect(dead).toEqual([enemy]);
    expect(enemies).toHaveLength(0);
  });
});

describe("stepAura", () => {
  it("does nothing when the player has no aura", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 0 });
    stepAura(player, [enemy], 1);
    expect(enemy.hp).toBe(100);
  });

  it("damages enemies within radius once the tick timer elapses", () => {
    const inRange = makeEnemy({ id: 1, position: { x: 10, y: 0 }, hp: 100 });
    const outOfRange = makeEnemy({ id: 2, position: { x: 500, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0 });
    stepAura(player, [inRange, outOfRange], 0.1);
    expect(inRange.hp).toBe(94);
    expect(outOfRange.hp).toBe(100);
  });

  it("does not tick again until the interval has elapsed", () => {
    const enemy = makeEnemy({ position: { x: 10, y: 0 }, hp: 100 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 1000 });
    stepAura(player, [enemy], 0.1);
    expect(enemy.hp).toBe(100);
  });

  it("returns enemies killed by aura damage", () => {
    const enemy = makeEnemy({ position: { x: 0, y: 0 }, hp: 2 });
    const player = makePlayer({ position: { x: 0, y: 0 }, auraDamagePerTick: 6, auraRadius: 100, auraTickTimerMs: 0 });
    const enemies = [enemy];
    const dead = stepAura(player, enemies, 0.1);
    expect(dead).toEqual([enemy]);
    expect(enemies).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { WEAPON_DEFS, canFire, createWeaponInstance, fireWeapon, startReload, stepWeaponInstance } from "../src/systems/weapons";
import type { BeamEffect, ConeEffect, Enemy, Projectile } from "../src/types";
import { makeEnemy, makePlayer } from "./testHelpers";

function makeCtx(enemies: Enemy[] = []) {
  return {
    projectiles: [] as Projectile[],
    beamEffects: [] as BeamEffect[],
    coneEffects: [] as ConeEffect[],
    enemies,
    nextProjectileId: 1,
  };
}

describe("createWeaponInstance", () => {
  it("starts with a full magazine and no reload in progress", () => {
    const instance = createWeaponInstance("pistol");
    expect(instance.ammo).toBe(WEAPON_DEFS.pistol.magazineSize);
    expect(instance.reloading).toBe(false);
  });
});

describe("canFire / stepWeaponInstance", () => {
  it("cannot fire while the cooldown timer is running", () => {
    const instance = createWeaponInstance("pistol");
    instance.fireTimerMs = 100;
    expect(canFire(instance)).toBe(false);
  });

  it("cannot fire while out of ammo", () => {
    const instance = createWeaponInstance("pistol");
    instance.ammo = 0;
    expect(canFire(instance)).toBe(false);
  });

  it("cannot fire while reloading", () => {
    const instance = createWeaponInstance("pistol");
    instance.reloading = true;
    expect(canFire(instance)).toBe(false);
  });

  it("counts down fireTimerMs over time", () => {
    const instance = createWeaponInstance("pistol");
    instance.fireTimerMs = 300;
    stepWeaponInstance(instance, WEAPON_DEFS.pistol, 0.1);
    expect(instance.fireTimerMs).toBeCloseTo(200, 5);
  });

  it("finishes reloading and refills the magazine once the timer elapses", () => {
    const instance = createWeaponInstance("pistol");
    instance.ammo = 0;
    startReload(instance, WEAPON_DEFS.pistol);
    expect(instance.reloading).toBe(true);
    stepWeaponInstance(instance, WEAPON_DEFS.pistol, WEAPON_DEFS.pistol.reloadMs / 1000 + 0.01);
    expect(instance.reloading).toBe(false);
    expect(instance.ammo).toBe(WEAPON_DEFS.pistol.magazineSize);
  });
});

describe("startReload", () => {
  it("does nothing if the magazine is already full", () => {
    const instance = createWeaponInstance("pistol");
    startReload(instance, WEAPON_DEFS.pistol);
    expect(instance.reloading).toBe(false);
  });

  it("does nothing if already reloading", () => {
    const instance = createWeaponInstance("pistol");
    instance.ammo = 0;
    startReload(instance, WEAPON_DEFS.pistol);
    const firstTimer = instance.reloadTimerMs;
    startReload(instance, WEAPON_DEFS.pistol);
    expect(instance.reloadTimerMs).toBe(firstTimer);
  });
});

describe("fireWeapon — pistol (projectile mode)", () => {
  it("consumes one round, spawns a projectile, and starts the cooldown", () => {
    const instance = createWeaponInstance("pistol");
    const player = makePlayer();
    const ctx = makeCtx();
    fireWeapon(instance, WEAPON_DEFS.pistol, player, { x: 1, y: 0 }, ctx, 0);
    expect(instance.ammo).toBe(WEAPON_DEFS.pistol.magazineSize - 1);
    expect(instance.fireTimerMs).toBeCloseTo(WEAPON_DEFS.pistol.fireCooldownMs, 5);
    expect(ctx.projectiles).toHaveLength(1);
  });

  it("auto-starts a reload the instant the magazine empties", () => {
    const instance = createWeaponInstance("pistol");
    instance.ammo = 1;
    const player = makePlayer();
    fireWeapon(instance, WEAPON_DEFS.pistol, player, { x: 1, y: 0 }, makeCtx(), 0);
    expect(instance.ammo).toBe(0);
    expect(instance.reloading).toBe(true);
  });

  it("does nothing while on cooldown", () => {
    const instance = createWeaponInstance("pistol");
    instance.fireTimerMs = 200;
    const ctx = makeCtx();
    fireWeapon(instance, WEAPON_DEFS.pistol, makePlayer(), { x: 1, y: 0 }, ctx, 0);
    expect(ctx.projectiles).toHaveLength(0);
    expect(instance.ammo).toBe(WEAPON_DEFS.pistol.magazineSize);
  });

  it("applies player damageMultiplier to the projectile's damage", () => {
    const instance = createWeaponInstance("pistol");
    const player = makePlayer({ damageMultiplier: 2 });
    const ctx = makeCtx();
    fireWeapon(instance, WEAPON_DEFS.pistol, player, { x: 1, y: 0 }, ctx, 0);
    expect(ctx.projectiles[0]!.damage).toBeCloseTo(WEAPON_DEFS.pistol.damage * 2, 5);
  });

  it("fires extra projectiles when the player has bonus projectiles from perks", () => {
    const instance = createWeaponInstance("pistol");
    const player = makePlayer({ extraProjectiles: 2 });
    const ctx = makeCtx();
    fireWeapon(instance, WEAPON_DEFS.pistol, player, { x: 1, y: 0 }, ctx, 0);
    expect(ctx.projectiles).toHaveLength(3);
  });

  it("tags projectiles with pierceRemaining when the player has the pierce perk", () => {
    const instance = createWeaponInstance("pistol");
    const player = makePlayer({ pierce: 2 });
    const ctx = makeCtx();
    fireWeapon(instance, WEAPON_DEFS.pistol, player, { x: 1, y: 0 }, ctx, 0);
    expect(ctx.projectiles[0]!.pierceRemaining).toBe(2);
  });

  it("does not set pierceRemaining when the player has no pierce", () => {
    const instance = createWeaponInstance("pistol");
    const ctx = makeCtx();
    fireWeapon(instance, WEAPON_DEFS.pistol, makePlayer(), { x: 1, y: 0 }, ctx, 0);
    expect(ctx.projectiles[0]!.pierceRemaining).toBeUndefined();
  });
});

describe("fireWeapon — shotgun (spread mode)", () => {
  it("fires pelletCount projectiles in one shot", () => {
    const instance = createWeaponInstance("shotgun");
    const ctx = makeCtx();
    fireWeapon(instance, WEAPON_DEFS.shotgun, makePlayer(), { x: 1, y: 0 }, ctx, 0);
    expect(ctx.projectiles).toHaveLength(WEAPON_DEFS.shotgun.pelletCount ?? 0);
  });
});

describe("fireWeapon — RPG (explosive mode)", () => {
  it("tags the projectile with splash radius/damage", () => {
    const instance = createWeaponInstance("rpg");
    const ctx = makeCtx();
    fireWeapon(instance, WEAPON_DEFS.rpg, makePlayer(), { x: 1, y: 0 }, ctx, 0);
    expect(ctx.projectiles[0]!.splashRadius).toBe(WEAPON_DEFS.rpg.splashRadius);
    expect(ctx.projectiles[0]!.splashDamage).toBe(WEAPON_DEFS.rpg.splashDamage);
  });
});

describe("fireWeapon — laser cannon (beam mode)", () => {
  it("instantly damages every enemy along the aim line within range", () => {
    const instance = createWeaponInstance("laserCannon");
    const inLine = makeEnemy({ id: 1, position: { x: 100, y: 0 }, hp: 100 });
    const offLine = makeEnemy({ id: 2, position: { x: 100, y: 200 }, hp: 100 });
    const ctx = makeCtx([inLine, offLine]);
    fireWeapon(instance, WEAPON_DEFS.laserCannon, makePlayer(), { x: 1, y: 0 }, ctx, 0);
    expect(inLine.hp).toBe(100 - WEAPON_DEFS.laserCannon.damage);
    expect(offLine.hp).toBe(100);
    expect(ctx.beamEffects).toHaveLength(1);
  });

  it("does not damage enemies beyond the beam's range", () => {
    const instance = createWeaponInstance("laserCannon");
    const farEnemy = makeEnemy({ position: { x: (WEAPON_DEFS.laserCannon.beamRange ?? 0) + 200, y: 0 }, hp: 100 });
    const ctx = makeCtx([farEnemy]);
    fireWeapon(instance, WEAPON_DEFS.laserCannon, makePlayer(), { x: 1, y: 0 }, ctx, 0);
    expect(farEnemy.hp).toBe(100);
  });

  it("applies ignite and lightning chain to enemies it hits", () => {
    const instance = createWeaponInstance("laserCannon");
    const hit = makeEnemy({ id: 1, position: { x: 100, y: 0 }, hp: 100, maxHp: 100 });
    // Off the beam's own line (y=60, well past its hit width) so this only
    // takes damage via the lightning chain, not a second direct beam hit.
    const chainTarget = makeEnemy({ id: 2, position: { x: 100, y: 60 }, hp: 100, maxHp: 100 });
    const ctx = makeCtx([hit, chainTarget]);
    const player = makePlayer({ igniteDamagePerTick: 5, igniteDurationMs: 1000, lightningChainDamage: 20, lightningChainRadius: 100 });
    fireWeapon(instance, WEAPON_DEFS.laserCannon, player, { x: 1, y: 0 }, ctx, 0);
    expect(hit.burnDamagePerTick).toBe(5);
    expect(chainTarget.hp).toBe(80);
  });
});

describe("fireWeapon — flamethrower (cone mode)", () => {
  it("damages enemies within the cone angle and range", () => {
    const instance = createWeaponInstance("flamethrower");
    const inCone = makeEnemy({ id: 1, position: { x: 100, y: 0 }, hp: 100 });
    const behindPlayer = makeEnemy({ id: 2, position: { x: -100, y: 0 }, hp: 100 });
    const ctx = makeCtx([inCone, behindPlayer]);
    fireWeapon(instance, WEAPON_DEFS.flamethrower, makePlayer(), { x: 1, y: 0 }, ctx, 0);
    expect(inCone.hp).toBe(100 - WEAPON_DEFS.flamethrower.damage);
    expect(behindPlayer.hp).toBe(100);
    expect(ctx.coneEffects).toHaveLength(1);
  });
});

import { PROJECTILE_RADIUS, PROJECTILE_TTL_MS } from "../constants";
import { dot, normalize, pointToRaySegmentDistance, rotate } from "../math";
import type { BeamEffect, ConeEffect, Enemy, Player, Projectile, Vec2, WeaponDef, WeaponId, WeaponInstance } from "../types";

// Six weapons: the pistol (always in slot 1, never dropped/swapped) plus 5
// pickup-only weapons covering the 5 fire modes below.
export const WEAPON_DEFS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol",
    name: "Sidearm",
    fireMode: "projectile",
    damage: 12,
    fireCooldownMs: 350,
    magazineSize: 10,
    reloadMs: 2000,
    projectileSpeed: 700,
    color: "#ffb347",
    pickupLocked: true,
  },
  shotgun: {
    id: "shotgun",
    name: "Shotgun",
    fireMode: "spread",
    damage: 8,
    fireCooldownMs: 750,
    magazineSize: 6,
    reloadMs: 2200,
    projectileSpeed: 600,
    pelletCount: 6,
    spreadRad: 0.5,
    color: "#ff8c42",
  },
  assaultRifle: {
    id: "assaultRifle",
    name: "Assault Rifle",
    fireMode: "projectile",
    damage: 7,
    fireCooldownMs: 110,
    magazineSize: 30,
    reloadMs: 1800,
    projectileSpeed: 780,
    color: "#ffd23f",
  },
  rpg: {
    id: "rpg",
    name: "RPG",
    fireMode: "explosive",
    damage: 60,
    fireCooldownMs: 900,
    magazineSize: 2,
    reloadMs: 2600,
    projectileSpeed: 380,
    splashRadius: 90,
    splashDamage: 40,
    color: "#ff3b3b",
  },
  laserCannon: {
    id: "laserCannon",
    name: "Laser Cannon",
    fireMode: "beam",
    damage: 5,
    fireCooldownMs: 80,
    magazineSize: 50,
    reloadMs: 2400,
    beamRange: 500,
    color: "#4ee2ff",
  },
  flamethrower: {
    id: "flamethrower",
    name: "Flamethrower",
    fireMode: "cone",
    damage: 4,
    fireCooldownMs: 60,
    magazineSize: 80,
    reloadMs: 2000,
    coneRange: 180,
    coneAngleRad: 0.9,
    color: "#ff6a00",
  },
};

export const DROPPABLE_WEAPON_IDS: WeaponId[] = ["shotgun", "assaultRifle", "rpg", "laserCannon", "flamethrower"];

export function createWeaponInstance(weaponId: WeaponId): WeaponInstance {
  const def = WEAPON_DEFS[weaponId];
  return { weaponId, ammo: def.magazineSize, fireTimerMs: 0, reloading: false, reloadTimerMs: 0 };
}

export function stepWeaponInstance(instance: WeaponInstance, def: WeaponDef, dt: number): void {
  if (instance.fireTimerMs > 0) instance.fireTimerMs -= dt * 1000;
  if (instance.reloading) {
    instance.reloadTimerMs -= dt * 1000;
    if (instance.reloadTimerMs <= 0) {
      instance.reloading = false;
      instance.reloadTimerMs = 0;
      instance.ammo = def.magazineSize;
    }
  }
}

export function canFire(instance: WeaponInstance): boolean {
  return !instance.reloading && instance.fireTimerMs <= 0 && instance.ammo > 0;
}

export function startReload(instance: WeaponInstance, def: WeaponDef): void {
  if (instance.reloading || instance.ammo >= def.magazineSize) return;
  instance.reloading = true;
  instance.reloadTimerMs = def.reloadMs;
}

function makeProjectile(id: number, origin: Vec2, dir: Vec2, damage: number, def: WeaponDef): Projectile {
  const speed = def.projectileSpeed ?? 600;
  return {
    id,
    position: { x: origin.x, y: origin.y },
    velocity: { x: dir.x * speed, y: dir.y * speed },
    damage,
    radius: PROJECTILE_RADIUS,
    ttlMs: PROJECTILE_TTL_MS,
    color: def.color,
  };
}

export interface FireContext {
  projectiles: Projectile[];
  beamEffects: BeamEffect[];
  coneEffects: ConeEffect[];
  enemies: Enemy[];
  nextProjectileId: number;
}

const BEAM_HIT_WIDTH = 10;

// Fires one shot/tick from `instance` if it's able to (cooldown elapsed,
// not reloading, has ammo). Applies player-level multipliers/bonuses from
// perks on top of the weapon's own base stats. Auto-starts a reload the
// moment ammo reaches zero. Returns the next free projectile id.
export function fireWeapon(instance: WeaponInstance, def: WeaponDef, player: Player, aimDir: Vec2, ctx: FireContext, nowMs: number): number {
  if (!canFire(instance)) return ctx.nextProjectileId;

  instance.fireTimerMs = def.fireCooldownMs * player.attackCooldownMultiplier;
  instance.ammo -= 1;

  const damage = def.damage * player.damageMultiplier;
  let nextId = ctx.nextProjectileId;
  const dir = normalize(aimDir);

  switch (def.fireMode) {
    case "projectile": {
      const count = 1 + player.extraProjectiles;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 0.12;
        ctx.projectiles.push(makeProjectile(nextId++, player.position, rotate(dir, offset), damage, def));
      }
      break;
    }
    case "spread": {
      const pellets = (def.pelletCount ?? 1) + player.extraProjectiles;
      const spread = def.spreadRad ?? 0.4;
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0 : i / (pellets - 1) - 0.5;
        ctx.projectiles.push(makeProjectile(nextId++, player.position, rotate(dir, t * spread), damage, def));
      }
      break;
    }
    case "explosive": {
      const projectile = makeProjectile(nextId++, player.position, dir, damage, def);
      projectile.splashRadius = def.splashRadius;
      projectile.splashDamage = (def.splashDamage ?? 0) * player.damageMultiplier;
      ctx.projectiles.push(projectile);
      break;
    }
    case "beam": {
      const range = def.beamRange ?? 400;
      for (const enemy of ctx.enemies) {
        const dist = pointToRaySegmentDistance(enemy.position, player.position, dir, range);
        if (dist !== null && dist <= enemy.radius + BEAM_HIT_WIDTH) enemy.hp -= damage;
      }
      ctx.beamEffects.push({
        from: { x: player.position.x, y: player.position.y },
        to: { x: player.position.x + dir.x * range, y: player.position.y + dir.y * range },
        expiresAtMs: nowMs + 120,
        color: def.color,
      });
      break;
    }
    case "cone": {
      const range = def.coneRange ?? 150;
      const halfAngleCos = Math.cos((def.coneAngleRad ?? 0.6) / 2);
      for (const enemy of ctx.enemies) {
        const toEnemy = { x: enemy.position.x - player.position.x, y: enemy.position.y - player.position.y };
        const dist = Math.sqrt(toEnemy.x * toEnemy.x + toEnemy.y * toEnemy.y);
        if (dist > range + enemy.radius) continue;
        const dirToEnemy = normalize(toEnemy);
        if (dot(dir, dirToEnemy) >= halfAngleCos) enemy.hp -= damage;
      }
      ctx.coneEffects.push({
        origin: { x: player.position.x, y: player.position.y },
        direction: dir,
        rangeUnits: range,
        angleRad: def.coneAngleRad ?? 0.6,
        expiresAtMs: nowMs + 100,
        color: def.color,
      });
      break;
    }
  }

  if (instance.ammo <= 0) startReload(instance, def);
  return nextId;
}

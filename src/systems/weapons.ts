import { PROJECTILE_RADIUS, PROJECTILE_TTL_MS, WEAPON_GIGA_COOLDOWN_MULT, WEAPON_GIGA_EXTRA_PIERCE, WEAPON_GIGA_PROJECTILE_SCALE, WEAPON_LEVEL_DAMAGE_PER_LEVEL, WEAPON_MAX_LEVEL } from "../constants";
import { dot, normalize, pointToRaySegmentDistance, rotate } from "../math";
import type { BeamEffect, ConeEffect, Enemy, LightningEffect, Player, Projectile, Vec2, WeaponDef, WeaponId, WeaponInstance } from "../types";
import { applyLifeSteal, applyOnHitEffects } from "./statusEffects";

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
    icon: '<rect x="9" y="3" width="4" height="10" rx="1" fill="currentColor"/><path d="M9 13 L5 13 L5 20 L9 20 Z" fill="currentColor"/><rect x="7" y="14" width="6" height="2" fill="currentColor" opacity="0.6"/>',
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
    icon: '<rect x="2" y="10" width="18" height="4" rx="1" fill="currentColor"/><rect x="17" y="6" width="5" height="12" rx="1" fill="currentColor" opacity="0.8"/><rect x="4" y="14" width="6" height="4" fill="currentColor" opacity="0.6"/>',
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
    icon: '<rect x="2" y="10" width="20" height="3" rx="1" fill="currentColor"/><rect x="9" y="13" width="3" height="7" fill="currentColor" opacity="0.8"/><rect x="4" y="7" width="6" height="3" fill="currentColor" opacity="0.6"/>',
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
    icon: '<rect x="3" y="10" width="12" height="5" rx="1" fill="currentColor"/><polygon points="15,8 22,12 15,16" fill="currentColor"/><rect x="6" y="15" width="3" height="6" fill="currentColor" opacity="0.6"/>',
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
    icon: '<polygon points="2,15 20,9 20,15 2,20" fill="currentColor"/><circle cx="16" cy="12.5" r="3" fill="currentColor" opacity="0.6"/>',
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
    icon: '<circle cx="7" cy="14" r="5" fill="currentColor" opacity="0.7"/><rect x="10" y="11" width="8" height="4" rx="1" fill="currentColor"/><polygon points="18,10 23,12.5 18,15" fill="currentColor" opacity="0.8"/>',
  },
};

// In-run weapon leveling (picking up a duplicate weapon) — separate from the
// meta-progression shop's per-run-independent upgrades, which stack
// multiplicatively on top of this.
export function weaponLevelDamageMultiplier(level: number): number {
  return 1 + Math.max(0, level - 1) * WEAPON_LEVEL_DAMAGE_PER_LEVEL;
}

export function isWeaponMaxLevel(level: number): boolean {
  return level >= WEAPON_MAX_LEVEL;
}

export const DROPPABLE_WEAPON_IDS: WeaponId[] = ["shotgun", "assaultRifle", "rpg", "laserCannon", "flamethrower"];

export function createWeaponInstance(weaponId: WeaponId, level = 1): WeaponInstance {
  const def = WEAPON_DEFS[weaponId];
  return { weaponId, ammo: def.magazineSize, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level };
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

function makeProjectile(id: number, origin: Vec2, dir: Vec2, damage: number, def: WeaponDef, giga: boolean): Projectile {
  const speed = def.projectileSpeed ?? 600;
  return {
    id,
    position: { x: origin.x, y: origin.y },
    velocity: { x: dir.x * speed, y: dir.y * speed },
    damage,
    radius: giga ? PROJECTILE_RADIUS * WEAPON_GIGA_PROJECTILE_SCALE : PROJECTILE_RADIUS,
    ttlMs: PROJECTILE_TTL_MS,
    color: def.color,
    giga,
  };
}

export interface FireContext {
  projectiles: Projectile[];
  beamEffects: BeamEffect[];
  coneEffects: ConeEffect[];
  lightningEffects: LightningEffect[];
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

  const giga = isWeaponMaxLevel(instance.level);
  instance.fireTimerMs = def.fireCooldownMs * player.attackCooldownMultiplier * (giga ? WEAPON_GIGA_COOLDOWN_MULT : 1);
  instance.ammo -= 1;

  const damage = def.damage * player.damageMultiplier * weaponLevelDamageMultiplier(instance.level);
  const pierce = player.pierce + (giga ? WEAPON_GIGA_EXTRA_PIERCE : 0);
  let nextId = ctx.nextProjectileId;
  const dir = normalize(aimDir);

  switch (def.fireMode) {
    case "projectile": {
      const count = 1 + player.extraProjectiles;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 0.12;
        const projectile = makeProjectile(nextId++, player.position, rotate(dir, offset), damage, def, giga);
        if (pierce > 0) projectile.pierceRemaining = pierce;
        ctx.projectiles.push(projectile);
      }
      break;
    }
    case "spread": {
      const pellets = (def.pelletCount ?? 1) + player.extraProjectiles;
      const spread = def.spreadRad ?? 0.4;
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0 : i / (pellets - 1) - 0.5;
        const projectile = makeProjectile(nextId++, player.position, rotate(dir, t * spread), damage, def, giga);
        if (pierce > 0) projectile.pierceRemaining = pierce;
        ctx.projectiles.push(projectile);
      }
      break;
    }
    case "explosive": {
      const projectile = makeProjectile(nextId++, player.position, dir, damage, def, giga);
      projectile.splashRadius = def.splashRadius;
      projectile.splashDamage = (def.splashDamage ?? 0) * player.damageMultiplier * weaponLevelDamageMultiplier(instance.level);
      ctx.projectiles.push(projectile);
      break;
    }
    case "beam": {
      const range = def.beamRange ?? 400;
      for (const enemy of ctx.enemies) {
        if (enemy.hp <= 0) continue;
        const dist = pointToRaySegmentDistance(enemy.position, player.position, dir, range);
        if (dist !== null && dist <= enemy.radius + BEAM_HIT_WIDTH) {
          enemy.hp -= damage;
          applyLifeSteal(player, damage);
          applyOnHitEffects(player, ctx.enemies, enemy, ctx.lightningEffects, nowMs);
        }
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
        if (enemy.hp <= 0) continue;
        const toEnemy = { x: enemy.position.x - player.position.x, y: enemy.position.y - player.position.y };
        const dist = Math.sqrt(toEnemy.x * toEnemy.x + toEnemy.y * toEnemy.y);
        if (dist > range + enemy.radius) continue;
        const dirToEnemy = normalize(toEnemy);
        if (dot(dir, dirToEnemy) >= halfAngleCos) {
          enemy.hp -= damage;
          applyLifeSteal(player, damage);
          applyOnHitEffects(player, ctx.enemies, enemy, ctx.lightningEffects, nowMs);
        }
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

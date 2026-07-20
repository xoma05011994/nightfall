import { ENEMY_RADIUS, PLAYER_BASE_HP, PLAYER_BASE_MOVE_SPEED, PLAYER_BASE_PICKUP_RADIUS, PLAYER_RADIUS } from "../constants";
import { mulberry32, normalize } from "../math";
import { createEnemy, currentSpawnIntervalMs, spawnPositionAround } from "../systems/spawner";
import { collectDeadEnemies, resolveEnemyContactDamage, resolveProjectileHits, stepEnemies, stepProjectiles } from "../systems/combat";
import { grantXp, spawnXpOrbForEnemy, stepXpOrbs, xpToNextForLevel } from "../systems/xp";
import { rollPerkOffers } from "../systems/perks";
import { clampToWorldBounds } from "../systems/world";
import { findTouchedPickup, rollWeaponDrop, spawnWeaponPickup } from "../systems/weaponDrops";
import { WEAPON_DEFS, createWeaponInstance, fireWeapon, startReload, stepWeaponInstance } from "../systems/weapons";
import type {
  BeamEffect,
  ConeEffect,
  Enemy,
  GamePhase,
  Perk,
  Player,
  Projectile,
  Vec2,
  WeaponId,
  WeaponPickup,
  WeaponPromptInfo,
  WeaponSlots,
  XpOrb,
} from "../types";

export interface GameCallbacks {
  onLevelUp: (offers: Perk[]) => void;
  onWeaponPrompt: (info: WeaponPromptInfo) => void;
  onGameOver: () => void;
}

function createPlayer(): Player {
  return {
    position: { x: 0, y: 0 },
    hp: PLAYER_BASE_HP,
    maxHp: PLAYER_BASE_HP,
    level: 1,
    xp: 0,
    xpToNext: xpToNextForLevel(1),
    moveSpeed: PLAYER_BASE_MOVE_SPEED,
    radius: PLAYER_RADIUS,
    pickupRadius: PLAYER_BASE_PICKUP_RADIUS,
    damageMultiplier: 1,
    attackCooldownMultiplier: 1,
    extraProjectiles: 0,
    weaponSlots: [createWeaponInstance("pistol"), null, null] as WeaponSlots,
    equippedSlot: 0,
  };
}

export class Game {
  phase: GamePhase = "start";
  player: Player = createPlayer();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  xpOrbs: XpOrb[] = [];
  weaponPickups: WeaponPickup[] = [];
  beamEffects: BeamEffect[] = [];
  coneEffects: ConeEffect[] = [];
  elapsedMs = 0;
  kills = 0;

  private rng = mulberry32(Date.now() >>> 0);
  private spawnTimerMs = 0;
  private nextEnemyId = 1;
  private nextProjectileId = 1;
  private nextOrbId = 1;
  private nextPickupId = 1;
  private pendingPickup: WeaponPickup | null = null;

  constructor(private callbacks: GameCallbacks) {}

  start(): void {
    this.player = createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.xpOrbs = [];
    this.weaponPickups = [];
    this.beamEffects = [];
    this.coneEffects = [];
    this.elapsedMs = 0;
    this.kills = 0;
    this.spawnTimerMs = 0;
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.nextOrbId = 1;
    this.nextPickupId = 1;
    this.pendingPickup = null;
    this.phase = "playing";
  }

  update(dt: number, moveVector: Vec2, aimDir: Vec2, fireHeld: boolean, nowMs: number): void {
    if (this.phase !== "playing") return;

    this.player.position.x += moveVector.x * this.player.moveSpeed * dt;
    this.player.position.y += moveVector.y * this.player.moveSpeed * dt;
    this.player.position = clampToWorldBounds(this.player.position, this.player.radius);

    for (const slot of this.player.weaponSlots) {
      if (!slot) continue;
      stepWeaponInstance(slot, WEAPON_DEFS[slot.weaponId], dt);
    }

    if (fireHeld && (aimDir.x !== 0 || aimDir.y !== 0)) {
      const instance = this.player.weaponSlots[this.player.equippedSlot];
      if (instance) {
        const def = WEAPON_DEFS[instance.weaponId];
        this.nextProjectileId = fireWeapon(instance, def, this.player, normalize(aimDir), {
          projectiles: this.projectiles,
          beamEffects: this.beamEffects,
          coneEffects: this.coneEffects,
          enemies: this.enemies,
          nextProjectileId: this.nextProjectileId,
        }, nowMs);
        this.handleDeadEnemies(collectDeadEnemies(this.enemies));
      }
    }
    this.beamEffects = this.beamEffects.filter((b) => b.expiresAtMs > nowMs);
    this.coneEffects = this.coneEffects.filter((c) => c.expiresAtMs > nowMs);

    this.projectiles = stepProjectiles(this.projectiles, dt);
    const { survivingProjectiles, deadEnemies } = resolveProjectileHits(this.projectiles, this.enemies);
    this.projectiles = survivingProjectiles;
    this.handleDeadEnemies(deadEnemies);

    stepEnemies(this.enemies, this.player.position, dt);
    for (const enemy of this.enemies) enemy.position = clampToWorldBounds(enemy.position, enemy.radius);
    resolveEnemyContactDamage(this.enemies, this.player);

    const { survivingOrbs, xpCollected } = stepXpOrbs(this.xpOrbs, this.player, dt);
    this.xpOrbs = survivingOrbs;
    if (xpCollected > 0) {
      const { leveledUp } = grantXp(this.player, xpCollected);
      if (leveledUp) {
        this.phase = "levelup";
        this.callbacks.onLevelUp(rollPerkOffers(this.rng));
        return;
      }
    }

    if (this.player.hp <= 0) {
      this.phase = "gameover";
      this.callbacks.onGameOver();
      return;
    }

    const touched = findTouchedPickup(this.weaponPickups, this.player);
    if (touched) {
      this.handleTouchedPickup(touched);
      if (this.phase !== "playing") return;
    }

    this.spawnTimerMs -= dt * 1000;
    if (this.spawnTimerMs <= 0) {
      this.spawnTimerMs = currentSpawnIntervalMs(this.elapsedMs);
      const pos = spawnPositionAround(this.player.position, this.rng);
      this.enemies.push(createEnemy(this.nextEnemyId++, clampToWorldBounds(pos, ENEMY_RADIUS), this.elapsedMs));
    }

    this.elapsedMs += dt * 1000;
  }

  private handleDeadEnemies(deadEnemies: Enemy[]): void {
    for (const enemy of deadEnemies) {
      this.kills += 1;
      this.xpOrbs.push(spawnXpOrbForEnemy(this.nextOrbId++, enemy));
      const dropId = rollWeaponDrop(this.rng);
      if (dropId) this.weaponPickups.push(spawnWeaponPickup(this.nextPickupId++, dropId, enemy.position));
    }
  }

  private handleTouchedPickup(pickup: WeaponPickup): void {
    const slot2 = this.player.weaponSlots[1];
    const slot3 = this.player.weaponSlots[2];
    if (!slot2) {
      this.equipIntoSlot(1, pickup.weaponId);
      this.removePickup(pickup.id);
    } else if (!slot3) {
      this.equipIntoSlot(2, pickup.weaponId);
      this.removePickup(pickup.id);
    } else {
      this.pendingPickup = pickup;
      this.phase = "weaponPrompt";
      this.callbacks.onWeaponPrompt({ weaponId: pickup.weaponId });
    }
  }

  // `choice` is null when the player declines — the pickup stays in the
  // world untouched so they can grab it later if they change their mind.
  resolveWeaponPrompt(choice: 1 | 2 | null): void {
    if (this.pendingPickup && choice !== null) {
      this.equipIntoSlot(choice, this.pendingPickup.weaponId);
      this.removePickup(this.pendingPickup.id);
    }
    this.pendingPickup = null;
    this.phase = "playing";
  }

  private equipIntoSlot(slotIndex: 1 | 2, weaponId: WeaponId): void {
    this.player.weaponSlots[slotIndex] = createWeaponInstance(weaponId);
  }

  private removePickup(id: number): void {
    this.weaponPickups = this.weaponPickups.filter((p) => p.id !== id);
  }

  equipSlot(index: 0 | 1 | 2): void {
    if (this.phase !== "playing") return;
    if (this.player.weaponSlots[index]) this.player.equippedSlot = index;
  }

  reloadEquipped(): void {
    if (this.phase !== "playing") return;
    const instance = this.player.weaponSlots[this.player.equippedSlot];
    if (instance) startReload(instance, WEAPON_DEFS[instance.weaponId]);
  }

  applyPerk(perk: Perk): void {
    perk.apply(this.player);
    this.phase = "playing";
  }
}

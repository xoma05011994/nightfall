import {
  ADVENTURE_BOSS_1_TRIGGER_MS,
  ADVENTURE_DURATION_MS,
  BOSS_RADIUS,
  CHEST_SPAWN_INTERVAL_MS,
  ENEMY_RADIUS,
  PLAYER_BASE_HP,
  PLAYER_BASE_MOVE_SPEED,
  PLAYER_BASE_PICKUP_RADIUS,
  PLAYER_RADIUS,
} from "../constants";
import { mulberry32, normalize } from "../math";
import { createBoss, createEnemy, currentSpawnIntervalMs, spawnPositionAround } from "../systems/spawner";
import { resolveEnemyContactDamage, resolveProjectileHits, stepEnemies, stepProjectiles } from "../systems/combat";
import { collectDeadEnemies } from "../systems/enemies";
import { stepAura, stepBurningEnemies } from "../systems/statusEffects";
import { findTouchedChest, rollChestReward, spawnChest } from "../systems/chests";
import { weaponDamageMultiplier } from "../systems/profile";
import { grantXp, spawnXpOrbForEnemy, stepXpOrbs, xpToNextForLevel } from "../systems/xp";
import { rollPerkOffers } from "../systems/perks";
import { clampToWorldBounds } from "../systems/world";
import { findTouchedPickup, rollWeaponDrop, spawnWeaponPickup } from "../systems/weaponDrops";
import { WEAPON_DEFS, createWeaponInstance, fireWeapon, startReload, stepWeaponInstance } from "../systems/weapons";
import type {
  BeamEffect,
  Chest,
  ConeEffect,
  Enemy,
  GameMode,
  GamePhase,
  LevelDef,
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
  onVictory: () => void;
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
    pierce: 0,
    igniteDamagePerTick: 0,
    igniteDurationMs: 0,
    lightningChainDamage: 0,
    lightningChainRadius: 0,
    auraDamagePerTick: 0,
    auraRadius: 0,
    auraTickTimerMs: 0,
  };
}

export class Game {
  phase: GamePhase = "start";
  mode: GameMode = "endless";
  levelDef: LevelDef | null = null;
  player: Player = createPlayer();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  xpOrbs: XpOrb[] = [];
  weaponPickups: WeaponPickup[] = [];
  chests: Chest[] = [];
  beamEffects: BeamEffect[] = [];
  coneEffects: ConeEffect[] = [];
  elapsedMs = 0;
  kills = 0;
  goldEarned = 0;
  // Ordered by pick time; count tracks repeat picks of the same perk (shown
  // in the left-side perk tray as e.g. "Blood Rage x2").
  pickedPerks: { perk: Perk; count: number }[] = [];

  private rng: () => number;
  private spawnTimerMs = 0;
  private chestSpawnTimerMs = CHEST_SPAWN_INTERVAL_MS;
  private nextEnemyId = 1;
  private nextProjectileId = 1;
  private nextOrbId = 1;
  private nextPickupId = 1;
  private nextChestId = 1;
  private pendingPickup: WeaponPickup | null = null;
  private declinedPickupId: number | null = null;
  private adventureBoss1Spawned = false;
  private adventureBoss2Spawned = false;
  // Meta-progression weapon upgrade levels — only ever populated in
  // Adventure mode (see start()'s weaponUpgrades param).
  private weaponUpgrades: Partial<Record<WeaponId, number>> = {};

  // rngSeed is optional and exists mainly for deterministic tests — normal
  // play always seeds from the clock.
  constructor(private callbacks: GameCallbacks, rngSeed?: number) {
    this.rng = mulberry32(rngSeed ?? (Date.now() >>> 0));
  }

  // levelDef is Adventure-mode only — its seed reseeds the RNG so the same
  // level always plays out the same way on repeat attempts (unlike Endless,
  // which stays seeded from the clock for a different run every time).
  // weaponUpgrades comes from the persistent profile (systems/profile.ts)
  // and is likewise Adventure-only — Endless always plays with base stats.
  start(mode: GameMode = "endless", levelDef: LevelDef | null = null, weaponUpgrades: Partial<Record<WeaponId, number>> = {}): void {
    this.mode = mode;
    this.levelDef = mode === "adventure" ? levelDef : null;
    this.weaponUpgrades = mode === "adventure" ? weaponUpgrades : {};
    if (this.levelDef) this.rng = mulberry32(this.levelDef.seed);
    this.player = createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.xpOrbs = [];
    this.weaponPickups = [];
    this.chests = [];
    this.beamEffects = [];
    this.coneEffects = [];
    this.elapsedMs = 0;
    this.kills = 0;
    this.goldEarned = 0;
    this.pickedPerks = [];
    this.spawnTimerMs = 0;
    this.chestSpawnTimerMs = CHEST_SPAWN_INTERVAL_MS;
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.nextOrbId = 1;
    this.nextPickupId = 1;
    this.nextChestId = 1;
    this.pendingPickup = null;
    this.declinedPickupId = null;
    this.adventureBoss1Spawned = false;
    this.adventureBoss2Spawned = false;
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
        const upgradeLevel = this.weaponUpgrades[instance.weaponId] ?? 0;
        // Meta-progression is a per-weapon damage multiplier layered on top
        // of the run's perk-driven damageMultiplier — applied via a
        // shallow-cloned player so weapons.ts needs no knowledge of
        // upgrades at all (it only ever reads player.damageMultiplier).
        const firingPlayer = upgradeLevel > 0 ? { ...this.player, damageMultiplier: this.player.damageMultiplier * weaponDamageMultiplier(upgradeLevel) } : this.player;
        this.nextProjectileId = fireWeapon(instance, def, firingPlayer, normalize(aimDir), {
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
    const { survivingProjectiles, deadEnemies } = resolveProjectileHits(this.projectiles, this.enemies, this.player);
    this.projectiles = survivingProjectiles;
    this.handleDeadEnemies(deadEnemies);

    stepEnemies(this.enemies, this.player.position, dt);
    for (const enemy of this.enemies) enemy.position = clampToWorldBounds(enemy.position, enemy.radius);
    resolveEnemyContactDamage(this.enemies, this.player);

    this.handleDeadEnemies(stepBurningEnemies(this.enemies, dt));
    this.handleDeadEnemies(stepAura(this.player, this.enemies, dt));

    const { survivingOrbs, xpCollected } = stepXpOrbs(this.xpOrbs, this.player, dt);
    this.xpOrbs = survivingOrbs;
    if (xpCollected > 0) {
      this.grantXpAndCheckLevelUp(xpCollected);
      if (this.phase !== "playing") return;
    }

    if (this.player.hp <= 0) {
      this.phase = "gameover";
      this.callbacks.onGameOver();
      return;
    }

    const touched = findTouchedPickup(this.weaponPickups, this.player);
    if (touched && touched.id !== this.declinedPickupId) {
      this.handleTouchedPickup(touched);
      if (this.phase !== "playing") return;
    } else if (!touched) {
      // Player has walked off every pickup — allow a re-approach to prompt
      // again later (they may have changed their mind or freed up a slot).
      this.declinedPickupId = null;
    }

    const touchedChest = findTouchedChest(this.chests, this.player);
    if (touchedChest) {
      this.handleTouchedChest(touchedChest);
      if (this.phase !== "playing") return;
    }

    this.spawnTimerMs -= dt * 1000;
    if (this.spawnTimerMs <= 0) {
      this.spawnTimerMs = currentSpawnIntervalMs(this.elapsedMs);
      const pos = spawnPositionAround(this.player.position, this.rng);
      this.enemies.push(createEnemy(this.nextEnemyId++, clampToWorldBounds(pos, ENEMY_RADIUS), this.elapsedMs));
    }

    this.chestSpawnTimerMs -= dt * 1000;
    if (this.chestSpawnTimerMs <= 0) {
      this.chestSpawnTimerMs = CHEST_SPAWN_INTERVAL_MS;
      const pos = spawnPositionAround(this.player.position, this.rng);
      this.chests.push(spawnChest(this.nextChestId++, clampToWorldBounds(pos, 0)));
    }

    this.elapsedMs += dt * 1000;

    if (this.mode === "adventure") {
      if (!this.adventureBoss1Spawned && this.elapsedMs >= ADVENTURE_BOSS_1_TRIGGER_MS) {
        this.adventureBoss1Spawned = true;
        this.spawnBoss();
      }
      if (this.elapsedMs >= ADVENTURE_DURATION_MS) {
        if (!this.adventureBoss2Spawned) {
          this.adventureBoss2Spawned = true;
          this.spawnBoss();
        }
        this.phase = "victory";
        this.callbacks.onVictory();
        return;
      }
    }
  }

  private spawnBoss(): void {
    const pos = spawnPositionAround(this.player.position, this.rng);
    this.enemies.push(createBoss(this.nextEnemyId++, clampToWorldBounds(pos, BOSS_RADIUS), this.elapsedMs));
  }

  private grantXpAndCheckLevelUp(amount: number): void {
    const { leveledUp } = grantXp(this.player, amount);
    if (leveledUp) {
      this.phase = "levelup";
      this.callbacks.onLevelUp(rollPerkOffers(this.rng));
    }
  }

  private handleTouchedChest(chest: Chest): void {
    this.chests = this.chests.filter((c) => c.id !== chest.id);
    const reward = rollChestReward(this.rng);
    if (reward.type === "gold") {
      this.goldEarned += reward.amount;
    } else if (reward.type === "xp") {
      this.grantXpAndCheckLevelUp(reward.amount);
    } else {
      this.phase = "levelup";
      this.callbacks.onLevelUp(rollPerkOffers(this.rng));
    }
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
  // world so they can grab it later if they change their mind, but is
  // marked as declined so standing on it doesn't instantly re-open the same
  // prompt on the very next frame (cleared once they walk off it entirely).
  resolveWeaponPrompt(choice: 1 | 2 | null): void {
    if (this.pendingPickup && choice !== null) {
      this.equipIntoSlot(choice, this.pendingPickup.weaponId);
      this.removePickup(this.pendingPickup.id);
    } else if (this.pendingPickup) {
      this.declinedPickupId = this.pendingPickup.id;
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
    const existing = this.pickedPerks.find((p) => p.perk.id === perk.id);
    if (existing) existing.count += 1;
    else this.pickedPerks.push({ perk, count: 1 });
    this.phase = "playing";
  }
}

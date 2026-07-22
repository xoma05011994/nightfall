import {
  ADVENTURE_BOSS_1_TRIGGER_MS,
  ADVENTURE_DURATION_MS,
  BOSS_RADIUS,
  CHEST_SPAWN_INTERVAL_MS,
  DAMAGE_POPUP_LIFETIME_MS,
  ENEMY_RADIUS,
  MAX_ENEMIES_ON_SCREEN,
  MOMENTUM_DURATION_MS,
  MOMENTUM_MAX_STACKS,
  REWARD_POPUP_LIFETIME_MS,
  WEAPON_MAX_LEVEL,
} from "@nightfall/shared/constants";
import { mulberry32, normalize } from "@nightfall/shared/math";
import { createBoss, createEnemy, currentSpawnIntervalMs, pickEnemyType, spawnPositionAround } from "@nightfall/shared/systems/spawner";
import { resolveEnemyContactDamage, resolveEnemyProjectileHits, resolveProjectileHits, stepEnemies, stepEnemyProjectiles, stepProjectiles } from "@nightfall/shared/systems/combat";
import { collectDeadEnemies } from "@nightfall/shared/systems/enemies";
import { stepAura, stepBurningEnemies, stepShurikens } from "@nightfall/shared/systems/statusEffects";
import { findTouchedChest, rollChestReward, spawnChest } from "@nightfall/shared/systems/chests";
import { weaponDamageMultiplier } from "@nightfall/shared/systems/profile";
import { grantXp, spawnXpOrbForEnemy, stepXpOrbs } from "@nightfall/shared/systems/xp";
import { getPerkById, rollPerkOffers } from "@nightfall/shared/systems/perks";
import { clampToWorldBounds } from "@nightfall/shared/systems/world";
import { generateObstacles, resolvePlayerObstacleCollision } from "@nightfall/shared/systems/obstacles";
import { findTouchedPickup, rollWeaponDrop, spawnWeaponPickup } from "@nightfall/shared/systems/weaponDrops";
import { WEAPON_DEFS, createWeaponInstance, fireWeapon, startReload, stepWeaponInstance } from "@nightfall/shared/systems/weapons";
import { createPlayer } from "@nightfall/shared/systems/player";
import type {
  BeamEffect,
  Chest,
  ConeEffect,
  Enemy,
  EnemyType,
  GameMode,
  GamePhase,
  LevelDef,
  DamagePopupEffect,
  LightningEffect,
  Obstacle,
  Perk,
  Player,
  Projectile,
  RewardPopupEffect,
  Vec2,
  WeaponId,
  WeaponPickup,
  WeaponPromptInfo,
  XpOrb,
} from "@nightfall/shared/types";

export interface GameCallbacks {
  onLevelUp: (offers: Perk[]) => void;
  onWeaponPrompt: (info: WeaponPromptInfo) => void;
  onGameOver: () => void;
  onVictory: () => void;
}

export class Game {
  phase: GamePhase = "start";
  mode: GameMode = "endless";
  levelDef: LevelDef | null = null;
  player: Player = createPlayer();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  enemyProjectiles: Projectile[] = [];
  xpOrbs: XpOrb[] = [];
  weaponPickups: WeaponPickup[] = [];
  chests: Chest[] = [];
  obstacles: Obstacle[] = [];
  beamEffects: BeamEffect[] = [];
  coneEffects: ConeEffect[] = [];
  lightningEffects: LightningEffect[] = [];
  rewardPopups: RewardPopupEffect[] = [];
  damagePopups: DamagePopupEffect[] = [];
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
  private nextEnemyProjectileId = 1;
  private nextOrbId = 1;
  private nextPickupId = 1;
  private nextChestId = 1;
  private pendingPickup: WeaponPickup | null = null;
  private adventureBoss1Spawned = false;
  private adventureBoss2Spawned = false;
  // The boss that must die for Adventure victory — set when it spawns at the
  // 6-minute mark. The run keeps going past that mark (timer, spawns, etc.
  // don't stop) until this specific enemy is killed.
  private boss2Id: number | null = null;
  // Meta-progression weapon upgrade levels (see start()'s weaponUpgrades
  // param) — applies in every solo mode now (v1.0), Endless included.
  private weaponUpgrades: Partial<Record<WeaponId, number>> = {};

  // rngSeed is optional and exists mainly for deterministic tests — normal
  // play always seeds from the clock.
  constructor(private callbacks: GameCallbacks, rngSeed?: number) {
    this.rng = mulberry32(rngSeed ?? (Date.now() >>> 0));
  }

  // levelDef is Adventure-mode only — its seed reseeds the RNG so the same
  // level always plays out the same way on repeat attempts (unlike Endless,
  // which stays seeded from the clock for a different run every time).
  // weaponUpgrades/weaponSlotCount/startingPerkIds all come from the
  // persistent profile (systems/profile.ts) — v1.0 made these apply to
  // every solo mode (Endless included, previously Adventure-only), since
  // coins are now an account-wide resource earned by any run.
  start(
    mode: GameMode = "endless",
    levelDef: LevelDef | null = null,
    weaponUpgrades: Partial<Record<WeaponId, number>> = {},
    weaponSlotCount: 3 | 4 = 3,
    startingPerkIds: string[] = [],
  ): void {
    this.mode = mode;
    this.levelDef = mode === "adventure" ? levelDef : null;
    this.weaponUpgrades = weaponUpgrades;
    if (this.levelDef) this.rng = mulberry32(this.levelDef.seed);
    this.player = createPlayer();
    this.player.weaponSlotCount = weaponSlotCount;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.xpOrbs = [];
    this.weaponPickups = [];
    this.chests = [];
    this.obstacles = generateObstacles(this.rng);
    this.beamEffects = [];
    this.coneEffects = [];
    this.lightningEffects = [];
    this.rewardPopups = [];
    this.damagePopups = [];
    this.elapsedMs = 0;
    this.kills = 0;
    this.goldEarned = 0;
    this.pickedPerks = [];
    this.spawnTimerMs = 0;
    this.chestSpawnTimerMs = CHEST_SPAWN_INTERVAL_MS;
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.nextEnemyProjectileId = 1;
    this.nextOrbId = 1;
    this.nextPickupId = 1;
    this.nextChestId = 1;
    this.pendingPickup = null;
    this.adventureBoss1Spawned = false;
    this.adventureBoss2Spawned = false;
    this.boss2Id = null;
    // Armory-bought starting perks — applied once, at rank 1, same as a
    // real first pick (so a later level-up pick of the same perk correctly
    // continues at rank 2 via pickedPerks' count).
    for (const perkId of startingPerkIds) {
      const perk = getPerkById(perkId);
      if (!perk) continue;
      perk.apply(this.player, 1);
      this.pickedPerks.push({ perk, count: 1 });
    }
    this.phase = "playing";
  }

  // Thin wrapper around updateInner() — snapshots every enemy's hp before
  // the step and diffs against it after, pushing one damage popup per
  // enemy that lost hp and survived the step. Centralizing this here (one
  // diff at the boundary) instead of pushing a popup at every individual
  // damage call site means it automatically covers every current and
  // future damage source without needing to instrument each one — the
  // tradeoff is a killing blow's damage isn't shown (the enemy's already
  // gone from the array by the time this diffs), which is an acceptable
  // gap given the death itself (removal + xp orb) is its own clear signal.
  update(dt: number, moveVector: Vec2, aimDir: Vec2, fireHeld: boolean, nowMs: number): void {
    const hpBefore = new Map<number, number>();
    for (const e of this.enemies) hpBefore.set(e.id, e.hp);
    this.updateInner(dt, moveVector, aimDir, fireHeld, nowMs);
    this.damagePopups = this.damagePopups.filter((p) => p.expiresAtMs > nowMs);
    for (const e of this.enemies) {
      const before = hpBefore.get(e.id);
      if (before !== undefined && e.hp < before) {
        this.damagePopups.push({ position: { ...e.position }, amount: Math.round(before - e.hp), startMs: nowMs, expiresAtMs: nowMs + DAMAGE_POPUP_LIFETIME_MS });
      }
    }
  }

  private updateInner(dt: number, moveVector: Vec2, aimDir: Vec2, fireHeld: boolean, nowMs: number): void {
    if (this.phase !== "playing") return;

    this.player.position.x += moveVector.x * this.player.moveSpeed * dt;
    this.player.position.y += moveVector.y * this.player.moveSpeed * dt;
    this.player.position = clampToWorldBounds(this.player.position, this.player.radius);
    this.player.position = resolvePlayerObstacleCollision(this.player.position, this.player.radius, this.obstacles);

    for (const slot of this.player.weaponSlots) {
      if (!slot) continue;
      stepWeaponInstance(slot, WEAPON_DEFS[slot.weaponId], dt);
    }

    // Momentum's stacks decay as a group once nothing has died in a while.
    if (this.player.momentumStacks > 0) {
      this.player.momentumTimerMs -= dt * 1000;
      if (this.player.momentumTimerMs <= 0) this.player.momentumStacks = 0;
    }

    if (fireHeld && (aimDir.x !== 0 || aimDir.y !== 0)) {
      const instance = this.player.weaponSlots[this.player.equippedSlot];
      if (instance) {
        const def = WEAPON_DEFS[instance.weaponId];
        const firingPlayer = this.buildFiringPlayer(instance.weaponId);
        this.nextProjectileId = fireWeapon(instance, def, firingPlayer, normalize(aimDir), {
          projectiles: this.projectiles,
          beamEffects: this.beamEffects,
          coneEffects: this.coneEffects,
          lightningEffects: this.lightningEffects,
          enemies: this.enemies,
          nextProjectileId: this.nextProjectileId,
        }, nowMs);
        this.handleDeadEnemies(collectDeadEnemies(this.enemies));
        if (this.phase !== "playing") return;
      }
    }
    this.beamEffects = this.beamEffects.filter((b) => b.expiresAtMs > nowMs);
    this.coneEffects = this.coneEffects.filter((c) => c.expiresAtMs > nowMs);
    this.lightningEffects = this.lightningEffects.filter((l) => l.expiresAtMs > nowMs);
    this.rewardPopups = this.rewardPopups.filter((p) => p.expiresAtMs > nowMs);

    this.projectiles = stepProjectiles(this.projectiles, dt);
    const { survivingProjectiles, deadEnemies } = resolveProjectileHits(this.projectiles, this.enemies, this.player, this.lightningEffects, nowMs);
    this.projectiles = survivingProjectiles;
    this.handleDeadEnemies(deadEnemies);
    if (this.phase !== "playing") return;

    this.nextEnemyProjectileId = stepEnemies(this.enemies, this.player.position, dt, this.enemyProjectiles, this.nextEnemyProjectileId);
    for (const enemy of this.enemies) enemy.position = clampToWorldBounds(enemy.position, enemy.radius);
    resolveEnemyContactDamage(this.enemies, this.player);

    this.enemyProjectiles = stepEnemyProjectiles(this.enemyProjectiles, dt);
    this.enemyProjectiles = resolveEnemyProjectileHits(this.enemyProjectiles, this.player);

    this.handleDeadEnemies(stepBurningEnemies(this.player, this.enemies, dt));
    if (this.phase !== "playing") return;
    this.handleDeadEnemies(stepAura(this.player, this.enemies, dt, this.lightningEffects, nowMs));
    if (this.phase !== "playing") return;
    this.handleDeadEnemies(stepShurikens(this.player, this.enemies, dt, nowMs));
    if (this.phase !== "playing") return;

    const { survivingOrbs, xpCollected } = stepXpOrbs(this.xpOrbs, this.player, dt);
    this.xpOrbs = survivingOrbs;
    if (xpCollected > 0) {
      this.grantXpAndCheckLevelUp(xpCollected);
      if (this.phase !== "playing") return;
    }

    // Sandbox is a testing sandbox, not a real run — no death, no timed
    // waves/chests, so perks/weapons/enemies can be spawned freely and left
    // alone to inspect.
    if (this.mode !== "sandbox" && this.player.hp <= 0) {
      this.phase = "gameover";
      this.callbacks.onGameOver();
      return;
    }

    const touched = findTouchedPickup(this.weaponPickups, this.player);
    if (touched) {
      this.handleTouchedPickup(touched);
      if (this.phase !== "playing") return;
    }

    const touchedChest = findTouchedChest(this.chests, this.player);
    if (touchedChest) {
      this.handleTouchedChest(touchedChest, nowMs);
      if (this.phase !== "playing") return;
    }

    if (this.mode !== "sandbox") {
      this.spawnTimerMs -= dt * 1000;
      if (this.spawnTimerMs <= 0) {
        this.spawnTimerMs = currentSpawnIntervalMs(this.elapsedMs);
        if (this.enemies.length < MAX_ENEMIES_ON_SCREEN) {
          const pos = spawnPositionAround(this.player.position, this.rng);
          const type = pickEnemyType(this.elapsedMs, this.rng);
          this.enemies.push(createEnemy(this.nextEnemyId++, type, clampToWorldBounds(pos, ENEMY_RADIUS), this.elapsedMs));
        }
      }

      this.chestSpawnTimerMs -= dt * 1000;
      if (this.chestSpawnTimerMs <= 0) {
        this.chestSpawnTimerMs = CHEST_SPAWN_INTERVAL_MS;
        const pos = spawnPositionAround(this.player.position, this.rng);
        this.chests.push(spawnChest(this.nextChestId++, clampToWorldBounds(pos, 0)));
      }
    }

    this.elapsedMs += dt * 1000;

    if (this.mode === "adventure") {
      if (!this.adventureBoss1Spawned && this.elapsedMs >= ADVENTURE_BOSS_1_TRIGGER_MS) {
        this.adventureBoss1Spawned = true;
        this.spawnBoss();
      }
      // Victory is now killing this boss, not just surviving to the mark —
      // the run keeps going (timer, spawns, everything) past 6:00 until it
      // dies (see handleDeadEnemies).
      if (!this.adventureBoss2Spawned && this.elapsedMs >= ADVENTURE_DURATION_MS) {
        this.adventureBoss2Spawned = true;
        this.boss2Id = this.spawnBoss().id;
      }
    }
  }

  private spawnBoss(): Enemy {
    const pos = spawnPositionAround(this.player.position, this.rng);
    const boss = createBoss(this.nextEnemyId++, clampToWorldBounds(pos, BOSS_RADIUS), this.elapsedMs);
    this.enemies.push(boss);
    return boss;
  }

  // Folds meta-progression weapon upgrades, Berserker (damage scales with
  // missing hp), and Momentum (fire-rate stacks from recent kills) into a
  // shallow-cloned player for this shot only — weapons.ts stays unaware of
  // any of these, it only ever reads damageMultiplier/attackCooldownMultiplier.
  private buildFiringPlayer(weaponId: WeaponId): Player {
    const upgradeLevel = this.weaponUpgrades[weaponId] ?? 0;
    const upgradeMult = upgradeLevel > 0 ? weaponDamageMultiplier(upgradeLevel) : 1;
    const berserkerMult = this.player.berserkerIntensity > 0 ? 1 + this.player.berserkerIntensity * (1 - this.player.hp / this.player.maxHp) : 1;
    const momentumMult = this.player.momentumFireRatePerStack > 0 ? Math.max(0.3, 1 - this.player.momentumStacks * this.player.momentumFireRatePerStack) : 1;

    if (upgradeMult === 1 && berserkerMult === 1 && momentumMult === 1) return this.player;
    return {
      ...this.player,
      damageMultiplier: this.player.damageMultiplier * upgradeMult * berserkerMult,
      attackCooldownMultiplier: this.player.attackCooldownMultiplier * momentumMult,
    };
  }

  private grantXpAndCheckLevelUp(amount: number): void {
    const { leveledUp } = grantXp(this.player, amount);
    if (leveledUp) {
      this.phase = "levelup";
      this.callbacks.onLevelUp(rollPerkOffers(this.rng, this.pickedPerks));
    }
  }

  private pushRewardPopup(kind: RewardPopupEffect["kind"], text: string, nowMs: number): void {
    this.rewardPopups.push({
      position: { x: this.player.position.x, y: this.player.position.y },
      kind,
      text,
      startMs: nowMs,
      expiresAtMs: nowMs + REWARD_POPUP_LIFETIME_MS,
    });
  }

  private handleTouchedChest(chest: Chest, nowMs: number): void {
    this.chests = this.chests.filter((c) => c.id !== chest.id);
    const reward = rollChestReward(this.rng);
    if (reward.type === "gold") {
      const amount = Math.round(reward.amount * this.player.goldMultiplier);
      this.goldEarned += amount;
      this.pushRewardPopup("gold", `+${amount} Gold`, nowMs);
    } else if (reward.type === "xp") {
      this.pushRewardPopup("xp", `+${reward.amount} XP`, nowMs);
      this.grantXpAndCheckLevelUp(reward.amount);
    } else if (reward.type === "magnet") {
      // Marks every orb currently on the map so stepXpOrbs pulls them all in
      // visually at a fast fixed speed, instead of an instant invisible grant.
      for (const orb of this.xpOrbs) orb.magnetized = true;
      this.pushRewardPopup("magnet", "Magnet!", nowMs);
    } else {
      this.pushRewardPopup("perk", "Perk!", nowMs);
      this.phase = "levelup";
      this.callbacks.onLevelUp(rollPerkOffers(this.rng, this.pickedPerks));
    }
  }

  private handleDeadEnemies(deadEnemies: Enemy[]): void {
    if (deadEnemies.length === 0) return;
    if (this.player.momentumFireRatePerStack > 0) {
      this.player.momentumStacks = Math.min(MOMENTUM_MAX_STACKS, this.player.momentumStacks + deadEnemies.length);
      this.player.momentumTimerMs = MOMENTUM_DURATION_MS;
    }
    for (const enemy of deadEnemies) {
      this.kills += 1;
      this.xpOrbs.push(spawnXpOrbForEnemy(this.nextOrbId++, enemy));
      const dropId = rollWeaponDrop(this.rng);
      if (dropId) this.weaponPickups.push(spawnWeaponPickup(this.nextPickupId++, dropId, enemy.position));
      if (this.mode === "adventure" && this.boss2Id !== null && enemy.id === this.boss2Id) {
        this.phase = "victory";
        this.callbacks.onVictory();
      }
    }
  }

  private handleTouchedPickup(pickup: WeaponPickup): void {
    // A duplicate of a weapon type already held levels it up (capped at
    // WEAPON_MAX_LEVEL) instead of prompting a slot swap — no slot is ever
    // empty-checked for this case since pistol (slot 0) isn't droppable, so
    // a match can only be against slot 1+.
    const heldSlotIndex = this.player.weaponSlots.findIndex((s) => s?.weaponId === pickup.weaponId);
    if (heldSlotIndex > 0) {
      const held = this.player.weaponSlots[heldSlotIndex as 1 | 2 | 3]!;
      if (held.level < WEAPON_MAX_LEVEL) held.level += 1;
      this.removePickup(pickup.id);
      return;
    }

    // First empty droppable slot within weaponSlotCount (3 by default, 4
    // once the Armory's extra slot is bought) — only prompts a swap once
    // every held slot is actually full.
    for (let i = 1; i < this.player.weaponSlotCount; i++) {
      if (!this.player.weaponSlots[i]) {
        this.equipIntoSlot(i as 1 | 2 | 3, pickup.weaponId);
        this.removePickup(pickup.id);
        return;
      }
    }
    this.pendingPickup = pickup;
    this.phase = "weaponPrompt";
    this.callbacks.onWeaponPrompt({ weaponId: pickup.weaponId });
  }

  // `choice` is null when the player declines — the pickup is discarded
  // either way (equipped into a slot, or simply removed from the world),
  // so there's never a leftover pickup to re-trigger this same prompt.
  resolveWeaponPrompt(choice: 1 | 2 | 3 | null): void {
    if (this.pendingPickup && choice !== null) {
      this.equipIntoSlot(choice, this.pendingPickup.weaponId);
    }
    if (this.pendingPickup) this.removePickup(this.pendingPickup.id);
    this.pendingPickup = null;
    this.phase = "playing";
  }

  private equipIntoSlot(slotIndex: 1 | 2 | 3, weaponId: WeaponId): void {
    this.player.weaponSlots[slotIndex] = createWeaponInstance(weaponId);
  }

  private removePickup(id: number): void {
    this.weaponPickups = this.weaponPickups.filter((p) => p.id !== id);
  }

  pause(): void {
    if (this.phase === "playing") this.phase = "paused";
  }

  resume(): void {
    if (this.phase === "paused") this.phase = "playing";
  }

  // Abandons the current run cleanly — update() only ever simulates while
  // phase is "playing", so parking it back at "start" (the same phase a
  // freshly-constructed Game starts in) is enough to freeze everything.
  leaveToMenu(): void {
    this.phase = "start";
  }

  // Spawns an enemy just off-screen of the player, for the Sandbox mode's
  // manual spawn controls — reuses the same createEnemy/createBoss factories
  // as the real spawner so stats stay consistent with actual play.
  sandboxSpawnEnemy(type: EnemyType): void {
    const pos = spawnPositionAround(this.player.position, this.rng);
    const clamped = clampToWorldBounds(pos, type === "boss" ? BOSS_RADIUS : ENEMY_RADIUS);
    const enemy = type === "boss" ? createBoss(this.nextEnemyId++, clamped, this.elapsedMs) : createEnemy(this.nextEnemyId++, type, clamped, this.elapsedMs);
    this.enemies.push(enemy);
  }

  sandboxClearEnemies(): void {
    this.enemies = [];
  }

  // Applies a perk immediately, bypassing the normal level-up offer/roll
  // flow and its prerequisite/rank-cap gating — Sandbox is for free
  // experimentation, not a real run.
  sandboxApplyPerk(perk: Perk): void {
    this.applyPerk(perk);
  }

  // Equips (or re-levels, if already held) a weapon directly into a
  // droppable slot at a specific level, skipping the normal drop/pickup
  // flow.
  sandboxEquipWeapon(slotIndex: 1 | 2 | 3, weaponId: WeaponId, level: number): void {
    this.player.weaponSlots[slotIndex] = createWeaponInstance(weaponId, level);
  }

  equipSlot(index: 0 | 1 | 2 | 3): void {
    if (this.phase !== "playing") return;
    if (this.player.weaponSlots[index]) this.player.equippedSlot = index;
  }

  reloadEquipped(): void {
    if (this.phase !== "playing") return;
    const instance = this.player.weaponSlots[this.player.equippedSlot];
    if (instance) startReload(instance, WEAPON_DEFS[instance.weaponId]);
  }

  applyPerk(perk: Perk): void {
    const existing = this.pickedPerks.find((p) => p.perk.id === perk.id);
    const rank = existing ? existing.count + 1 : 1;
    perk.apply(this.player, rank);
    if (existing) existing.count += 1;
    else this.pickedPerks.push({ perk, count: 1 });
    this.phase = "playing";
  }
}

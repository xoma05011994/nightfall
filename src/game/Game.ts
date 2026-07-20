import {
  PLAYER_BASE_ATTACK_COOLDOWN_MS,
  PLAYER_BASE_ATTACK_RANGE,
  PLAYER_BASE_DAMAGE,
  PLAYER_BASE_HP,
  PLAYER_BASE_MOVE_SPEED,
  PLAYER_BASE_PICKUP_RADIUS,
  PLAYER_RADIUS,
} from "../constants";
import { mulberry32 } from "../math";
import { createEnemy, currentSpawnIntervalMs, spawnPositionAround } from "../systems/spawner";
import { resolveEnemyContactDamage, resolveProjectileHits, stepEnemies, stepPlayerAttack, stepProjectiles } from "../systems/combat";
import { grantXp, spawnXpOrbForEnemy, stepXpOrbs, xpToNextForLevel } from "../systems/xp";
import { rollPerkOffers } from "../systems/perks";
import type { Enemy, GamePhase, Perk, Player, Projectile, Vec2, XpOrb } from "../types";

export interface GameCallbacks {
  onLevelUp: (offers: Perk[]) => void;
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
    damage: PLAYER_BASE_DAMAGE,
    attackCooldownMs: PLAYER_BASE_ATTACK_COOLDOWN_MS,
    attackTimerMs: 0,
    attackRange: PLAYER_BASE_ATTACK_RANGE,
    projectileCount: 1,
    radius: PLAYER_RADIUS,
    pickupRadius: PLAYER_BASE_PICKUP_RADIUS,
  };
}

export class Game {
  phase: GamePhase = "start";
  player: Player = createPlayer();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  xpOrbs: XpOrb[] = [];
  elapsedMs = 0;
  kills = 0;

  private rng = mulberry32(Date.now() >>> 0);
  private spawnTimerMs = 0;
  private nextEnemyId = 1;
  private nextProjectileId = 1;
  private nextOrbId = 1;

  constructor(private callbacks: GameCallbacks) {}

  start(): void {
    this.player = createPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.xpOrbs = [];
    this.elapsedMs = 0;
    this.kills = 0;
    this.spawnTimerMs = 0;
    this.nextEnemyId = 1;
    this.nextProjectileId = 1;
    this.nextOrbId = 1;
    this.phase = "playing";
  }

  update(dt: number, moveVector: Vec2): void {
    if (this.phase !== "playing") return;

    this.player.position.x += moveVector.x * this.player.moveSpeed * dt;
    this.player.position.y += moveVector.y * this.player.moveSpeed * dt;

    this.nextProjectileId = stepPlayerAttack(this.player, this.enemies, this.projectiles, dt, this.nextProjectileId);
    this.projectiles = stepProjectiles(this.projectiles, dt);

    const { survivingProjectiles, deadEnemies } = resolveProjectileHits(this.projectiles, this.enemies);
    this.projectiles = survivingProjectiles;
    for (const enemy of deadEnemies) {
      this.kills += 1;
      this.xpOrbs.push(spawnXpOrbForEnemy(this.nextOrbId++, enemy));
    }

    stepEnemies(this.enemies, this.player.position, dt);
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

    this.spawnTimerMs -= dt * 1000;
    if (this.spawnTimerMs <= 0) {
      this.spawnTimerMs = currentSpawnIntervalMs(this.elapsedMs);
      const pos = spawnPositionAround(this.player.position, this.rng);
      this.enemies.push(createEnemy(this.nextEnemyId++, pos, this.elapsedMs));
    }

    this.elapsedMs += dt * 1000;
  }

  applyPerk(perk: Perk): void {
    perk.apply(this.player);
    this.phase = "playing";
  }
}

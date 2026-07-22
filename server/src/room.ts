import type { WebSocket } from "ws";
import {
  CHAIN_LINK_TICK_MS,
  CHEST_SPAWN_INTERVAL_MS,
  ENEMY_RADIUS,
  MATCH_TICK_MS,
  MAX_PARTY_SIZE,
  MOMENTUM_DURATION_MS,
  MOMENTUM_MAX_STACKS,
  REWARD_POPUP_LIFETIME_MS,
  ROOM_EMPTY_GRACE_MS,
  WEAPON_MAX_LEVEL,
} from "@nightfall/shared/constants";
import { mulberry32, normalize } from "@nightfall/shared/math";
import { createEnemy, currentSpawnIntervalMs, pickEnemyType, spawnPositionAround } from "@nightfall/shared/systems/spawner";
import {
  resolveEnemyContactDamage,
  resolveEnemyProjectileHits,
  resolveProjectileHits,
  stepEnemies,
  stepEnemyProjectiles,
  stepProjectiles,
} from "@nightfall/shared/systems/combat";
import { collectDeadEnemies } from "@nightfall/shared/systems/enemies";
import { stepAura, stepBurningEnemies } from "@nightfall/shared/systems/statusEffects";
import { stepChainLink } from "@nightfall/shared/systems/chainLink";
import { findTouchedChest, rollChestReward, spawnChest } from "@nightfall/shared/systems/chests";
import { grantXp, spawnXpOrbForEnemy, stepXpOrbs, xpToNextForLevel, type XpProgress } from "@nightfall/shared/systems/xp";
import { rollPerkOffers } from "@nightfall/shared/systems/perks";
import { clampToWorldBounds } from "@nightfall/shared/systems/world";
import { findTouchedPickup, rollWeaponDrop, spawnWeaponPickup } from "@nightfall/shared/systems/weaponDrops";
import { WEAPON_DEFS, createWeaponInstance, fireWeapon, startReload, stepWeaponInstance } from "@nightfall/shared/systems/weapons";
import { createPlayer } from "@nightfall/shared/systems/player";
import type {
  BeamEffect,
  Chest,
  ConeEffect,
  Enemy,
  LightningEffect,
  Perk,
  Player,
  Projectile,
  RewardPopupEffect,
  WeaponPickup,
  XpOrb,
} from "@nightfall/shared/types";
import type { ClientMessage, MatchPhase, MatchSnapshot, PlayerInputDTO, ServerMessage } from "@nightfall/shared/multiplayer";

interface PlayerRecord {
  ws: WebSocket | null;
  displayName: string;
  player: Player;
  input: PlayerInputDTO | null;
  // Perks offered to a player on level-up, kept server-side only (never
  // sent to the client with their `apply` function attached) until they
  // choose one via a chooseUpgrade message.
  pendingOffers: Perk[] | null;
  pickedPerks: { perk: Perk; count: number }[];
}

// Folds Berserker (damage scales with missing hp) and Momentum (fire-rate
// stacks from recent kills) into a shallow-cloned player for this shot only
// — weapons.ts stays unaware of either, it only ever reads
// damageMultiplier/attackCooldownMultiplier. No meta-progression weapon
// upgrades here — that shop is solo/Adventure-only, out of scope for
// multiplayer Endless.
function buildFiringPlayer(p: Player): Player {
  const berserkerMult = p.berserkerIntensity > 0 ? 1 + p.berserkerIntensity * (1 - p.hp / p.maxHp) : 1;
  const momentumMult = p.momentumFireRatePerStack > 0 ? Math.max(0.3, 1 - p.momentumStacks * p.momentumFireRatePerStack) : 1;
  if (berserkerMult === 1 && momentumMult === 1) return p;
  return {
    ...p,
    damageMultiplier: p.damageMultiplier * berserkerMult,
    attackCooldownMultiplier: p.attackCooldownMultiplier * momentumMult,
  };
}

// One instance per co-op room: owns all live game state and runs the fixed
// 20Hz tick loop that simulates it authoritatively. This is a direct port of
// the earlier RivetKit `match` actor's tick loop (same simulation logic,
// same step ordering) — only the plumbing changed: a plain setInterval
// instead of an actor framework's run loop, a plain Map instead of actor
// state/vars, raw `ws` sends instead of actor connections/broadcast.
//
// No persistence at all now (RivetKit's state/vars split existed so player
// builds could survive an actor restart) — if the server process restarts,
// every room is gone and players reconnect fresh. Acceptable for this
// project's scale; documented tradeoff, same spirit as the vars-loss
// tradeoff already accepted before.
export class Room {
  readonly players = new Map<string, PlayerRecord>();

  private enemies: Enemy[] = [];
  private projectiles: Projectile[] = [];
  private enemyProjectiles: Projectile[] = [];
  private xpOrbs: XpOrb[] = [];
  private weaponPickups: WeaponPickup[] = [];
  private chests: Chest[] = [];
  private beamEffects: BeamEffect[] = [];
  private coneEffects: ConeEffect[] = [];
  private lightningEffects: LightningEffect[] = [];
  private rewardPopups: RewardPopupEffect[] = [];

  // M3: XP is a shared party pool, not per-player — single source of truth
  // for level/xp/xpToNext, mirrored onto every player's own Player fields
  // each grant so the HUD shows one shared bar. Level-up still rolls each
  // player their own independent perk offers.
  private partyProgress: XpProgress = { xp: 0, level: 1, xpToNext: xpToNextForLevel(1) };
  // Chain Link is party-wide (not per-player like Deadly Aura), so its tick
  // timer lives here rather than on any one Player.
  private chainLinkTickTimerMs = 0;
  // Set the moment the party drops to 0 connected players, cleared the
  // moment anyone's back; once it's been set for ROOM_EMPTY_GRACE_MS the
  // room closes and the tick loop ends. Not immediate on disconnect — a
  // dropped connection may just be a brief network blip.
  private emptyStartMs: number | null = null;

  // Lifecycle phase: a new room waits in "lobby" (players gather, no
  // simulation) until the host starts it; any player can pause/resume,
  // which freezes the whole party's sim server-side.
  private phase: MatchPhase = "lobby";

  private rng = mulberry32(Date.now() >>> 0);
  private tick = 0;
  private elapsedMs = 0;
  private spawnTimerMs = 0;
  private chestSpawnTimerMs = CHEST_SPAWN_INTERVAL_MS;
  private nextEnemyId = 1;
  private nextProjectileId = 1;
  private nextEnemyProjectileId = 1;
  private nextOrbId = 1;
  private nextPickupId = 1;
  private nextChestId = 1;

  private readonly tickHandle: ReturnType<typeof setInterval>;

  constructor(
    readonly roomCode: string,
    private readonly onEmpty: () => void,
  ) {
    this.tickHandle = setInterval(() => this.step(), MATCH_TICK_MS);
  }

  private connectedEntries(): [string, PlayerRecord][] {
    return [...this.players.entries()].filter(([, r]) => r.ws !== null);
  }

  private countConnected(): number {
    return this.connectedEntries().length;
  }

  // The host is simply the longest-connected player still present — Map
  // preserves insertion order, so the first connected entry is the room's
  // creator (or, if they left, whoever's been in longest). Only the host's
  // startGame is honored. Empty string if nobody's connected.
  private hostId(): string {
    return this.connectedEntries()[0]?.[0] ?? "";
  }

  // True when a connected teammate is currently downed — gates whether the
  // Revive perk is offered.
  private hasConnectedGhost(): boolean {
    return this.connectedEntries().some(([, r]) => r.player.isGhost);
  }

  // Returns an error reason if the connection should be rejected, else null.
  addPlayer(playerId: string, displayName: string, ws: WebSocket): string | null {
    const existing = this.players.get(playerId);
    if (existing) {
      existing.ws = ws;
      return null;
    }
    if (this.countConnected() >= MAX_PARTY_SIZE) return "Room is full";
    // New joiners (including anyone joining mid-run) start synced to the
    // party's current pooled level/xp — shared XP means there's no such
    // thing as "joining behind," everyone rides the same bar.
    const player = createPlayer();
    player.level = this.partyProgress.level;
    player.xp = this.partyProgress.xp;
    player.xpToNext = this.partyProgress.xpToNext;
    this.players.set(playerId, { ws, displayName, player, input: null, pendingOffers: null, pickedPerks: [] });
    return null;
  }

  removePlayer(playerId: string, ws: WebSocket): void {
    const rec = this.players.get(playerId);
    if (rec && rec.ws === ws) rec.ws = null;
  }

  handleMessage(playerId: string, msg: ClientMessage): void {
    const rec = this.players.get(playerId);
    if (!rec) return;
    if (msg.type === "input") {
      const clamp1 = (n: number) => (Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0);
      rec.input = {
        moveX: clamp1(msg.payload.moveX),
        moveY: clamp1(msg.payload.moveY),
        aimX: clamp1(msg.payload.aimX),
        aimY: clamp1(msg.payload.aimY),
        fireHeld: Boolean(msg.payload.fireHeld),
      };
    } else if (msg.type === "chooseUpgrade") {
      // Re-validates the choice was actually offered to this player before
      // applying it — never trust a client-submitted perk id directly.
      const offers = rec.pendingOffers;
      if (!offers) return;
      const perk = offers.find((o) => o.id === msg.payload.perkId);
      if (!perk) return;
      perk.apply(rec.player);
      // Revive is special: it brings every downed teammate back at half hp,
      // respawned on top of the reviver (apply() itself is a no-op).
      if (perk.id === "revive") {
        for (const [, other] of this.players) {
          if (!other.player.isGhost) continue;
          other.player.isGhost = false;
          other.player.hp = Math.max(1, Math.round(other.player.maxHp * 0.5));
          other.player.position = { ...rec.player.position };
        }
      }
      const existing = rec.pickedPerks.find((p) => p.perk.id === perk.id);
      if (existing) existing.count += 1;
      else rec.pickedPerks.push({ perk, count: 1 });
      rec.pendingOffers = null;
    } else if (msg.type === "equipSlot") {
      // Only switch to an occupied slot (mirrors solo Game.equipSlot).
      if (rec.player.weaponSlots[msg.payload.slot]) rec.player.equippedSlot = msg.payload.slot;
    } else if (msg.type === "reload") {
      const instance = rec.player.weaponSlots[rec.player.equippedSlot];
      if (instance) startReload(instance, WEAPON_DEFS[instance.weaponId]);
    } else if (msg.type === "startGame") {
      // Only the host can start, and only out of the lobby.
      if (this.phase === "lobby" && playerId === this.hostId()) this.phase = "playing";
    } else if (msg.type === "pause") {
      if (this.phase === "playing") this.phase = "paused";
    } else if (msg.type === "resume") {
      if (this.phase === "paused") this.phase = "playing";
    }
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  }

  sendWelcome(ws: WebSocket): void {
    this.send(ws, { type: "welcome", payload: { roomCode: this.roomCode } });
  }

  private broadcast(message: ServerMessage): void {
    for (const [, rec] of this.players) {
      if (rec.ws) this.send(rec.ws, message);
    }
  }

  destroy(): void {
    clearInterval(this.tickHandle);
  }

  private grantPartyXpAndCheckLevelUp(amount: number): void {
    const { leveledUp } = grantXp(this.partyProgress, amount);
    for (const rec of this.players.values()) {
      rec.player.xp = this.partyProgress.xp;
      rec.player.level = this.partyProgress.level;
      rec.player.xpToNext = this.partyProgress.xpToNext;
    }
    if (!leveledUp) return;
    const partySize = this.countConnected();
    const hasReviveTarget = this.hasConnectedGhost();
    for (const [, rec] of this.connectedEntries()) {
      // Ghosts don't level up (they collect no XP), but guard anyway — a
      // downed player shouldn't be handed a perk choice.
      if (rec.player.isGhost) continue;
      const offers = rollPerkOffers(this.rng, rec.pickedPerks, undefined, partySize, hasReviveTarget);
      rec.pendingOffers = offers;
      if (rec.ws) this.send(rec.ws, { type: "levelUp", payload: { offerIds: offers.map((o) => o.id) } });
    }
  }

  private pushRewardPopup(position: Player["position"], kind: RewardPopupEffect["kind"], text: string, nowMs: number): void {
    this.rewardPopups.push({ position: { ...position }, kind, text, startMs: nowMs, expiresAtMs: nowMs + REWARD_POPUP_LIFETIME_MS });
  }

  private spawnLootForDeadEnemies(dead: Enemy[]): void {
    for (const enemy of dead) {
      this.xpOrbs.push(spawnXpOrbForEnemy(this.nextOrbId++, enemy));
      const dropId = rollWeaponDrop(this.rng);
      if (dropId) this.weaponPickups.push(spawnWeaponPickup(this.nextPickupId++, dropId, enemy.position));
    }
  }

  private handleDeadEnemies(dead: Enemy[], rec: PlayerRecord): void {
    if (dead.length === 0) return;
    if (rec.player.momentumFireRatePerStack > 0) {
      rec.player.momentumStacks = Math.min(MOMENTUM_MAX_STACKS, rec.player.momentumStacks + dead.length);
      rec.player.momentumTimerMs = MOMENTUM_DURATION_MS;
    }
    this.spawnLootForDeadEnemies(dead);
  }

  // Chain Link kills aren't attributable to one player (the laser is a
  // shared party effect), so this skips the per-player Momentum stacking
  // handleDeadEnemies does and only drops loot.
  private handleChainLinkKills(dead: Enemy[]): void {
    if (dead.length === 0) return;
    this.spawnLootForDeadEnemies(dead);
  }

  private handleTouchedPickup(rec: PlayerRecord, pickup: WeaponPickup): void {
    const p = rec.player;
    const heldSlotIndex = p.weaponSlots.findIndex((s) => s?.weaponId === pickup.weaponId);
    if (heldSlotIndex > 0) {
      const held = p.weaponSlots[heldSlotIndex as 1 | 2]!;
      if (held.level < WEAPON_MAX_LEVEL) held.level += 1;
      this.weaponPickups = this.weaponPickups.filter((wp) => wp.id !== pickup.id);
      return;
    }
    if (!p.weaponSlots[1]) {
      p.weaponSlots[1] = createWeaponInstance(pickup.weaponId);
      this.weaponPickups = this.weaponPickups.filter((wp) => wp.id !== pickup.id);
    } else if (!p.weaponSlots[2]) {
      p.weaponSlots[2] = createWeaponInstance(pickup.weaponId);
      this.weaponPickups = this.weaponPickups.filter((wp) => wp.id !== pickup.id);
    }
    // Both slots full: left on the ground for now — the slot-swap prompt
    // (solo's weaponPrompt phase) isn't wired up for multiplayer yet.
  }

  private handleTouchedChest(rec: PlayerRecord, chest: Chest, nowMs: number): void {
    this.chests = this.chests.filter((ch) => ch.id !== chest.id);
    const reward = rollChestReward(this.rng);
    const p = rec.player;
    if (reward.type === "gold") {
      this.pushRewardPopup(p.position, "gold", `+${Math.round(reward.amount * p.goldMultiplier)} Gold`, nowMs);
    } else if (reward.type === "xp") {
      this.pushRewardPopup(p.position, "xp", `+${reward.amount} XP`, nowMs);
      this.grantPartyXpAndCheckLevelUp(reward.amount);
    } else if (reward.type === "magnet") {
      for (const orb of this.xpOrbs) orb.magnetized = true;
      this.pushRewardPopup(p.position, "magnet", "Magnet!", nowMs);
    } else {
      this.pushRewardPopup(p.position, "perk", "Perk!", nowMs);
      const offers = rollPerkOffers(this.rng, rec.pickedPerks, undefined, this.countConnected(), this.hasConnectedGhost());
      rec.pendingOffers = offers;
      if (rec.ws) this.send(rec.ws, { type: "levelUp", payload: { offerIds: offers.map((o) => o.id) } });
    }
  }

  private step(): void {
    const dt = MATCH_TICK_MS / 1000;
    const nowMs = Date.now();
    const connected = this.connectedEntries();

    // 0. Empty-room grace period — see emptyStartMs's doc comment.
    if (connected.length === 0) {
      if (this.emptyStartMs === null) {
        this.emptyStartMs = nowMs;
      } else if (nowMs - this.emptyStartMs >= ROOM_EMPTY_GRACE_MS) {
        this.destroy();
        this.onEmpty();
        return;
      }
    } else if (this.emptyStartMs !== null) {
      this.emptyStartMs = null;
    }

    // Steps 1–8 (the whole simulation) only run while playing. In "lobby"
    // (waiting for the host to start) and "paused" the world stays frozen —
    // we still broadcast below so clients see the lobby / paused state.
    if (this.phase === "playing") {
    // 1. Movement, weapon cooldowns, momentum decay — per player.
    for (const [, rec] of connected) {
      const input = rec.input;
      const p = rec.player;
      if (input) {
        p.position.x += input.moveX * p.moveSpeed * dt;
        p.position.y += input.moveY * p.moveSpeed * dt;
        // Rotate to face the last aim direction, even while a ghost (still
        // floating and looking around) or not currently firing — mirrors
        // how the local client always faces its own live mouse position.
        if (Math.hypot(input.aimX, input.aimY) > 1e-6) p.facingAngle = Math.atan2(input.aimY, input.aimX);
      }
      p.position = clampToWorldBounds(p.position, p.radius);
      for (const slot of p.weaponSlots) if (slot) stepWeaponInstance(slot, WEAPON_DEFS[slot.weaponId], dt);
      if (p.momentumStacks > 0) {
        p.momentumTimerMs -= dt * 1000;
        if (p.momentumTimerMs <= 0) p.momentumStacks = 0;
      }
    }

    // 2. Firing — per player. New projectiles get tagged with ownerId so
    // step 4 can resolve life-steal/on-hit effects against the right player.
    for (const [playerId, rec] of connected) {
      const input = rec.input;
      const p = rec.player;
      if (p.isGhost) continue; // ghosts can float but can't fire
      if (!input?.fireHeld) continue;
      if (Math.hypot(input.aimX, input.aimY) < 1e-6) continue;
      const instance = p.weaponSlots[p.equippedSlot];
      if (!instance) continue;
      const def = WEAPON_DEFS[instance.weaponId];
      const firingPlayer = buildFiringPlayer(p);
      const projectilesBefore = this.projectiles.length;
      this.nextProjectileId = fireWeapon(
        instance,
        def,
        firingPlayer,
        normalize({ x: input.aimX, y: input.aimY }),
        {
          projectiles: this.projectiles,
          beamEffects: this.beamEffects,
          coneEffects: this.coneEffects,
          lightningEffects: this.lightningEffects,
          enemies: this.enemies,
          nextProjectileId: this.nextProjectileId,
        },
        nowMs,
      );
      for (let i = projectilesBefore; i < this.projectiles.length; i++) this.projectiles[i]!.ownerId = playerId;
      // Beam/cone modes damage enemies immediately inside fireWeapon (no
      // projectile involved) — collect any kills from that right away.
      this.handleDeadEnemies(collectDeadEnemies(this.enemies), rec);
    }

    this.beamEffects = this.beamEffects.filter((b) => b.expiresAtMs > nowMs);
    this.coneEffects = this.coneEffects.filter((cn) => cn.expiresAtMs > nowMs);
    this.lightningEffects = this.lightningEffects.filter((l) => l.expiresAtMs > nowMs);
    this.rewardPopups = this.rewardPopups.filter((r) => r.expiresAtMs > nowMs);

    // 3. Step + resolve player projectiles. Partitioned by ownerId so each
    // owner's life-steal/on-hit effects apply to the right Player —
    // resolveProjectileHits itself is still single-player-shaped, called
    // once per owner against the shared enemies array.
    this.projectiles = stepProjectiles(this.projectiles, dt);
    const projByOwner = new Map<string, Projectile[]>();
    const unowned: Projectile[] = [];
    for (const p of this.projectiles) {
      if (p.ownerId && this.players.has(p.ownerId)) {
        if (!projByOwner.has(p.ownerId)) projByOwner.set(p.ownerId, []);
        projByOwner.get(p.ownerId)!.push(p);
      } else {
        unowned.push(p);
      }
    }
    const nextProjectiles: Projectile[] = [...unowned];
    for (const [ownerId, projs] of projByOwner) {
      const ownerRec = this.players.get(ownerId)!;
      const { survivingProjectiles, deadEnemies } = resolveProjectileHits(projs, this.enemies, ownerRec.player, this.lightningEffects, nowMs);
      nextProjectiles.push(...survivingProjectiles);
      this.handleDeadEnemies(deadEnemies, ownerRec);
    }
    this.projectiles = nextProjectiles;

    // Ghosts (downed players) float around to spectate but are excluded from
    // every combat interaction below — enemies ignore them, they take no
    // damage, and they collect nothing. Recomputed after the death check so a
    // player who dies this tick immediately drops out of the later steps.
    let living = connected.filter(([, r]) => !r.player.isGhost);

    // 4. Enemy AI (targets nearest living player), contact damage, enemy
    // projectiles — all against living players only.
    const playerObjs = living.map(([, r]) => r.player);
    if (playerObjs.length > 0) {
      this.nextEnemyProjectileId = stepEnemies(
        this.enemies,
        playerObjs.map((p) => p.position),
        dt,
        this.enemyProjectiles,
        this.nextEnemyProjectileId,
      );
      for (const enemy of this.enemies) enemy.position = clampToWorldBounds(enemy.position, enemy.radius);
      resolveEnemyContactDamage(this.enemies, playerObjs);
      this.enemyProjectiles = stepEnemyProjectiles(this.enemyProjectiles, dt);
      this.enemyProjectiles = resolveEnemyProjectileHits(this.enemyProjectiles, playerObjs);
    }

    // Death: a living player whose hp hit 0 becomes a ghost (spectating).
    // No respawn except via a teammate's Revive perk.
    for (const [, rec] of living) {
      if (rec.player.hp <= 0) {
        rec.player.hp = 0;
        rec.player.isGhost = true;
      }
    }
    living = connected.filter(([, r]) => !r.player.isGhost);

    // 5. Status effects (ignite/aura) — living players only, against shared
    // enemies.
    for (const [, rec] of living) {
      this.handleDeadEnemies(stepBurningEnemies(rec.player, this.enemies, dt), rec);
      this.handleDeadEnemies(stepAura(rec.player, this.enemies, dt, this.lightningEffects, nowMs), rec);
    }

    // 5b. Chain Link (multiplayer-only) — party-wide, not per-player: one
    // shared tick timer, damage pooled from every living player who picked
    // it, laser drawn between each pair of adjacent living players.
    if (living.length >= 2) {
      this.chainLinkTickTimerMs -= dt * 1000;
      if (this.chainLinkTickTimerMs <= 0) {
        this.chainLinkTickTimerMs += CHAIN_LINK_TICK_MS;
        const chainLinkDamage = living.reduce((sum, [, rec]) => sum + rec.player.chainLinkDamagePerTick, 0);
        if (chainLinkDamage > 0) {
          const positions = living.map(([, rec]) => rec.player.position);
          this.handleChainLinkKills(stepChainLink(positions, chainLinkDamage, this.enemies, this.lightningEffects, nowMs));
        }
      }
    }

    // 6. XP orbs — living players only, sequential calls so an orb collected
    // by one player is removed before the next player's call can see it (no
    // double-collection). The XP feeds the shared party pool.
    for (const [, rec] of living) {
      const { survivingOrbs, xpCollected } = stepXpOrbs(this.xpOrbs, rec.player, dt);
      this.xpOrbs = survivingOrbs;
      if (xpCollected > 0) this.grantPartyXpAndCheckLevelUp(xpCollected);
    }

    // 7. Weapon pickups + chests — living players only, sequential (same
    // no-double-pickup reasoning as XP orbs).
    for (const [, rec] of living) {
      const touched = findTouchedPickup(this.weaponPickups, rec.player);
      if (touched) this.handleTouchedPickup(rec, touched);
    }
    for (const [, rec] of living) {
      const touchedChest = findTouchedChest(this.chests, rec.player);
      if (touchedChest) this.handleTouchedChest(rec, touchedChest, nowMs);
    }

    // 8. Spawn enemies/chests around a random living player (or any connected
    // player if the whole party is currently downed, so the world doesn't
    // freeze while ghosts wait for a revive).
    const spawnAnchors = living.length > 0 ? living : connected;
    if (spawnAnchors.length > 0) {
      this.spawnTimerMs -= dt * 1000;
      if (this.spawnTimerMs <= 0) {
        this.spawnTimerMs = currentSpawnIntervalMs(this.elapsedMs);
        const anchor = spawnAnchors[Math.floor(this.rng() * spawnAnchors.length)]![1].player.position;
        const pos = spawnPositionAround(anchor, this.rng);
        const type = pickEnemyType(this.elapsedMs, this.rng);
        this.enemies.push(createEnemy(this.nextEnemyId++, type, clampToWorldBounds(pos, ENEMY_RADIUS), this.elapsedMs));
      }

      this.chestSpawnTimerMs -= dt * 1000;
      if (this.chestSpawnTimerMs <= 0) {
        this.chestSpawnTimerMs = CHEST_SPAWN_INTERVAL_MS;
        const anchor = spawnAnchors[Math.floor(this.rng() * spawnAnchors.length)]![1].player.position;
        const pos = spawnPositionAround(anchor, this.rng);
        this.chests.push(spawnChest(this.nextChestId++, clampToWorldBounds(pos, 0)));
      }

      this.elapsedMs += dt * 1000;
    }
    } // end simulation (only ran while phase === "playing")

    // Broadcast every tick, full state (not delta-compressed) — fine at
    // local-dev/small-party scale (see the M2 commit message).
    const snapshot: MatchSnapshot = {
      tick: this.tick++,
      serverTimeMs: nowMs,
      elapsedMs: this.elapsedMs,
      phase: this.phase,
      hostId: this.hostId(),
      players: connected.map(([id, rec]) => ({ id, displayName: rec.displayName, player: rec.player })),
      enemies: this.enemies,
      projectiles: this.projectiles,
      enemyProjectiles: this.enemyProjectiles,
      xpOrbs: this.xpOrbs,
      weaponPickups: this.weaponPickups,
      chests: this.chests,
      beamEffects: this.beamEffects,
      coneEffects: this.coneEffects,
      lightningEffects: this.lightningEffects,
      rewardPopups: this.rewardPopups,
    };
    this.broadcast({ type: "snapshot", payload: snapshot });
  }
}

import { actor, event } from "rivetkit";
import {
  CHEST_SPAWN_INTERVAL_MS,
  ENEMY_RADIUS,
  MATCH_TICK_MS,
  MAX_PARTY_SIZE,
  MOMENTUM_DURATION_MS,
  MOMENTUM_MAX_STACKS,
  REWARD_POPUP_LIFETIME_MS,
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
import { findTouchedChest, rollChestReward, spawnChest } from "@nightfall/shared/systems/chests";
import { grantXp, spawnXpOrbForEnemy, stepXpOrbs } from "@nightfall/shared/systems/xp";
import { rollPerkOffers } from "@nightfall/shared/systems/perks";
import { clampToWorldBounds } from "@nightfall/shared/systems/world";
import { findTouchedPickup, rollWeaponDrop, spawnWeaponPickup } from "@nightfall/shared/systems/weaponDrops";
import { WEAPON_DEFS, createWeaponInstance, fireWeapon, stepWeaponInstance } from "@nightfall/shared/systems/weapons";
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
import type { MatchSnapshot, PlayerInputDTO } from "@nightfall/shared/multiplayer";

interface MatchPlayerRecord {
  connId: string | null;
  displayName: string;
  player: Player;
}

// State/vars split (per the multiplayer-game skill's rule): players' build
// (weapons/level/perks/position/hp) is small and must survive a mid-run
// actor restart, so it's c.state. Everything else — live enemies,
// projectiles, orbs, chests, pickups, the input buffer, and the RNG — is
// high-churn and fine to lose on a restart (documented MVP tradeoff, same
// as this repo's earlier 3D prototype).
interface MatchState {
  players: Record<string, MatchPlayerRecord>;
}

interface MatchVars {
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: Projectile[];
  xpOrbs: XpOrb[];
  weaponPickups: WeaponPickup[];
  chests: Chest[];
  beamEffects: BeamEffect[];
  coneEffects: ConeEffect[];
  lightningEffects: LightningEffect[];
  rewardPopups: RewardPopupEffect[];
  inputBuffer: Map<string, PlayerInputDTO>;
  // Perks offered to a player on level-up, kept server-side only (never
  // sent to the client with their `apply` function attached) until they
  // choose one via chooseUpgrade().
  pendingOffers: Map<string, Perk[]>;
  pickedPerks: Map<string, { perk: Perk; count: number }[]>;
  rng: () => number;
  tick: number;
  elapsedMs: number;
  spawnTimerMs: number;
  chestSpawnTimerMs: number;
  nextEnemyId: number;
  nextProjectileId: number;
  nextEnemyProjectileId: number;
  nextOrbId: number;
  nextPickupId: number;
  nextChestId: number;
}

interface ConnParams {
  playerId: string;
  displayName: string;
}

interface LevelUpEventPayload {
  offerIds: string[];
}

function createInitialVars(): MatchVars {
  return {
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    xpOrbs: [],
    weaponPickups: [],
    chests: [],
    beamEffects: [],
    coneEffects: [],
    lightningEffects: [],
    rewardPopups: [],
    inputBuffer: new Map(),
    pendingOffers: new Map(),
    pickedPerks: new Map(),
    rng: mulberry32(Date.now() >>> 0),
    tick: 0,
    elapsedMs: 0,
    spawnTimerMs: 0,
    chestSpawnTimerMs: CHEST_SPAWN_INTERVAL_MS,
    nextEnemyId: 1,
    nextProjectileId: 1,
    nextEnemyProjectileId: 1,
    nextOrbId: 1,
    nextPickupId: 1,
    nextChestId: 1,
  };
}

function connectedEntries(state: MatchState): [string, MatchPlayerRecord][] {
  return Object.entries(state.players).filter(([, r]) => r.connId !== null);
}

function countConnectedPlayers(state: MatchState): number {
  return connectedEntries(state).length;
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

export const match = actor({
  state: { players: {} } as MatchState,

  createVars: (): MatchVars => createInitialVars(),

  events: {
    snapshot: event<MatchSnapshot>(),
    levelUp: event<LevelUpEventPayload>(),
  },

  onBeforeConnect: (c, params: ConnParams) => {
    if (
      typeof params.playerId !== "string" ||
      typeof params.displayName !== "string" ||
      params.playerId.length === 0 ||
      params.playerId.length > 128 ||
      params.displayName.length === 0 ||
      params.displayName.length > 24
    ) {
      throw new Error("Invalid connection params");
    }
    const alreadyInMatch = params.playerId in c.state.players;
    if (!alreadyInMatch && countConnectedPlayers(c.state) >= MAX_PARTY_SIZE) {
      throw new Error("Room is full");
    }
  },

  onConnect: (c, conn) => {
    const { playerId, displayName } = conn.params as ConnParams;
    const existing = c.state.players[playerId];
    if (existing) {
      existing.connId = conn.id;
      return;
    }
    c.state.players[playerId] = { connId: conn.id, displayName, player: createPlayer() };
  },

  onDisconnect: (c, conn) => {
    const { playerId } = conn.params as ConnParams;
    const player = c.state.players[playerId];
    if (player && player.connId === conn.id) player.connId = null;

    // Endless co-op has no "run end" to naturally trigger cleanup — once
    // everyone's gone, close the room so matchmaker.state.rooms doesn't grow
    // unbounded over the actor's lifetime.
    if (countConnectedPlayers(c.state) === 0) {
      c.client()
        .matchmaker.getOrCreate(["main"])
        .closeRoom(c.key[0])
        .catch((err: unknown) => c.log.warn("closeRoom (empty room) failed", { err }));
    }
  },

  actions: {
    // Capped-rate (client sends at INPUT_SEND_HZ), last-write-wins,
    // unqueued — consumed by the next tick, nothing races on a Map.set().
    setInput: (c, input: PlayerInputDTO) => {
      const { playerId } = c.conn.params as ConnParams;
      const clamp1 = (n: number) => (Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0);
      c.vars.inputBuffer.set(playerId, {
        moveX: clamp1(input.moveX),
        moveY: clamp1(input.moveY),
        aimX: clamp1(input.aimX),
        aimY: clamp1(input.aimY),
        fireHeld: Boolean(input.fireHeld),
      });
    },

    // Re-validates the choice was actually offered to this player before
    // applying it — never trust a client-submitted perk id directly.
    chooseUpgrade: (c, perkId: string) => {
      const { playerId } = c.conn.params as ConnParams;
      const rec = c.state.players[playerId];
      const offers = c.vars.pendingOffers.get(playerId);
      if (!rec || !offers) return;
      const perk = offers.find((o) => o.id === perkId);
      if (!perk) return;

      perk.apply(rec.player);
      const picked = c.vars.pickedPerks.get(playerId) ?? [];
      const existing = picked.find((p) => p.perk.id === perk.id);
      if (existing) existing.count += 1;
      else picked.push({ perk, count: 1 });
      c.vars.pickedPerks.set(playerId, picked);
      c.vars.pendingOffers.delete(playerId);
    },
  },

  run: async (c) => {
    // --- per-tick helpers (closures — need access to c.vars/c.state/rng) ---

    function grantXpAndCheckLevelUp(rec: MatchPlayerRecord, playerId: string, amount: number): void {
      const { leveledUp } = grantXp(rec.player, amount);
      if (!leveledUp) return;
      const picked = c.vars.pickedPerks.get(playerId) ?? [];
      const offers = rollPerkOffers(c.vars.rng, picked);
      c.vars.pendingOffers.set(playerId, offers);
      const conn = rec.connId ? c.conns.get(rec.connId) : undefined;
      conn?.send("levelUp", { offerIds: offers.map((o) => o.id) } satisfies LevelUpEventPayload);
    }

    function pushRewardPopup(position: Player["position"], kind: RewardPopupEffect["kind"], text: string, nowMs: number): void {
      c.vars.rewardPopups.push({ position: { ...position }, kind, text, startMs: nowMs, expiresAtMs: nowMs + REWARD_POPUP_LIFETIME_MS });
    }

    function handleDeadEnemies(dead: Enemy[], rec: MatchPlayerRecord, playerId: string): void {
      if (dead.length === 0) return;
      if (rec.player.momentumFireRatePerStack > 0) {
        rec.player.momentumStacks = Math.min(MOMENTUM_MAX_STACKS, rec.player.momentumStacks + dead.length);
        rec.player.momentumTimerMs = MOMENTUM_DURATION_MS;
      }
      for (const enemy of dead) {
        c.vars.xpOrbs.push(spawnXpOrbForEnemy(c.vars.nextOrbId++, enemy));
        const dropId = rollWeaponDrop(c.vars.rng);
        if (dropId) c.vars.weaponPickups.push(spawnWeaponPickup(c.vars.nextPickupId++, dropId, enemy.position));
      }
      void playerId; // reserved for future per-player kill stats
    }

    function handleTouchedPickup(rec: MatchPlayerRecord, pickup: WeaponPickup): void {
      const p = rec.player;
      const heldSlotIndex = p.weaponSlots.findIndex((s) => s?.weaponId === pickup.weaponId);
      if (heldSlotIndex > 0) {
        const held = p.weaponSlots[heldSlotIndex as 1 | 2]!;
        if (held.level < WEAPON_MAX_LEVEL) held.level += 1;
        c.vars.weaponPickups = c.vars.weaponPickups.filter((wp) => wp.id !== pickup.id);
        return;
      }
      if (!p.weaponSlots[1]) {
        p.weaponSlots[1] = createWeaponInstance(pickup.weaponId);
        c.vars.weaponPickups = c.vars.weaponPickups.filter((wp) => wp.id !== pickup.id);
      } else if (!p.weaponSlots[2]) {
        p.weaponSlots[2] = createWeaponInstance(pickup.weaponId);
        c.vars.weaponPickups = c.vars.weaponPickups.filter((wp) => wp.id !== pickup.id);
      }
      // Both slots full: left on the ground for now — the slot-swap prompt
      // (solo's weaponPrompt phase) isn't wired up for multiplayer yet.
    }

    function handleTouchedChest(rec: MatchPlayerRecord, playerId: string, chest: Chest, nowMs: number): void {
      c.vars.chests = c.vars.chests.filter((ch) => ch.id !== chest.id);
      const reward = rollChestReward(c.vars.rng);
      const p = rec.player;
      if (reward.type === "gold") {
        pushRewardPopup(p.position, "gold", `+${Math.round(reward.amount * p.goldMultiplier)} Gold`, nowMs);
      } else if (reward.type === "xp") {
        pushRewardPopup(p.position, "xp", `+${reward.amount} XP`, nowMs);
        grantXpAndCheckLevelUp(rec, playerId, reward.amount);
      } else if (reward.type === "magnet") {
        for (const orb of c.vars.xpOrbs) orb.magnetized = true;
        pushRewardPopup(p.position, "magnet", "Magnet!", nowMs);
      } else {
        pushRewardPopup(p.position, "perk", "Perk!", nowMs);
        const picked = c.vars.pickedPerks.get(playerId) ?? [];
        const offers = rollPerkOffers(c.vars.rng, picked);
        c.vars.pendingOffers.set(playerId, offers);
        const conn = rec.connId ? c.conns.get(rec.connId) : undefined;
        conn?.send("levelUp", { offerIds: offers.map((o) => o.id) } satisfies LevelUpEventPayload);
      }
    }

    // --- fixed-tick loop ---
    while (!c.aborted) {
      const dt = MATCH_TICK_MS / 1000;
      const nowMs = Date.now();
      const connected = connectedEntries(c.state);

      // 1. Movement, weapon cooldowns, momentum decay — per player.
      for (const [playerId, rec] of connected) {
        const input = c.vars.inputBuffer.get(playerId);
        const p = rec.player;
        if (input) {
          p.position.x += input.moveX * p.moveSpeed * dt;
          p.position.y += input.moveY * p.moveSpeed * dt;
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
        const input = c.vars.inputBuffer.get(playerId);
        const p = rec.player;
        if (!input?.fireHeld) continue;
        if (Math.hypot(input.aimX, input.aimY) < 1e-6) continue;
        const instance = p.weaponSlots[p.equippedSlot];
        if (!instance) continue;
        const def = WEAPON_DEFS[instance.weaponId];
        const firingPlayer = buildFiringPlayer(p);
        const projectilesBefore = c.vars.projectiles.length;
        c.vars.nextProjectileId = fireWeapon(
          instance,
          def,
          firingPlayer,
          normalize({ x: input.aimX, y: input.aimY }),
          {
            projectiles: c.vars.projectiles,
            beamEffects: c.vars.beamEffects,
            coneEffects: c.vars.coneEffects,
            lightningEffects: c.vars.lightningEffects,
            enemies: c.vars.enemies,
            nextProjectileId: c.vars.nextProjectileId,
          },
          nowMs,
        );
        for (let i = projectilesBefore; i < c.vars.projectiles.length; i++) c.vars.projectiles[i]!.ownerId = playerId;
        // Beam/cone modes damage enemies immediately inside fireWeapon (no
        // projectile involved) — collect any kills from that right away.
        handleDeadEnemies(collectDeadEnemies(c.vars.enemies), rec, playerId);
      }

      c.vars.beamEffects = c.vars.beamEffects.filter((b) => b.expiresAtMs > nowMs);
      c.vars.coneEffects = c.vars.coneEffects.filter((cn) => cn.expiresAtMs > nowMs);
      c.vars.lightningEffects = c.vars.lightningEffects.filter((l) => l.expiresAtMs > nowMs);
      c.vars.rewardPopups = c.vars.rewardPopups.filter((r) => r.expiresAtMs > nowMs);

      // 3. Step + resolve player projectiles. Partitioned by ownerId so each
      // owner's life-steal/on-hit effects apply to the right Player —
      // resolveProjectileHits itself is still single-player-shaped, called
      // once per owner against the shared enemies array.
      c.vars.projectiles = stepProjectiles(c.vars.projectiles, dt);
      const projByOwner = new Map<string, Projectile[]>();
      const unowned: Projectile[] = [];
      for (const p of c.vars.projectiles) {
        if (p.ownerId && c.state.players[p.ownerId]) {
          if (!projByOwner.has(p.ownerId)) projByOwner.set(p.ownerId, []);
          projByOwner.get(p.ownerId)!.push(p);
        } else {
          unowned.push(p);
        }
      }
      const nextProjectiles: Projectile[] = [...unowned];
      for (const [ownerId, projs] of projByOwner) {
        const ownerRec = c.state.players[ownerId]!;
        const { survivingProjectiles, deadEnemies } = resolveProjectileHits(projs, c.vars.enemies, ownerRec.player, c.vars.lightningEffects, nowMs);
        nextProjectiles.push(...survivingProjectiles);
        handleDeadEnemies(deadEnemies, ownerRec, ownerId);
      }
      c.vars.projectiles = nextProjectiles;

      // 4. Enemy AI (targets nearest connected player), contact damage,
      // enemy projectiles.
      const playerObjs = connected.map(([, r]) => r.player);
      if (playerObjs.length > 0) {
        c.vars.nextEnemyProjectileId = stepEnemies(
          c.vars.enemies,
          playerObjs.map((p) => p.position),
          dt,
          c.vars.enemyProjectiles,
          c.vars.nextEnemyProjectileId,
        );
        for (const enemy of c.vars.enemies) enemy.position = clampToWorldBounds(enemy.position, enemy.radius);
        resolveEnemyContactDamage(c.vars.enemies, playerObjs);
        c.vars.enemyProjectiles = stepEnemyProjectiles(c.vars.enemyProjectiles, dt);
        c.vars.enemyProjectiles = resolveEnemyProjectileHits(c.vars.enemyProjectiles, playerObjs);
      }

      // 5. Status effects (ignite/aura) — per player, against shared enemies.
      for (const [playerId, rec] of connected) {
        handleDeadEnemies(stepBurningEnemies(rec.player, c.vars.enemies, dt), rec, playerId);
        handleDeadEnemies(stepAura(rec.player, c.vars.enemies, dt, c.vars.lightningEffects, nowMs), rec, playerId);
      }

      // 6. XP orbs — per player, sequential calls so an orb collected by one
      // player is removed before the next player's call can see it (no
      // double-collection). M2 keeps XP per-player, like solo; M3 pools it.
      for (const [playerId, rec] of connected) {
        const { survivingOrbs, xpCollected } = stepXpOrbs(c.vars.xpOrbs, rec.player, dt);
        c.vars.xpOrbs = survivingOrbs;
        if (xpCollected > 0) grantXpAndCheckLevelUp(rec, playerId, xpCollected);
      }

      // No death/game-over flow for co-op yet (M2 doesn't define whether the
      // whole party wipes together or players go down individually) — clamp
      // at 0 so hp can't go negative, but players stay "alive" and playable.
      for (const [, rec] of connected) {
        if (rec.player.hp < 0) rec.player.hp = 0;
      }

      // 7. Weapon pickups + chests — per player, sequential (same
      // no-double-pickup reasoning as XP orbs).
      for (const [, rec] of connected) {
        const touched = findTouchedPickup(c.vars.weaponPickups, rec.player);
        if (touched) handleTouchedPickup(rec, touched);
      }
      for (const [playerId, rec] of connected) {
        const touchedChest = findTouchedChest(c.vars.chests, rec.player);
        if (touchedChest) handleTouchedChest(rec, playerId, touchedChest, nowMs);
      }

      // 8. Spawn enemies/chests around a random connected player.
      if (connected.length > 0) {
        c.vars.spawnTimerMs -= dt * 1000;
        if (c.vars.spawnTimerMs <= 0) {
          c.vars.spawnTimerMs = currentSpawnIntervalMs(c.vars.elapsedMs);
          const anchor = connected[Math.floor(c.vars.rng() * connected.length)]![1].player.position;
          const pos = spawnPositionAround(anchor, c.vars.rng);
          const type = pickEnemyType(c.vars.elapsedMs, c.vars.rng);
          c.vars.enemies.push(createEnemy(c.vars.nextEnemyId++, type, clampToWorldBounds(pos, ENEMY_RADIUS), c.vars.elapsedMs));
        }

        c.vars.chestSpawnTimerMs -= dt * 1000;
        if (c.vars.chestSpawnTimerMs <= 0) {
          c.vars.chestSpawnTimerMs = CHEST_SPAWN_INTERVAL_MS;
          const anchor = connected[Math.floor(c.vars.rng() * connected.length)]![1].player.position;
          const pos = spawnPositionAround(anchor, c.vars.rng);
          c.vars.chests.push(spawnChest(c.vars.nextChestId++, clampToWorldBounds(pos, 0)));
        }

        c.vars.elapsedMs += dt * 1000;
      }

      // Broadcast every tick, full state (not delta-compressed) — fine at
      // local-dev/small-party scale; see the M2 commit message.
      const snapshot: MatchSnapshot = {
        tick: c.vars.tick++,
        serverTimeMs: nowMs,
        elapsedMs: c.vars.elapsedMs,
        players: connected.map(([id, rec]) => ({ id, displayName: rec.displayName, player: rec.player })),
        enemies: c.vars.enemies,
        projectiles: c.vars.projectiles,
        enemyProjectiles: c.vars.enemyProjectiles,
        xpOrbs: c.vars.xpOrbs,
        weaponPickups: c.vars.weaponPickups,
        chests: c.vars.chests,
        beamEffects: c.vars.beamEffects,
        coneEffects: c.vars.coneEffects,
        lightningEffects: c.vars.lightningEffects,
        rewardPopups: c.vars.rewardPopups,
      };
      c.broadcast("snapshot", snapshot);

      await new Promise((resolve) => setTimeout(resolve, MATCH_TICK_MS));
    }
  },
});

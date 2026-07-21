import { actor, event } from "rivetkit";
import { MATCH_TICK_MS, MAX_PARTY_SIZE, PLAYER_BASE_MOVE_SPEED, PLAYER_RADIUS } from "@nightfall/shared/constants";
import { clampToWorldBounds } from "@nightfall/shared/systems/world";
import type { MatchSnapshot, PlayerInputDTO } from "@nightfall/shared/multiplayer";
import type { Vec2 } from "@nightfall/shared/types";

interface MatchPlayerRecord {
  connId: string | null;
  displayName: string;
  position: Vec2;
}

// State/vars split (per the multiplayer-game skill's rule): c.state holds
// small, bounded, must-survive-a-restart data; c.vars holds the high-churn
// per-tick simulation data that's fine to lose on an actor restart. M1 has
// no enemies/combat yet, so vars is just the input buffer.
interface MatchState {
  players: Record<string, MatchPlayerRecord>;
}

interface MatchVars {
  inputBuffer: Map<string, PlayerInputDTO>;
  tick: number;
}

interface ConnParams {
  playerId: string;
  displayName: string;
}

function countConnectedPlayers(state: MatchState): number {
  return Object.values(state.players).filter((p) => p.connId !== null).length;
}

export const match = actor({
  state: { players: {} } as MatchState,

  createVars: (): MatchVars => ({ inputBuffer: new Map(), tick: 0 }),

  events: {
    snapshot: event<MatchSnapshot>(),
  },

  onBeforeConnect: (c, params: ConnParams) => {
    // Params arrive over the wire as untyped JSON — validate actual types,
    // not just truthiness, since playerId doubles as a c.state.players index.
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
    c.state.players[playerId] = { connId: conn.id, displayName, position: { x: 0, y: 0 } };
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
      // Sanitized here so a malformed/malicious value (NaN, Infinity,
      // out-of-range) can only ever zero out that one player's own movement
      // for a tick, never corrupt position into NaN.
      const moveX = Number.isFinite(input.moveX) ? Math.max(-1, Math.min(1, input.moveX)) : 0;
      const moveY = Number.isFinite(input.moveY) ? Math.max(-1, Math.min(1, input.moveY)) : 0;
      c.vars.inputBuffer.set(playerId, { moveX, moveY });
    },
  },

  run: async (c) => {
    while (!c.aborted) {
      const dt = MATCH_TICK_MS / 1000;

      for (const [playerId, player] of Object.entries(c.state.players)) {
        if (player.connId === null) continue;
        const input = c.vars.inputBuffer.get(playerId);
        if (!input) continue;
        const len = Math.hypot(input.moveX, input.moveY) || 1;
        const normX = len > 1 ? input.moveX / len : input.moveX;
        const normY = len > 1 ? input.moveY / len : input.moveY;
        player.position.x += normX * PLAYER_BASE_MOVE_SPEED * dt;
        player.position.y += normY * PLAYER_BASE_MOVE_SPEED * dt;
        player.position = clampToWorldBounds(player.position, PLAYER_RADIUS);
      }

      const snapshot: MatchSnapshot = {
        tick: c.vars.tick++,
        serverTimeMs: Date.now(),
        players: Object.entries(c.state.players)
          .filter(([, p]) => p.connId !== null)
          .map(([id, p]) => ({ id, displayName: p.displayName, position: { ...p.position } })),
      };
      c.broadcast("snapshot", snapshot);

      await new Promise((resolve) => setTimeout(resolve, MATCH_TICK_MS));
    }
  },
});

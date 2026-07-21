import type { Vec2 } from "./types";

// Sent from client to server at INPUT_SEND_HZ. Movement-only for M1 — aim/fire
// land in M2 alongside the rest of combat.
export interface PlayerInputDTO {
  moveX: number;
  moveY: number;
}

export interface PlayerSnapshot {
  id: string;
  displayName: string;
  position: Vec2;
}

// Broadcast every tick. Grows in M2 (enemies, projectiles, xp) and M3 (party
// level/xp) — kept minimal for M1's movement-only sync.
export interface MatchSnapshot {
  tick: number;
  serverTimeMs: number;
  players: PlayerSnapshot[];
}

export interface RoomInfo {
  roomCode: string;
  matchId: string;
}

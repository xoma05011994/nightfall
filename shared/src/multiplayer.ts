import type { BeamEffect, Chest, ConeEffect, Enemy, LightningEffect, Obstacle, Player, Projectile, RewardPopupEffect, WeaponPickup, XpOrb } from "./types";

// Sent from client to server at INPUT_SEND_HZ.
export interface PlayerInputDTO {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  fireHeld: boolean;
}

export interface PlayerSnapshot {
  id: string;
  displayName: string;
  // Full shared Player shape — lets the client reuse the same rendering/HUD
  // code that already expects this type for solo play, instead of a
  // separate parallel DTO shape.
  player: Player;
}

// Room lifecycle: a freshly created room sits in "lobby" until the host
// starts the game; any player can "pause" (freezes the whole party's
// simulation server-side) and "resume".
export type MatchPhase = "lobby" | "playing" | "paused";

// Broadcast every tick. Full-state, not delta-compressed — fine at local-dev
// scale (see the M2 commit message for the bandwidth reasoning). Mirrors
// solo Game's own public fields closely on purpose, for the same reason.
export interface MatchSnapshot {
  tick: number;
  serverTimeMs: number;
  elapsedMs: number;
  phase: MatchPhase;
  // Which connected player is the host (the room's creator, or the
  // longest-connected player if the original host left). Only the host's
  // "startGame" is honored.
  hostId: string;
  players: PlayerSnapshot[];
  // Static, generated once when the room is created and never changes
  // afterward — still sent every tick like everything else here rather than
  // special-cased into a one-time message, for the same "simple over
  // optimal at this scale" reasoning as the rest of this broadcast.
  obstacles: Obstacle[];
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
}

// Plain WebSocket protocol (v0.6 M... — replaces the earlier RivetKit actor
// transport after Rivet Cloud's engine hit an unresolvable actor-scheduling
// bug). One JSON message per WebSocket frame, discriminated on `type`.
// Room create/join happen via the connection URL's query params
// (mode=create|join, playerId, displayName, code), not as messages — see
// server/src/index.ts's upgrade handler and client/src/net/MultiplayerGame.ts.

export type ClientMessage =
  | { type: "input"; payload: PlayerInputDTO }
  | { type: "chooseUpgrade"; payload: { perkId: string } }
  | { type: "equipSlot"; payload: { slot: 0 | 1 | 2 } }
  | { type: "reload" }
  | { type: "startGame" }
  | { type: "pause" }
  | { type: "resume" };

export type ServerMessage =
  | { type: "welcome"; payload: { roomCode: string } }
  | { type: "snapshot"; payload: MatchSnapshot }
  | { type: "levelUp"; payload: { offerIds: string[] } };

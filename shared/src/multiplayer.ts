import type { BeamEffect, Chest, ConeEffect, Enemy, LightningEffect, Player, Projectile, RewardPopupEffect, WeaponPickup, XpOrb } from "./types";

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

// Broadcast every tick. Full-state, not delta-compressed — fine at local-dev
// scale (see the M2 commit message for the bandwidth reasoning). Mirrors
// solo Game's own public fields closely on purpose, for the same reason.
export interface MatchSnapshot {
  tick: number;
  serverTimeMs: number;
  elapsedMs: number;
  players: PlayerSnapshot[];
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

export type ClientMessage = { type: "input"; payload: PlayerInputDTO } | { type: "chooseUpgrade"; payload: { perkId: string } };

export type ServerMessage =
  | { type: "welcome"; payload: { roomCode: string } }
  | { type: "snapshot"; payload: MatchSnapshot }
  | { type: "levelUp"; payload: { offerIds: string[] } };

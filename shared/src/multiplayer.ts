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

export interface RoomInfo {
  roomCode: string;
  matchId: string;
}

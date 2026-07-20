export interface Vec2 {
  x: number;
  y: number;
}

export interface Player {
  position: Vec2;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  moveSpeed: number;
  damage: number;
  attackCooldownMs: number;
  attackTimerMs: number;
  attackRange: number;
  projectileCount: number;
  radius: number;
  pickupRadius: number;
}

export interface Enemy {
  id: number;
  position: Vec2;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  contactCooldownMs: number;
  contactTimerMs: number;
}

export interface Projectile {
  id: number;
  position: Vec2;
  velocity: Vec2;
  damage: number;
  radius: number;
  ttlMs: number;
}

export interface XpOrb {
  id: number;
  position: Vec2;
  value: number;
  radius: number;
}

export interface Perk {
  id: string;
  name: string;
  description: string;
  apply: (player: Player) => void;
}

export type GamePhase = "start" | "playing" | "levelup" | "gameover";

import { CHEST_GOLD_MAX, CHEST_GOLD_MIN, CHEST_RADIUS, CHEST_XP_AMOUNT } from "../constants";
import type { Chest, ChestRewardType, Player, Vec2 } from "../types";
import { circlesOverlap } from "./collision";

export function spawnChest(id: number, position: Vec2): Chest {
  return { id, position: { x: position.x, y: position.y }, radius: CHEST_RADIUS };
}

export interface ChestReward {
  type: ChestRewardType;
  amount: number; // gold amount or xp amount; unused (0) for "perk"
}

// Equal odds across the three reward types.
export function rollChestReward(rng: () => number): ChestReward {
  const roll = rng();
  if (roll < 1 / 3) return { type: "gold", amount: Math.floor(CHEST_GOLD_MIN + rng() * (CHEST_GOLD_MAX - CHEST_GOLD_MIN + 1)) };
  if (roll < 2 / 3) return { type: "xp", amount: CHEST_XP_AMOUNT };
  return { type: "perk", amount: 0 };
}

export function findTouchedChest(chests: Chest[], player: Player): Chest | null {
  for (const chest of chests) {
    if (circlesOverlap(chest.position, chest.radius, player.position, player.radius)) return chest;
  }
  return null;
}

import { PERK_OFFER_COUNT } from "../constants";
import type { Perk } from "../types";

// v0.1: exactly 5 perks, each a flat one-time multiplier/bonus. No stacking
// caps or prerequisites yet — every perk can be picked repeatedly across a
// run if it's re-offered.
export const PERKS: Perk[] = [
  {
    id: "damage",
    name: "Blood Rage",
    description: "+25% weapon damage",
    apply: (p) => {
      p.damage *= 1.25;
    },
  },
  {
    id: "firerate",
    name: "Frenzy",
    description: "-20% attack cooldown",
    apply: (p) => {
      p.attackCooldownMs *= 0.8;
    },
  },
  {
    id: "maxhp",
    name: "Thick Hide",
    description: "+20 max HP, heals the same amount",
    apply: (p) => {
      p.maxHp += 20;
      p.hp += 20;
    },
  },
  {
    id: "speed",
    name: "Adrenaline",
    description: "+15% move speed",
    apply: (p) => {
      p.moveSpeed *= 1.15;
    },
  },
  {
    id: "multishot",
    name: "Split Shot",
    description: "+1 projectile per attack",
    apply: (p) => {
      p.projectileCount += 1;
    },
  },
];

export function getPerkById(id: string): Perk | undefined {
  return PERKS.find((p) => p.id === id);
}

// Samples PERK_OFFER_COUNT distinct perks without replacement.
export function rollPerkOffers(rng: () => number, count: number = PERK_OFFER_COUNT): Perk[] {
  const pool = [...PERKS];
  const result: Perk[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(rng() * pool.length);
    result.push(...pool.splice(index, 1));
  }
  return result;
}

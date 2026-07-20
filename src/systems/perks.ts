import { PERK_OFFER_COUNT } from "../constants";
import type { Perk } from "../types";

// v0.2: perks are player-level multipliers/bonuses applied on top of
// whichever weapon is equipped (damage/fire-rate/extra-projectiles), rather
// than being specific to a single weapon — so they stay relevant no matter
// what's picked up mid-run. No stacking caps or prerequisites yet — every
// perk can be picked repeatedly across a run if it's re-offered.
export const PERKS: Perk[] = [
  {
    id: "damage",
    name: "Blood Rage",
    description: "+25% weapon damage",
    apply: (p) => {
      p.damageMultiplier *= 1.25;
    },
  },
  {
    id: "firerate",
    name: "Frenzy",
    description: "-20% weapon cooldown",
    apply: (p) => {
      p.attackCooldownMultiplier *= 0.8;
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
    description: "+1 projectile per shot (multi-projectile weapons)",
    apply: (p) => {
      p.extraProjectiles += 1;
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

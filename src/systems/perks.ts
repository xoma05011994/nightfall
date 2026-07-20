import { PERK_MAX_RANK, PERK_OFFER_COUNT } from "../constants";
import type { Perk } from "../types";

// Perk design follows the genre's usual pattern (Vampire Survivors,
// Brotato): most perks are flat stat multipliers that work in any build,
// but a handful only pay off once paired with another perk, so builds
// reward committing to a direction rather than picking isolated stat sticks
// (per a quick survey of how those games structure synergies — see the
// commit message for sources). The explicit pairings in this pool:
//   - Ignite + Chain Lightning: passive, free once you have both — a chain
//     that arcs into an already-burning enemy deals double damage (see
//     systems/statusEffects.ts's applyOnHitEffects).
//   - Wildfire (this pool) needs Ignite to matter: it makes Deadly Aura
//     also apply the burn, but the burn's own damage/duration numbers still
//     come from Ignite. Wildfire alone (no Ignite) does nothing.
//   - Overload (this pool) needs Chain Lightning to matter: it makes Deadly
//     Aura also arc a lightning hit to the nearest enemy just past its
//     edge, using Chain Lightning's own damage number. Overload alone does
//     nothing.
//   - Vampiric (lifesteal) and Berserker (damage scales with missing hp)
//     pair naturally — Vampiric supplies the sustain that lets you safely
//     sit in Berserker's low-hp damage window.
//   - Momentum rewards builds that kill in bursts (Pierce/Aura/Chain
//     Lightning all hit multiple enemies per action).
//
// v0.5 — perks form an explicit dependency tree rather than an implicit one:
// Wildfire/Overload now declare `requires` so they can't even be OFFERED
// without their prerequisite already picked (previously they could be
// offered and just sit inert), and a new capstone, Storm Conduit, requires
// BOTH Ignite and Lightning — rewarding that combo with a second, deeper
// perk instead of just the passive double-damage-on-burning-target proc.
// Every perk is also capped at PERK_MAX_RANK (5) picks and drops out of the
// offer pool once maxed, so no single perk can be stacked forever.
export const PERKS: Perk[] = [
  {
    id: "damage",
    name: "Blood Rage",
    description: "+25% weapon damage",
    icon: '<polygon points="12,2 18,12 12,22 6,12" fill="currentColor"/>',
    apply: (p) => {
      p.damageMultiplier *= 1.25;
    },
  },
  {
    id: "firerate",
    name: "Frenzy",
    description: "-20% weapon cooldown",
    icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    apply: (p) => {
      p.attackCooldownMultiplier *= 0.8;
    },
  },
  {
    id: "maxhp",
    name: "Thick Hide",
    description: "+20 max HP, heals the same amount",
    icon: '<polygon points="12,2 20,6 20,13 12,22 4,13 4,6" fill="none" stroke="currentColor" stroke-width="2"/>',
    apply: (p) => {
      p.maxHp += 20;
      p.hp += 20;
    },
  },
  {
    id: "speed",
    name: "Adrenaline",
    description: "+15% move speed",
    icon: '<polyline points="6,15 12,9 18,15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="6,20 12,14 18,20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    apply: (p) => {
      p.moveSpeed *= 1.15;
    },
  },
  {
    id: "multishot",
    name: "Split Shot",
    description: "+1 projectile per shot (multi-projectile weapons)",
    icon: '<line x1="7" y1="20" x2="7" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="20" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="20" x2="17" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    apply: (p) => {
      p.extraProjectiles += 1;
    },
  },
  {
    id: "pierce",
    name: "Impaler",
    description: "Projectiles pierce through 1 extra enemy",
    icon: '<circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><line x1="2" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><polyline points="17,8 22,12 17,16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    apply: (p) => {
      p.pierce += 1;
    },
  },
  {
    id: "ignite",
    name: "Ignite",
    description: "Hits set enemies ablaze for damage over time",
    icon: '<polygon points="12,2 16,10 20,14 16,22 8,22 4,14 8,10" fill="currentColor"/>',
    apply: (p) => {
      p.igniteDamagePerTick += 4;
      p.igniteDurationMs = 3000;
    },
  },
  {
    id: "lightning",
    name: "Chain Lightning",
    description: "Hits arc to the nearest other enemy for bonus damage",
    icon: '<polygon points="13,2 4,14 11,14 9,22 20,10 13,10" fill="currentColor"/>',
    apply: (p) => {
      p.lightningChainDamage += 10;
      p.lightningChainRadius = 180;
    },
  },
  {
    id: "aura",
    name: "Deadly Aura",
    description: "Continuously damages enemies close to you",
    icon: '<circle cx="12" cy="12" r="2.5" fill="currentColor"/><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>',
    apply: (p) => {
      p.auraDamagePerTick += 6;
      p.auraRadius = Math.max(p.auraRadius, 110);
    },
  },
  {
    id: "vampiric",
    name: "Vampiric",
    description: "Heal for a fraction of all damage you deal",
    icon: '<circle cx="12" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="9,14 11,14 10,19" fill="currentColor"/><polygon points="13,14 15,14 14,19" fill="currentColor"/>',
    apply: (p) => {
      p.lifeStealPercent += 0.08;
    },
  },
  {
    id: "berserker",
    name: "Berserker",
    description: "Weapon damage rises the lower your HP gets (up to +25%)",
    icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="9,7 13,11 9,13 15,17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    apply: (p) => {
      p.berserkerIntensity += 0.25;
    },
  },
  {
    id: "momentum",
    name: "Momentum",
    description: "Kills briefly speed up your weapon, stacking up to 5x",
    icon: '<polyline points="3,7 9,12 3,17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="10,7 16,12 10,17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/><polyline points="17,7 22,12 17,17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>',
    apply: (p) => {
      p.momentumFireRatePerStack += 0.03;
    },
  },
  {
    id: "wildfire",
    name: "Wildfire",
    description: "Deadly Aura also ignites — requires Ignite",
    icon: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/><polygon points="12,7 14.5,12 17,14 14.5,19 9.5,19 7,14 9.5,12" fill="currentColor"/>',
    requires: ["ignite"],
    apply: (p) => {
      p.auraAppliesIgnite = true;
    },
  },
  {
    id: "overload",
    name: "Overload",
    description: "Deadly Aura also arcs lightning — requires Chain Lightning",
    icon: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5"/><polygon points="13,5 7,13 11,13 10,19 17,11 13,11" fill="currentColor"/>',
    requires: ["lightning"],
    apply: (p) => {
      p.auraTriggersLightning = true;
    },
  },
  {
    id: "greed",
    name: "Greed",
    description: "+30% pickup radius, +20% gold from all sources",
    icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="12,7 16,11 12,17 8,11" fill="currentColor" opacity="0.8"/>',
    apply: (p) => {
      p.pickupRadius *= 1.3;
      p.goldMultiplier += 0.2;
    },
  },
  {
    id: "stormConduit",
    name: "Storm Conduit",
    description: "Chain Lightning hits harder and arcs further — requires Ignite and Chain Lightning",
    icon: '<polygon points="13,2 4,14 11,14 9,22 20,10 13,10" fill="currentColor"/><polygon points="12,2 16,10 20,14 16,22 8,22 4,14 8,10" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.5"/>',
    requires: ["ignite", "lightning"],
    apply: (p) => {
      p.lightningChainDamage += 14;
      p.lightningChainRadius += 60;
    },
  },
];

export function getPerkById(id: string): Perk | undefined {
  return PERKS.find((p) => p.id === id);
}

// Samples PERK_OFFER_COUNT distinct perks without replacement, excluding any
// perk whose prerequisites (`requires`) aren't fully met yet, or that's
// already been picked PERK_MAX_RANK times.
export function rollPerkOffers(rng: () => number, picked: { perk: Perk; count: number }[] = [], count: number = PERK_OFFER_COUNT): Perk[] {
  const pickedIds = new Set(picked.map((p) => p.perk.id));
  const rankById = new Map(picked.map((p) => [p.perk.id, p.count]));

  const pool = PERKS.filter((perk) => {
    if ((rankById.get(perk.id) ?? 0) >= PERK_MAX_RANK) return false;
    if (perk.requires && !perk.requires.every((id) => pickedIds.has(id))) return false;
    return true;
  });

  const result: Perk[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(rng() * pool.length);
    result.push(...pool.splice(index, 1));
  }
  return result;
}

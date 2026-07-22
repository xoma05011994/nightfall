import { EXTRA_WEAPON_SLOT_COST, MAX_WEAPON_UPGRADE_LEVEL, STARTING_PERK_COST, getWeaponUpgradeLevel, upgradeCost, type PlayerProfile } from "@nightfall/shared/systems/profile";
import { PERKS } from "@nightfall/shared/systems/perks";
import { WEAPON_DEFS } from "@nightfall/shared/systems/weapons";
import type { WeaponId } from "@nightfall/shared/types";

const ALL_WEAPON_IDS: WeaponId[] = ["pistol", "shotgun", "assaultRifle", "rpg", "laserCannon", "flamethrower"];

// Only tier-0, solo-usable perks make sense to own from the start of every
// run — anything with `requires` would sit inert without its prerequisites
// also picked, and multiplayer-only/dead-teammate-gated perks (Chain Link,
// Revive) have no meaning in a run that starts alone.
const STARTING_PERK_ELIGIBLE = PERKS.filter((p) => !(p.requires && p.requires.length > 0) && !p.minPartySize && !p.requiresDeadTeammate);

export interface ShopCallbacks {
  onUpgradeWeapon: (weaponId: WeaponId) => void;
  onBuyStartingPerk: (perkId: string) => void;
  onBuyExtraWeaponSlot: () => void;
  onBack: () => void;
}

export class ShopScreen {
  private root: HTMLDivElement;

  constructor(
    container: HTMLElement,
    private callbacks: ShopCallbacks,
  ) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen shop-screen";
    this.root.style.display = "none";
    container.appendChild(this.root);
  }

  show(profile: PlayerProfile): void {
    const weaponRows = ALL_WEAPON_IDS.map((id) => {
      const def = WEAPON_DEFS[id];
      const level = getWeaponUpgradeLevel(profile, id);
      const maxed = level >= MAX_WEAPON_UPGRADE_LEVEL;
      const cost = upgradeCost(level);
      const affordable = profile.coins >= cost;
      return `
        <div class="shop-row">
          <div class="shop-row-name">${def.name}</div>
          <div class="shop-row-level">Lv ${level} / ${MAX_WEAPON_UPGRADE_LEVEL}</div>
          <button class="shop-upgrade-button" data-weapon="${id}" ${maxed || !affordable ? "disabled" : ""}>
            ${maxed ? "MAXED" : `+10% dmg — ${cost}g`}
          </button>
        </div>
      `;
    }).join("");

    const perkRows = STARTING_PERK_ELIGIBLE.map((perk) => {
      const owned = profile.startingPerkIds.includes(perk.id);
      const affordable = profile.coins >= STARTING_PERK_COST;
      return `
        <div class="shop-row">
          <div class="shop-row-name">${perk.name}</div>
          <div class="shop-row-level shop-row-desc">${perk.description}</div>
          <button class="shop-starting-perk-button" data-perk="${perk.id}" ${owned || !affordable ? "disabled" : ""}>
            ${owned ? "OWNED" : `Start with it — ${STARTING_PERK_COST}g`}
          </button>
        </div>
      `;
    }).join("");

    const slotAffordable = profile.coins >= EXTRA_WEAPON_SLOT_COST;
    const slotRow = `
      <div class="shop-row">
        <div class="shop-row-name">4th Weapon Slot</div>
        <div class="shop-row-level shop-row-desc">Carry one more weapon at once, every run</div>
        <button class="shop-slot-button" ${profile.weaponSlotUnlocked || !slotAffordable ? "disabled" : ""}>
          ${profile.weaponSlotUnlocked ? "OWNED" : `Unlock — ${EXTRA_WEAPON_SLOT_COST}g`}
        </button>
      </div>
    `;

    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 40px; letter-spacing: 4px;">ARMORY</h1>
      <p class="overlay-subtitle">Gold: ${profile.coins} — every purchase here applies to every future run, Endless and Adventure alike.</p>
      <div class="shop-scroll">
        <h2 class="shop-section-title">Weapon Upgrades</h2>
        <div class="shop-rows">${weaponRows}</div>
        <h2 class="shop-section-title">Start With a Perk</h2>
        <div class="shop-rows">${perkRows}</div>
        <h2 class="shop-section-title">Loadout</h2>
        <div class="shop-rows">${slotRow}</div>
      </div>
      <button class="overlay-button shop-back-button">BACK</button>
    `;
    this.root.querySelectorAll<HTMLButtonElement>(".shop-upgrade-button").forEach((btn) => {
      btn.addEventListener("click", () => this.callbacks.onUpgradeWeapon(btn.dataset.weapon as WeaponId));
    });
    this.root.querySelectorAll<HTMLButtonElement>(".shop-starting-perk-button").forEach((btn) => {
      btn.addEventListener("click", () => this.callbacks.onBuyStartingPerk(btn.dataset.perk!));
    });
    this.root.querySelector(".shop-slot-button")?.addEventListener("click", () => this.callbacks.onBuyExtraWeaponSlot());
    this.root.querySelector(".shop-back-button")!.addEventListener("click", this.callbacks.onBack);
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

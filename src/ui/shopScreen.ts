import { MAX_WEAPON_UPGRADE_LEVEL, getWeaponUpgradeLevel, upgradeCost, type PlayerProfile } from "../systems/profile";
import { WEAPON_DEFS } from "../systems/weapons";
import type { WeaponId } from "../types";

const ALL_WEAPON_IDS: WeaponId[] = ["pistol", "shotgun", "assaultRifle", "rpg", "laserCannon", "flamethrower"];

export class ShopScreen {
  private root: HTMLDivElement;

  constructor(container: HTMLElement, private onUpgrade: (weaponId: WeaponId) => void, private onBack: () => void) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    container.appendChild(this.root);
  }

  show(profile: PlayerProfile): void {
    const rows = ALL_WEAPON_IDS.map((id) => {
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

    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 40px; letter-spacing: 4px;">ARMORY</h1>
      <p class="overlay-subtitle">Gold: ${profile.coins} — upgrades apply in Adventure mode only.</p>
      <div class="shop-rows">${rows}</div>
      <button class="overlay-button shop-back-button">BACK</button>
    `;
    this.root.querySelectorAll<HTMLButtonElement>(".shop-upgrade-button").forEach((btn) => {
      btn.addEventListener("click", () => this.onUpgrade(btn.dataset.weapon as WeaponId));
    });
    this.root.querySelector(".shop-back-button")!.addEventListener("click", this.onBack);
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

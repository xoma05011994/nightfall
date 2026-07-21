import { WEAPON_MAX_LEVEL } from "@nightfall/shared/constants";
import { PERKS } from "@nightfall/shared/systems/perks";
import { DROPPABLE_WEAPON_IDS, WEAPON_DEFS } from "@nightfall/shared/systems/weapons";
import type { EnemyType, Perk, WeaponId } from "@nightfall/shared/types";

export interface SandboxHandlers {
  onSpawnEnemy: (type: EnemyType) => void;
  onClearEnemies: () => void;
  onEquipWeapon: (weaponId: WeaponId, level: number) => void;
  onApplyPerk: (perk: Perk) => void;
}

const ENEMY_TYPES: EnemyType[] = ["grunt", "brute", "shooter", "boss"];

// Always-visible dev panel for Sandbox mode: spawn any enemy type, equip any
// weapon at any level, apply any perk instantly (bypassing the normal
// offer/prerequisite flow), and read off actual damage dealt per frame —
// exists to let weapon/perk numbers be checked directly rather than inferred
// from a real run.
export class SandboxPanel {
  private root: HTMLDivElement;
  private levelValueEl: HTMLSpanElement;
  private damageReadoutEl: HTMLDivElement;
  private level = 1;
  private pendingWeaponId: WeaponId = DROPPABLE_WEAPON_IDS[0]!;

  constructor(container: HTMLElement, handlers: SandboxHandlers) {
    this.root = document.createElement("div");
    this.root.className = "sandbox-panel";
    this.root.style.display = "none";

    const enemyButtons = ENEMY_TYPES.map((type) => `<button class="sandbox-btn" data-enemy="${type}">${type}</button>`).join("");
    const weaponButtons = DROPPABLE_WEAPON_IDS.map((id) => `<button class="sandbox-btn" data-weapon="${id}">${WEAPON_DEFS[id].name}</button>`).join("");
    const perkButtons = PERKS.map((perk) => `<button class="sandbox-btn sandbox-perk-btn" data-perk="${perk.id}" title="${perk.description}">${perk.name}</button>`).join("");

    this.root.innerHTML = `
      <div class="sandbox-section">
        <div class="sandbox-section-title">Enemies</div>
        <div class="sandbox-buttons">${enemyButtons}</div>
        <button class="sandbox-btn sandbox-clear-btn" data-clear-enemies>Clear Enemies</button>
      </div>
      <div class="sandbox-section">
        <div class="sandbox-section-title">Weapon (slot 2)</div>
        <div class="sandbox-level-row">
          <button class="sandbox-btn sandbox-level-btn" data-level-delta="-1">-</button>
          <span class="sandbox-level-value">Lv 1</span>
          <button class="sandbox-btn sandbox-level-btn" data-level-delta="1">+</button>
          <button class="sandbox-btn sandbox-level-btn" data-level-max>MAX</button>
        </div>
        <div class="sandbox-buttons">${weaponButtons}</div>
      </div>
      <div class="sandbox-section">
        <div class="sandbox-section-title">Perks (instant, no gating)</div>
        <div class="sandbox-buttons sandbox-perk-grid">${perkButtons}</div>
      </div>
      <div class="sandbox-section">
        <div class="sandbox-section-title">Damage this frame</div>
        <div class="sandbox-damage-readout">—</div>
      </div>
    `;

    this.levelValueEl = this.root.querySelector(".sandbox-level-value")!;
    this.damageReadoutEl = this.root.querySelector(".sandbox-damage-readout")!;

    this.root.querySelectorAll<HTMLButtonElement>("[data-enemy]").forEach((btn) => {
      btn.addEventListener("click", () => handlers.onSpawnEnemy(btn.dataset.enemy as EnemyType));
    });
    this.root.querySelector("[data-clear-enemies]")!.addEventListener("click", handlers.onClearEnemies);
    this.root.querySelectorAll<HTMLButtonElement>("[data-weapon]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.pendingWeaponId = btn.dataset.weapon as WeaponId;
        handlers.onEquipWeapon(this.pendingWeaponId, this.level);
      });
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-level-delta]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.level = Math.max(1, Math.min(WEAPON_MAX_LEVEL, this.level + Number(btn.dataset.levelDelta)));
        this.updateLevelDisplay();
      });
    });
    this.root.querySelector("[data-level-max]")!.addEventListener("click", () => {
      this.level = WEAPON_MAX_LEVEL;
      this.updateLevelDisplay();
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-perk]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const perk = PERKS.find((p) => p.id === btn.dataset.perk);
        if (perk) handlers.onApplyPerk(perk);
      });
    });

    container.appendChild(this.root);
  }

  private updateLevelDisplay(): void {
    this.levelValueEl.textContent = `Lv ${this.level}`;
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "flex" : "none";
  }

  setDamageReadout(text: string): void {
    this.damageReadoutEl.textContent = text;
  }
}

import type { Perk } from "../types";

export class PerkTray {
  private root: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "perk-tray";
    container.appendChild(this.root);
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "flex" : "none";
  }

  update(picked: { perk: Perk; count: number }[]): void {
    this.root.innerHTML = picked
      .map(
        ({ perk, count }) => `
          <div class="perk-tray-item">
            <span class="perk-tray-name">${perk.name}</span>
            ${count > 1 ? `<span class="perk-tray-count">x${count}</span>` : ""}
          </div>
        `,
      )
      .join("");
  }
}

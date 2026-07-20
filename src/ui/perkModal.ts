import type { Perk } from "../types";

export class PerkModal {
  private root: HTMLDivElement;
  private onSelect: ((perk: Perk) => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 40px; letter-spacing: 4px;">A GIFT FROM THE DARK</h1>
      <div class="perk-cards"></div>
    `;
    container.appendChild(this.root);
  }

  show(offers: Perk[], onSelect: (perk: Perk) => void): void {
    this.onSelect = onSelect;
    const cardsEl = this.root.querySelector(".perk-cards")!;
    cardsEl.innerHTML = "";
    for (const perk of offers) {
      const card = document.createElement("div");
      card.className = "perk-card";
      card.innerHTML = `<svg class="perk-card-icon" viewBox="0 0 24 24">${perk.icon}</svg><div class="perk-card-name">${perk.name}</div><div class="perk-card-desc">${perk.description}</div>`;
      card.addEventListener("click", () => {
        this.hide();
        this.onSelect?.(perk);
      });
      cardsEl.appendChild(card);
    }
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

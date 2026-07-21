export interface WeaponPromptChoiceInfo {
  incomingName: string;
  slot2Name: string;
  slot3Name: string;
}

export class WeaponPromptModal {
  private root: HTMLDivElement;
  private onChoice: ((choice: 1 | 2 | null) => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    container.appendChild(this.root);
  }

  show(info: WeaponPromptChoiceInfo, onChoice: (choice: 1 | 2 | null) => void): void {
    this.onChoice = onChoice;
    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 36px; letter-spacing: 3px;">FOUND: ${info.incomingName}</h1>
      <p class="overlay-subtitle">Both extra weapon slots are full. Swap one out, or leave it behind.</p>
      <div class="perk-cards">
        <div class="perk-card" data-choice="1"><div class="perk-card-name">Replace Slot 2</div><div class="perk-card-desc">${info.slot2Name}</div></div>
        <div class="perk-card" data-choice="2"><div class="perk-card-name">Replace Slot 3</div><div class="perk-card-desc">${info.slot3Name}</div></div>
        <div class="perk-card" data-choice="decline"><div class="perk-card-name">Leave It</div><div class="perk-card-desc">Keep current weapons</div></div>
      </div>
    `;
    this.root.querySelectorAll<HTMLDivElement>(".perk-card").forEach((card) => {
      card.addEventListener("click", () => {
        const choice = card.dataset.choice;
        this.hide();
        this.onChoice?.(choice === "1" ? 1 : choice === "2" ? 2 : null);
      });
    });
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

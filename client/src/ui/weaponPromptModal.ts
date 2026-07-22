export interface WeaponPromptChoiceInfo {
  incomingName: string;
  // One entry per currently-held droppable slot (all of them, since this
  // prompt only ever fires once every droppable slot is full) — 2 entries
  // normally, 3 once the Armory's extra weapon slot is bought.
  heldSlots: { slotIndex: 1 | 2 | 3; name: string }[];
}

export class WeaponPromptModal {
  private root: HTMLDivElement;
  private onChoice: ((choice: 1 | 2 | 3 | null) => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    container.appendChild(this.root);
  }

  show(info: WeaponPromptChoiceInfo, onChoice: (choice: 1 | 2 | 3 | null) => void): void {
    this.onChoice = onChoice;
    const slotWord = info.heldSlots.length > 2 ? "All three" : "Both";
    const swapCards = info.heldSlots
      .map((s) => `<div class="perk-card" data-choice="${s.slotIndex}"><div class="perk-card-name">Replace Slot ${s.slotIndex + 1}</div><div class="perk-card-desc">${s.name}</div></div>`)
      .join("");
    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 36px; letter-spacing: 3px;">FOUND: ${info.incomingName}</h1>
      <p class="overlay-subtitle">${slotWord} extra weapon slots are full. Swap one out, or leave it behind.</p>
      <div class="perk-cards">
        ${swapCards}
        <div class="perk-card" data-choice="decline"><div class="perk-card-name">Leave It</div><div class="perk-card-desc">Keep current weapons</div></div>
      </div>
    `;
    this.root.querySelectorAll<HTMLDivElement>(".perk-card").forEach((card) => {
      card.addEventListener("click", () => {
        const choice = card.dataset.choice;
        this.hide();
        this.onChoice?.(choice === "1" ? 1 : choice === "2" ? 2 : choice === "3" ? 3 : null);
      });
    });
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

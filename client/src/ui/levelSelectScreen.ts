import type { LevelDef } from "@nightfall/shared/types";

export class LevelSelectScreen {
  private root: HTMLDivElement;
  private levels: LevelDef[];
  private grid: Element;
  private onSelect: (level: LevelDef) => void;

  constructor(container: HTMLElement, levels: LevelDef[], onSelect: (level: LevelDef) => void, onBack: () => void) {
    this.levels = levels;
    this.onSelect = onSelect;
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 40px; letter-spacing: 4px;">CHOOSE YOUR TRIAL</h1>
      <p class="overlay-subtitle">Survive the horde. Bosses arrive at 3:00 and 6:00 — defeat the second boss to win and unlock the next trial.</p>
      <div class="level-grid"></div>
      <button class="overlay-button level-back-button">BACK</button>
    `;
    this.grid = this.root.querySelector(".level-grid")!;
    this.root.querySelector(".level-back-button")!.addEventListener("click", onBack);
    container.appendChild(this.root);
  }

  // `unlockedLevelIds` gates which cards are playable — only levels already
  // unlocked in the profile respond to clicks; the rest render locked.
  show(unlockedLevelIds: string[]): void {
    this.grid.innerHTML = "";
    for (const level of this.levels) {
      const unlocked = unlockedLevelIds.includes(level.id);
      const card = document.createElement("div");
      card.className = unlocked ? "level-card" : "level-card locked";
      card.innerHTML = `
        <div class="level-card-swatch" style="background: rgb(${level.palette.splatterRGB})"></div>
        <div class="level-card-name">${unlocked ? level.name : "???"}</div>
        ${unlocked ? "" : '<div class="level-card-lock">LOCKED</div>'}
      `;
      if (unlocked) card.addEventListener("click", () => this.onSelect(level));
      this.grid.appendChild(card);
    }
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

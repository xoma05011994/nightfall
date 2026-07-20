import type { LevelDef } from "../types";

export class LevelSelectScreen {
  private root: HTMLDivElement;

  constructor(container: HTMLElement, levels: LevelDef[], onSelect: (level: LevelDef) => void, onBack: () => void) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 40px; letter-spacing: 4px;">CHOOSE YOUR TRIAL</h1>
      <p class="overlay-subtitle">Survive 6 minutes. Bosses arrive at 3:00 and 6:00.</p>
      <div class="level-grid"></div>
      <button class="overlay-button level-back-button">BACK</button>
    `;
    const grid = this.root.querySelector(".level-grid")!;
    for (const level of levels) {
      const card = document.createElement("div");
      card.className = "level-card";
      card.innerHTML = `
        <div class="level-card-swatch" style="background: rgb(${level.palette.splatterRGB})"></div>
        <div class="level-card-name">${level.name}</div>
      `;
      card.addEventListener("click", () => onSelect(level));
      grid.appendChild(card);
    }
    this.root.querySelector(".level-back-button")!.addEventListener("click", onBack);
    container.appendChild(this.root);
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

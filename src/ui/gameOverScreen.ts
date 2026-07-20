export interface GameOverStats {
  elapsedMs: number;
  level: number;
  kills: number;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export class GameOverScreen {
  private root: HTMLDivElement;

  constructor(container: HTMLElement, private onRestart: () => void) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    container.appendChild(this.root);
  }

  show(stats: GameOverStats): void {
    this.root.innerHTML = `
      <h1 class="overlay-title">YOU DIED</h1>
      <div class="overlay-stats">
        Survived: ${formatTime(stats.elapsedMs)}<br />
        Level reached: ${stats.level}<br />
        Kills: ${stats.kills}
      </div>
      <button class="overlay-button">TRY AGAIN</button>
    `;
    this.root.querySelector("button")!.addEventListener("click", this.onRestart);
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

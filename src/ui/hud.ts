export interface HudData {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  elapsedMs: number;
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

export class Hud {
  private root: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private xpFill: HTMLDivElement;
  private levelEl: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private killsEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="hud-top-left">
        <div class="hud-label">VITALITY</div>
        <div class="hud-bar-track"><div class="hud-bar-fill hp" style="width:100%"></div></div>
        <div class="hud-label">SOUL ESSENCE</div>
        <div class="hud-bar-track"><div class="hud-bar-fill xp" style="width:0%"></div></div>
        <div class="hud-level">LV 1</div>
      </div>
      <div class="hud-top-right">
        <div class="hud-timer">00:00</div>
        <div class="hud-kills">Kills: 0</div>
      </div>
    `;
    container.appendChild(this.root);

    this.hpFill = this.root.querySelector(".hp")!;
    this.xpFill = this.root.querySelector(".xp")!;
    this.levelEl = this.root.querySelector(".hud-level")!;
    this.timerEl = this.root.querySelector(".hud-timer")!;
    this.killsEl = this.root.querySelector(".hud-kills")!;
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "block" : "none";
  }

  update(data: HudData): void {
    this.hpFill.style.width = `${Math.max(0, (data.hp / data.maxHp) * 100)}%`;
    this.xpFill.style.width = `${Math.min(100, (data.xp / data.xpToNext) * 100)}%`;
    this.levelEl.textContent = `LV ${data.level}`;
    this.timerEl.textContent = formatTime(data.elapsedMs);
    this.killsEl.textContent = `Kills: ${data.kills}`;
  }
}

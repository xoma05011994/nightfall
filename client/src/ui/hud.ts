export interface HudWeaponSlot {
  name: string | null;
  equipped: boolean;
  icon: string | null;
  level: number;
  maxed: boolean;
}

export interface HudData {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  elapsedMs: number;
  kills: number;
  gold: number;
  slots: [HudWeaponSlot, HudWeaponSlot, HudWeaponSlot];
  ammo: number;
  magazineSize: number;
  reloading: boolean;
  reloadRatio: number; // 0..1, fraction of reload remaining
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
  private goldEl: HTMLDivElement;
  private slotEls: HTMLDivElement[];
  private ammoTextEl: HTMLDivElement;
  private ammoBarFill: HTMLDivElement;

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
        <div class="hud-gold">Gold: 0</div>
      </div>
      <div class="hud-bottom-center">
        <div class="hud-weapon-slots">
          <div class="weapon-slot" data-slot="0"><span class="weapon-slot-key">1</span><img class="weapon-slot-icon" alt="" /><span class="weapon-slot-name">Sidearm</span><span class="weapon-slot-level"></span></div>
          <div class="weapon-slot" data-slot="1"><span class="weapon-slot-key">2</span><img class="weapon-slot-icon" alt="" /><span class="weapon-slot-name">—</span><span class="weapon-slot-level"></span></div>
          <div class="weapon-slot" data-slot="2"><span class="weapon-slot-key">3</span><img class="weapon-slot-icon" alt="" /><span class="weapon-slot-name">—</span><span class="weapon-slot-level"></span></div>
        </div>
        <div class="hud-ammo-track"><div class="hud-ammo-fill" style="width:100%"></div></div>
        <div class="hud-ammo-text">10 / 10</div>
      </div>
    `;
    container.appendChild(this.root);

    this.hpFill = this.root.querySelector(".hp")!;
    this.xpFill = this.root.querySelector(".xp")!;
    this.levelEl = this.root.querySelector(".hud-level")!;
    this.timerEl = this.root.querySelector(".hud-timer")!;
    this.killsEl = this.root.querySelector(".hud-kills")!;
    this.goldEl = this.root.querySelector(".hud-gold")!;
    this.slotEls = Array.from(this.root.querySelectorAll(".weapon-slot"));
    this.ammoTextEl = this.root.querySelector(".hud-ammo-text")!;
    this.ammoBarFill = this.root.querySelector(".hud-ammo-fill")!;
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
    this.goldEl.textContent = `Gold: ${data.gold}`;

    data.slots.forEach((slot, i) => {
      const el = this.slotEls[i];
      if (!el) return;
      el.classList.toggle("equipped", slot.equipped);
      el.classList.toggle("empty", slot.name === null);
      el.classList.toggle("maxed", slot.maxed);
      const nameEl = el.querySelector(".weapon-slot-name");
      if (nameEl) nameEl.textContent = slot.name ?? "—";
      const iconEl = el.querySelector(".weapon-slot-icon") as HTMLImageElement | null;
      if (iconEl) {
        iconEl.style.visibility = slot.icon ? "visible" : "hidden";
        if (slot.icon && iconEl.src !== new URL(slot.icon, location.href).href) iconEl.src = slot.icon;
      }
      const levelEl = el.querySelector(".weapon-slot-level");
      if (levelEl) levelEl.textContent = slot.name === null ? "" : slot.maxed ? "MAX" : `Lv${slot.level}`;
    });

    if (data.reloading) {
      this.ammoTextEl.textContent = "RELOADING…";
      this.ammoBarFill.style.width = `${(1 - data.reloadRatio) * 100}%`;
      this.ammoBarFill.classList.add("reloading");
    } else {
      this.ammoTextEl.textContent = `${data.ammo} / ${data.magazineSize}`;
      this.ammoBarFill.style.width = `${(data.ammo / data.magazineSize) * 100}%`;
      this.ammoBarFill.classList.remove("reloading");
    }
  }
}

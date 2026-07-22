export interface MainMenuHandlers {
  onEndless: () => void;
  onAdventure: () => void;
  onShop: () => void;
  onSandbox: () => void;
  onPerkTree: () => void;
  onMultiplayer: () => void;
  // Damage-numbers toggle (persisted to the profile by the caller) — the
  // menu just reflects/reports it, it doesn't own the setting itself.
  getShowDamageNumbers: () => boolean;
  onToggleDamageNumbers: (value: boolean) => void;
}

// SANDBOX and PERK TREE are dev/inspection tools, hidden from the menu until
// the player types this secret while the menu is up (a classic cheat-code
// reveal). Persisted for the session once unlocked.
const SECRET_CODE = "qwerty";

export class MainMenu {
  private root: HTMLDivElement;
  private secretButtons: HTMLElement[];
  private typedBuffer = "";
  private unlocked = false;

  constructor(container: HTMLElement, handlers: MainMenuHandlers) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.innerHTML = `
      <h1 class="overlay-title mm-title">NIGHTFALL</h1>
      <p class="overlay-subtitle mm-subtitle">
        Something is coming for you in the dark. WASD to move, mouse to aim
        and fire. Survive.
      </p>
      <div class="menu-buttons">
        <button class="mm-nav-button" data-action="endless">ENDLESS</button>
        <button class="mm-nav-button" data-action="adventure">ADVENTURE</button>
        <button class="mm-nav-button" data-action="multiplayer">MULTIPLAYER</button>
        <button class="mm-nav-button" data-action="shop">ARMORY</button>
        <button class="mm-nav-button" data-action="sandbox" style="display:none">SANDBOX</button>
        <button class="mm-nav-button" data-action="perkTree" style="display:none">PERK TREE</button>
      </div>
      <label class="mm-toggle">
        <input type="checkbox" data-action="damageNumbers" />
        <span>Damage Numbers</span>
      </label>
    `;
    container.appendChild(this.root);
    this.root.querySelector('[data-action="endless"]')!.addEventListener("click", handlers.onEndless);
    this.root.querySelector('[data-action="adventure"]')!.addEventListener("click", handlers.onAdventure);
    this.root.querySelector('[data-action="multiplayer"]')!.addEventListener("click", handlers.onMultiplayer);
    this.root.querySelector('[data-action="shop"]')!.addEventListener("click", handlers.onShop);
    this.root.querySelector('[data-action="sandbox"]')!.addEventListener("click", handlers.onSandbox);
    this.root.querySelector('[data-action="perkTree"]')!.addEventListener("click", handlers.onPerkTree);

    const damageNumbersCheckbox = this.root.querySelector<HTMLInputElement>('[data-action="damageNumbers"]')!;
    damageNumbersCheckbox.checked = handlers.getShowDamageNumbers();
    damageNumbersCheckbox.addEventListener("change", () => handlers.onToggleDamageNumbers(damageNumbersCheckbox.checked));

    this.secretButtons = [this.root.querySelector('[data-action="sandbox"]')!, this.root.querySelector('[data-action="perkTree"]')!];

    window.addEventListener("keydown", (e) => {
      // Only listen while the menu is actually up, and ignore modifier/long
      // keys so only real character typing advances the sequence.
      if (this.unlocked || this.root.style.display === "none" || e.key.length !== 1) return;
      this.typedBuffer = (this.typedBuffer + e.key.toLowerCase()).slice(-SECRET_CODE.length);
      if (this.typedBuffer === SECRET_CODE) this.reveal();
    });
  }

  private reveal(): void {
    this.unlocked = true;
    for (const btn of this.secretButtons) btn.style.display = "";
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

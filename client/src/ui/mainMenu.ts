export interface MainMenuHandlers {
  onEndless: () => void;
  onAdventure: () => void;
  onShop: () => void;
  onSandbox: () => void;
  onPerkTree: () => void;
  onMultiplayer: () => void;
}

export class MainMenu {
  private root: HTMLDivElement;

  constructor(container: HTMLElement, handlers: MainMenuHandlers) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.innerHTML = `
      <h1 class="overlay-title">NIGHTFALL</h1>
      <p class="overlay-subtitle">
        Something is coming for you in the dark. WASD to move, mouse to aim
        and fire. Survive.
      </p>
      <div class="menu-buttons">
        <button class="overlay-button" data-action="endless">ENDLESS</button>
        <button class="overlay-button" data-action="adventure">ADVENTURE</button>
        <button class="overlay-button" data-action="multiplayer">MULTIPLAYER</button>
        <button class="overlay-button" data-action="shop">ARMORY</button>
        <button class="overlay-button" data-action="sandbox">SANDBOX</button>
        <button class="overlay-button" data-action="perkTree">PERK TREE</button>
      </div>
    `;
    container.appendChild(this.root);
    this.root.querySelector('[data-action="endless"]')!.addEventListener("click", handlers.onEndless);
    this.root.querySelector('[data-action="adventure"]')!.addEventListener("click", handlers.onAdventure);
    this.root.querySelector('[data-action="multiplayer"]')!.addEventListener("click", handlers.onMultiplayer);
    this.root.querySelector('[data-action="shop"]')!.addEventListener("click", handlers.onShop);
    this.root.querySelector('[data-action="sandbox"]')!.addEventListener("click", handlers.onSandbox);
    this.root.querySelector('[data-action="perkTree"]')!.addEventListener("click", handlers.onPerkTree);
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

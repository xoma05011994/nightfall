export class PauseModal {
  private root: HTMLDivElement;

  // `title` defaults to solo's "PAUSED" — co-op reuses this component for
  // its leave-confirm dialog too, where that word would be misleading since
  // the shared world keeps running for the rest of the party regardless.
  constructor(container: HTMLElement, onContinue: () => void, onLeaveToMenu: () => void, title = "PAUSED") {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 44px; letter-spacing: 6px;">${title}</h1>
      <div class="menu-buttons">
        <button class="overlay-button" data-action="continue">CONTINUE</button>
        <button class="overlay-button" data-action="leave">LEAVE TO MENU</button>
      </div>
    `;
    this.root.querySelector('[data-action="continue"]')!.addEventListener("click", onContinue);
    this.root.querySelector('[data-action="leave"]')!.addEventListener("click", onLeaveToMenu);
    container.appendChild(this.root);
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

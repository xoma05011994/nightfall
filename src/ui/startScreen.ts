export class StartScreen {
  private root: HTMLDivElement;

  constructor(container: HTMLElement, onStart: () => void) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.innerHTML = `
      <h1 class="overlay-title">NIGHTFALL</h1>
      <p class="overlay-subtitle">
        Something is coming for you in the dark. WASD to move — your weapon
        fires on its own. Survive as long as you can.
      </p>
      <button class="overlay-button">ENTER THE DARK</button>
    `;
    container.appendChild(this.root);
    this.root.querySelector("button")!.addEventListener("click", onStart);
  }

  hide(): void {
    this.root.style.display = "none";
  }

  show(): void {
    this.root.style.display = "flex";
  }
}

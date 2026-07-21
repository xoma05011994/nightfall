export interface MultiplayerScreenHandlers {
  onCreate: (displayName: string) => void;
  onJoin: (displayName: string, roomCode: string) => void;
  onBack: () => void;
}

function getOrCreateDisplayName(): string {
  const key = "nightfall-display-name";
  let name = localStorage.getItem(key);
  if (!name) {
    name = `Survivor${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem(key, name);
  }
  return name;
}

// Room-code lobby: create a room (shows the code to share) or join one by
// entering a code. Once connected, the room-code readout stays visible as a
// small always-on-top badge (see main.ts) rather than living in this screen,
// since this screen hides the moment the co-op run actually starts.
export class MultiplayerScreen {
  private root: HTMLDivElement;
  private nameInput: HTMLInputElement;
  private codeInput: HTMLInputElement;
  private errorEl: HTMLDivElement;

  constructor(container: HTMLElement, handlers: MultiplayerScreenHandlers) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 40px; letter-spacing: 4px;">MULTIPLAYER</h1>
      <p class="overlay-subtitle">Co-op Endless — up to 4 survivors, shared XP, no friendly fire.</p>
      <div class="mp-name-row">
        <label class="mp-label">NAME</label>
        <input type="text" class="mp-name-input" maxlength="16" />
      </div>
      <div class="menu-buttons">
        <button class="overlay-button" data-action="create">CREATE ROOM</button>
      </div>
      <div class="mp-join-row">
        <input type="text" class="mp-code-input" maxlength="6" placeholder="ROOM CODE" />
        <button class="overlay-button" data-action="join">JOIN</button>
      </div>
      <div class="mp-error"></div>
      <button class="overlay-button" data-action="back">BACK</button>
    `;
    this.nameInput = this.root.querySelector(".mp-name-input")!;
    this.codeInput = this.root.querySelector(".mp-code-input")!;
    this.errorEl = this.root.querySelector(".mp-error")!;
    this.nameInput.value = getOrCreateDisplayName();

    this.root.querySelector('[data-action="create"]')!.addEventListener("click", () => {
      this.saveName();
      this.clearError();
      handlers.onCreate(this.nameInput.value.trim() || "Survivor");
    });
    this.root.querySelector('[data-action="join"]')!.addEventListener("click", () => {
      this.saveName();
      this.clearError();
      const code = this.codeInput.value.trim().toUpperCase();
      if (!code) {
        this.showError("Enter a room code");
        return;
      }
      handlers.onJoin(this.nameInput.value.trim() || "Survivor", code);
    });
    this.root.querySelector('[data-action="back"]')!.addEventListener("click", handlers.onBack);
    container.appendChild(this.root);
  }

  private saveName(): void {
    const name = this.nameInput.value.trim();
    if (name) localStorage.setItem("nightfall-display-name", name);
  }

  showError(message: string): void {
    this.errorEl.textContent = message;
  }

  clearError(): void {
    this.errorEl.textContent = "";
  }

  show(): void {
    this.clearError();
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

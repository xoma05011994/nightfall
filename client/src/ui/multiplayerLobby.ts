export interface LobbyPlayer {
  id: string;
  displayName: string;
}

// Pre-game lobby: shown after creating/joining a room, while the party
// gathers. The host gets a START GAME button; everyone else sees a
// waiting message. Driven each frame from the server snapshot (players +
// hostId), so it live-updates as people join/leave.
export class MultiplayerLobby {
  private root: HTMLDivElement;
  private listEl: HTMLDivElement;
  private startBtn: HTMLButtonElement;
  private waitingEl: HTMLDivElement;

  constructor(container: HTMLElement, onStart: () => void) {
    this.root = document.createElement("div");
    this.root.className = "overlay-screen";
    this.root.style.display = "none";
    this.root.innerHTML = `
      <h1 class="overlay-title" style="font-size: 40px; letter-spacing: 4px;">LOBBY</h1>
      <p class="overlay-subtitle">Waiting for survivors to join. Share the room code above.</p>
      <div class="mp-lobby-list"></div>
      <button class="overlay-button mp-lobby-start">START GAME</button>
      <div class="mp-lobby-waiting">Waiting for the host to start…</div>
    `;
    this.listEl = this.root.querySelector(".mp-lobby-list")!;
    this.startBtn = this.root.querySelector(".mp-lobby-start")!;
    this.waitingEl = this.root.querySelector(".mp-lobby-waiting")!;
    this.startBtn.addEventListener("click", onStart);
    container.appendChild(this.root);
  }

  update(players: LobbyPlayer[], hostId: string, localId: string): void {
    this.listEl.innerHTML = players
      .map((p) => {
        const isHost = p.id === hostId;
        const isYou = p.id === localId;
        const tags = [isHost ? "HOST" : "", isYou ? "YOU" : ""].filter(Boolean).join(" · ");
        return `<div class="mp-lobby-player">${escapeHtml(p.displayName)}${tags ? ` <span class="mp-lobby-tag">${tags}</span>` : ""}</div>`;
      })
      .join("");
    const isLocalHost = localId === hostId;
    this.startBtn.style.display = isLocalHost ? "" : "none";
    this.waitingEl.style.display = isLocalHost ? "none" : "block";
  }

  show(): void {
    this.root.style.display = "flex";
  }

  hide(): void {
    this.root.style.display = "none";
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

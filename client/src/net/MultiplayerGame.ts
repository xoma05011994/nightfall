import { INPUT_SEND_HZ } from "@nightfall/shared/constants";
import type { ClientMessage, MatchSnapshot, ServerMessage } from "@nightfall/shared/multiplayer";
import type { Vec2 } from "@nightfall/shared/types";

// Local dev: plain Node server on Windows natively (no more WSL — dropping
// RivetKit dropped the native-binary requirement that needed it). Port 8080
// matches the server's own default (see server/src/index.ts).
// Production: set VITE_WS_URL at build time to the deployed server's wss://
// URL (e.g. Railway's public domain + /ws) — no default baked in since we
// don't want to guess a wrong one; connecting without it set fails clearly
// instead of silently pointing somewhere wrong.
const DEFAULT_WS_URL = import.meta.env.DEV ? "ws://localhost:8080/ws" : undefined;
const WS_URL = import.meta.env.VITE_WS_URL ?? DEFAULT_WS_URL;

const RECONNECT_DELAY_MS = 2000;

function getOrCreatePlayerId(): string {
  const key = "nightfall-player-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// Owns the WebSocket connection for co-op Endless: create/join a room by
// code, send input (movement/aim/fire) at a capped rate, and expose the
// latest server-broadcast snapshot for rendering. The server is fully
// authoritative — this class never simulates combat locally.
export class MultiplayerGame {
  readonly playerId = getOrCreatePlayerId();
  private ws: WebSocket | undefined;
  private displayName = "";
  private inputAccumulatorMs = 0;
  private readonly sendIntervalMs = 1000 / INPUT_SEND_HZ;
  private onLevelUpCallback: ((offerIds: string[]) => void) | null = null;
  // Set by disconnect() so the close handler knows not to auto-reconnect.
  private leavingDeliberately = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  latestSnapshot: MatchSnapshot | null = null;
  roomCode: string | null = null;
  connected = false;
  // "disconnected" means the underlying WebSocket dropped unexpectedly —
  // this class retries automatically underneath (see scheduleReconnect), we
  // just surface it so the UI can show a "Reconnecting..." banner instead of
  // silently freezing on the last snapshot.
  connStatus: "idle" | "connecting" | "connected" | "disconnected" = "idle";

  async createRoom(displayName: string): Promise<string> {
    this.displayName = displayName;
    const roomCode = await this.connectSocket("create");
    this.roomCode = roomCode;
    return roomCode;
  }

  // Returns false if the code doesn't resolve to a live room.
  async joinRoom(displayName: string, roomCode: string): Promise<boolean> {
    this.displayName = displayName;
    try {
      const resolvedCode = await this.connectSocket("join", roomCode);
      this.roomCode = resolvedCode;
      return true;
    } catch (err) {
      if (err instanceof Error && err.message === "Room not found") return false;
      throw err;
    }
  }

  // Called once, before create/joinRoom — the level-up modal needs this to
  // know which perks were actually offered (the server sends ids only, the
  // client resolves them to full Perk objects via getPerkById for display).
  onLevelUp(callback: (offerIds: string[]) => void): void {
    this.onLevelUpCallback = callback;
  }

  private connectSocket(mode: "create" | "join", code?: string): Promise<string> {
    if (!WS_URL) return Promise.reject(new Error("Multiplayer server not configured"));
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({ mode, playerId: this.playerId, displayName: this.displayName });
      if (code) params.set("code", code);
      const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
      this.ws = ws;
      this.connStatus = "connecting";
      let settled = false;

      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "welcome") {
          this.connected = true;
          this.connStatus = "connected";
          if (!settled) {
            settled = true;
            resolve(msg.payload.roomCode);
          }
        } else if (msg.type === "snapshot") {
          this.latestSnapshot = msg.payload;
        } else if (msg.type === "levelUp") {
          this.onLevelUpCallback?.(msg.payload.offerIds);
        }
      });

      ws.addEventListener("close", (event) => {
        this.connected = false;
        if (!settled) {
          settled = true;
          reject(new Error(event.reason || "Failed to connect"));
          return;
        }
        if (this.leavingDeliberately) {
          this.connStatus = "idle";
          return;
        }
        this.connStatus = "disconnected";
        this.scheduleReconnect();
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.leavingDeliberately || !this.roomCode) return;
      this.connectSocket("join", this.roomCode).catch(() => this.scheduleReconnect());
    }, RECONNECT_DELAY_MS);
  }

  disconnect(): void {
    this.leavingDeliberately = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.ws?.close();
    this.ws = undefined;
    this.connected = false;
    this.latestSnapshot = null;
    this.roomCode = null;
    this.connStatus = "idle";
  }

  chooseUpgrade(perkId: string): void {
    this.send({ type: "chooseUpgrade", payload: { perkId } });
  }

  // Call once per frame; internally throttles the actual network send to
  // INPUT_SEND_HZ so movement keys held down don't spam a message every frame.
  sendInput(dt: number, moveVector: Vec2, aimDir: Vec2, fireHeld: boolean): void {
    this.inputAccumulatorMs += dt * 1000;
    if (this.inputAccumulatorMs < this.sendIntervalMs) return;
    this.inputAccumulatorMs = 0;
    this.send({ type: "input", payload: { moveX: moveVector.x, moveY: moveVector.y, aimX: aimDir.x, aimY: aimDir.y, fireHeld } });
  }

  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }
}

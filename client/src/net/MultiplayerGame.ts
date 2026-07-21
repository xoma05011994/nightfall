import { rivetClient } from "./rivetClient";
import { INPUT_SEND_HZ } from "@nightfall/shared/constants";
import type { MatchSnapshot } from "@nightfall/shared/multiplayer";
import type { Vec2 } from "@nightfall/shared/types";

type MatchConn = ReturnType<ReturnType<(typeof rivetClient)["match"]["getOrCreate"]>["connect"]>;

function getOrCreatePlayerId(): string {
  const key = "nightfall-player-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

// Owns the RivetKit connection for co-op Endless: create/join a room by
// code, send input (movement/aim/fire) at a capped rate, and expose the
// latest server-broadcast snapshot for rendering. The server is fully
// authoritative — this class never simulates combat locally.
export class MultiplayerGame {
  readonly playerId = getOrCreatePlayerId();
  private conn: MatchConn | undefined;
  private inputAccumulatorMs = 0;
  private readonly sendIntervalMs = 1000 / INPUT_SEND_HZ;
  private onLevelUpCallback: ((offerIds: string[]) => void) | null = null;

  latestSnapshot: MatchSnapshot | null = null;
  roomCode: string | null = null;
  connected = false;
  connectError: string | null = null;
  // "disconnected" means the underlying WebSocket dropped — RivetKit keeps
  // retrying automatically underneath (see ActorConnRaw.onClose's docs), we
  // just surface it so the UI can show a "Reconnecting..." banner instead of
  // silently freezing on the last snapshot.
  connStatus: "idle" | "connecting" | "connected" | "disconnected" = "idle";

  async createRoom(displayName: string): Promise<string> {
    const mm = rivetClient.matchmaker.getOrCreate(["main"]);
    const { roomCode, matchId } = await mm.createRoom();
    await this.joinMatch(matchId, displayName);
    this.roomCode = roomCode;
    return roomCode;
  }

  // Returns false if the code doesn't resolve to a live room.
  async joinRoom(displayName: string, roomCode: string): Promise<boolean> {
    const mm = rivetClient.matchmaker.getOrCreate(["main"]);
    const result = await mm.resolveRoomCode(roomCode);
    if (!result) return false;
    await this.joinMatch(result.matchId, displayName);
    this.roomCode = roomCode;
    return true;
  }

  // Called once, before create/joinRoom — the level-up modal needs this to
  // know which perks were actually offered (the server sends ids only, the
  // client resolves them to full Perk objects via getPerkById for display).
  onLevelUp(callback: (offerIds: string[]) => void): void {
    this.onLevelUpCallback = callback;
  }

  private async joinMatch(matchId: string, displayName: string): Promise<void> {
    const handle = rivetClient.match.getOrCreate([matchId]);
    this.conn = handle.connect({ playerId: this.playerId, displayName });
    // Callback payload is typed `unknown` by rivetkit's event<T>() generic
    // inference — the runtime value is real, asserted here at each call site.
    this.conn.on("snapshot", (raw) => {
      this.latestSnapshot = raw as MatchSnapshot;
    });
    this.conn.on("levelUp", (raw) => {
      const payload = raw as { offerIds: string[] };
      this.onLevelUpCallback?.(payload.offerIds);
    });
    this.conn.onStatusChange((status) => {
      this.connStatus = status;
    });
    this.connStatus = this.conn.connStatus;
    this.connected = true;
  }

  disconnect(): void {
    this.conn?.dispose();
    this.conn = undefined;
    this.connected = false;
    this.latestSnapshot = null;
    this.roomCode = null;
    this.connStatus = "idle";
  }

  chooseUpgrade(perkId: string): void {
    this.conn?.chooseUpgrade(perkId);
  }

  // Call once per frame; internally throttles the actual network send to
  // INPUT_SEND_HZ so movement keys held down don't spam setInput every frame.
  sendInput(dt: number, moveVector: Vec2, aimDir: Vec2, fireHeld: boolean): void {
    if (!this.conn) return;
    this.inputAccumulatorMs += dt * 1000;
    if (this.inputAccumulatorMs < this.sendIntervalMs) return;
    this.inputAccumulatorMs = 0;
    this.conn.setInput({ moveX: moveVector.x, moveY: moveVector.y, aimX: aimDir.x, aimY: aimDir.y, fireHeld });
  }
}

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
// code, send movement input at a capped rate, and expose the latest
// server-broadcast snapshot for rendering. M1 is movement-only — no
// enemies/combat/xp yet (that's M2+), so this is intentionally thin.
export class MultiplayerGame {
  readonly playerId = getOrCreatePlayerId();
  private conn: MatchConn | undefined;
  private inputAccumulatorMs = 0;
  private readonly sendIntervalMs = 1000 / INPUT_SEND_HZ;

  latestSnapshot: MatchSnapshot | null = null;
  roomCode: string | null = null;
  connected = false;
  connectError: string | null = null;

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

  private async joinMatch(matchId: string, displayName: string): Promise<void> {
    const handle = rivetClient.match.getOrCreate([matchId]);
    this.conn = handle.connect({ playerId: this.playerId, displayName });
    // Callback payload is typed `unknown` by rivetkit's event<T>() generic
    // inference — the runtime value is real, asserted here at the one call site.
    this.conn.on("snapshot", (raw) => {
      this.latestSnapshot = raw as MatchSnapshot;
    });
    this.connected = true;
  }

  disconnect(): void {
    this.conn?.dispose();
    this.conn = undefined;
    this.connected = false;
    this.latestSnapshot = null;
    this.roomCode = null;
  }

  // Call once per frame; internally throttles the actual network send to
  // INPUT_SEND_HZ so movement keys held down don't spam setInput every frame.
  sendInput(dt: number, moveVector: Vec2): void {
    if (!this.conn) return;
    this.inputAccumulatorMs += dt * 1000;
    if (this.inputAccumulatorMs < this.sendIntervalMs) return;
    this.inputAccumulatorMs = 0;
    this.conn.setInput({ moveX: moveVector.x, moveY: moveVector.y });
  }
}

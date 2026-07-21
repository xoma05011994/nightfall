import { actor } from "rivetkit";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isValidRoomCode } from "@nightfall/shared/constants";

interface RoomRecord {
  matchId: string;
  createdAt: number;
}

interface MatchmakerState {
  rooms: Record<string, RoomRecord>;
}

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

// Endless co-op runs are open-ended (no fixed end time), so unlike a timed
// run this can't bound staleness by expected run length — this is just a
// generous backstop against rooms that were created but never actually
// connected to (createRoom has no connection lifecycle to hook cleanup off
// of), not a real session timeout.
const ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function pruneStaleRooms(state: MatchmakerState): void {
  const cutoff = Date.now() - ROOM_MAX_AGE_MS;
  for (const [code, room] of Object.entries(state.rooms)) {
    if (room.createdAt < cutoff) delete state.rooms[code];
  }
}

// Coordinator actor: tracks room codes only, never touches gameplay state.
// matchId === roomCode, so there's no extra indirection table.
export const matchmaker = actor({
  state: { rooms: {} } as MatchmakerState,

  actions: {
    // No `await` between the collision check and the write, so this can't
    // race even across concurrent calls — no queue needed.
    createRoom: (c) => {
      pruneStaleRooms(c.state);
      let code = generateRoomCode();
      while (c.state.rooms[code]) code = generateRoomCode();
      c.state.rooms[code] = { matchId: code, createdAt: Date.now() };
      return { roomCode: code, matchId: code };
    },

    resolveRoomCode: (c, code: string) => {
      if (!isValidRoomCode(code)) return null;
      return c.state.rooms[code] ?? null;
    },

    closeRoom: (c, code: string) => {
      if (!isValidRoomCode(code)) return;
      delete c.state.rooms[code];
    },
  },
});

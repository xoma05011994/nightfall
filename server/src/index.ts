import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { MAX_PARTY_SIZE, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isValidRoomCode } from "@nightfall/shared/constants";
import type { ClientMessage } from "@nightfall/shared/multiplayer";
import { Room } from "./room";

const MAX_PLAYER_ID_LEN = 128;
const MAX_DISPLAY_NAME_LEN = 24;

// Room registry — matchId === roomCode, so there's no extra indirection
// table (mirrors the old RivetKit matchmaker's design). A room removes
// itself via the `onEmpty` callback passed to its constructor once it's
// been empty past ROOM_EMPTY_GRACE_MS (see Room.step()).
const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

function createRoom(): Room {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();
  const room = new Room(code, () => rooms.delete(code));
  rooms.set(code, room);
  return room;
}

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("ok");
});

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const mode = url.searchParams.get("mode");
  const playerId = url.searchParams.get("playerId");
  const displayName = url.searchParams.get("displayName");

  if (
    typeof playerId !== "string" ||
    playerId.length === 0 ||
    playerId.length > MAX_PLAYER_ID_LEN ||
    typeof displayName !== "string" ||
    displayName.length === 0 ||
    displayName.length > MAX_DISPLAY_NAME_LEN
  ) {
    ws.close(4000, "Invalid connection params");
    return;
  }

  let room: Room;
  if (mode === "create") {
    room = createRoom();
  } else if (mode === "join") {
    const code = url.searchParams.get("code") ?? "";
    const existing = isValidRoomCode(code) ? rooms.get(code) : undefined;
    if (!existing) {
      ws.close(4004, "Room not found");
      return;
    }
    room = existing;
  } else {
    ws.close(4000, "Invalid mode");
    return;
  }

  const rejectReason = room.addPlayer(playerId, displayName, ws);
  if (rejectReason) {
    ws.close(4003, rejectReason);
    return;
  }
  room.sendWelcome(ws);

  ws.on("message", (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return; // malformed message, ignore
    }
    if (typeof msg !== "object" || msg === null || typeof (msg as { type?: unknown }).type !== "string") return;
    room.handleMessage(playerId, msg);
  });

  ws.on("close", () => {
    room.removePlayer(playerId, ws);
  });
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => {
  console.log(`Nightfall server listening on :${port} (max party size ${MAX_PARTY_SIZE})`);
});

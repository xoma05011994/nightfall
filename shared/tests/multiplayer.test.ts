import { describe, expect, it } from "vitest";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, isValidRoomCode } from "../src/constants";

describe("isValidRoomCode", () => {
  it("accepts a code of the right length using only alphabet characters", () => {
    const code = ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH);
    expect(isValidRoomCode(code)).toBe(true);
  });

  it("rejects a code of the wrong length", () => {
    expect(isValidRoomCode("ABC")).toBe(false);
    expect(isValidRoomCode(ROOM_CODE_ALPHABET.slice(0, ROOM_CODE_LENGTH) + "X")).toBe(false);
  });

  it("rejects a code containing characters outside the alphabet", () => {
    // The alphabet deliberately excludes 0/O/1/I/L to avoid ambiguity —
    // confirm those are actually rejected, not just untested.
    expect(isValidRoomCode("ABCD0O")).toBe(false);
    expect(isValidRoomCode("ABCD1I")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidRoomCode("")).toBe(false);
  });
});

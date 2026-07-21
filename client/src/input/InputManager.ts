import { normalize } from "@nightfall/shared/math";
import type { Vec2 } from "@nightfall/shared/types";

const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

// WASD (+ arrow keys) for movement, mouse for aim/fire, 1/2/3 for weapon
// slots, R to reload. No camera rotation — the player always faces the
// cursor, and since the camera keeps the player pinned at the screen
// center, the on-screen direction from center to cursor IS the world-space
// aim direction (no coordinate conversion needed).
export class InputManager {
  private pressed = new Set<string>();
  private justPressed = new Set<string>();
  private mouseScreenPos: Vec2 = { x: 0, y: 0 };
  private mouseDown = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (MOVE_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat && !this.pressed.has(e.code)) this.justPressed.add(e.code);
      this.pressed.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.pressed.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.pressed.clear();
      this.mouseDown = false;
    });
    window.addEventListener("mousemove", (e) => {
      this.mouseScreenPos = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  getMoveVector(): Vec2 {
    let x = 0;
    let y = 0;
    if (this.pressed.has("KeyW") || this.pressed.has("ArrowUp")) y -= 1;
    if (this.pressed.has("KeyS") || this.pressed.has("ArrowDown")) y += 1;
    if (this.pressed.has("KeyA") || this.pressed.has("ArrowLeft")) x -= 1;
    if (this.pressed.has("KeyD") || this.pressed.has("ArrowRight")) x += 1;
    return normalize({ x, y });
  }

  getMouseScreenPos(): Vec2 {
    return this.mouseScreenPos;
  }

  isFireHeld(): boolean {
    return this.mouseDown;
  }

  // True at most once per physical key press (ignores OS auto-repeat) —
  // callers should poll this once per frame for edge-triggered actions like
  // slot switching or reload.
  consumeJustPressed(code: string): boolean {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }
}

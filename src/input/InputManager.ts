import { normalize } from "../math";
import type { Vec2 } from "../types";

const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]);

// WASD (+ arrow keys) only — no mouse-aim, no camera rotation. The player
// always faces/shoots toward the nearest enemy automatically (see combat.ts).
export class InputManager {
  private pressed = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => {
      if (MOVE_KEYS.has(e.code)) e.preventDefault();
      this.pressed.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.pressed.delete(e.code);
    });
    window.addEventListener("blur", () => this.pressed.clear());
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
}

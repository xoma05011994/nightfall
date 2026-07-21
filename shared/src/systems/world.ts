import { WORLD_HALF_SIZE } from "../constants";
import { clamp } from "../math";
import type { Vec2 } from "../types";

export function clampToWorldBounds(position: Vec2, margin = 0): Vec2 {
  const limit = WORLD_HALF_SIZE - margin;
  return {
    x: clamp(position.x, -limit, limit),
    y: clamp(position.y, -limit, limit),
  };
}

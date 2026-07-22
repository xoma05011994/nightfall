import {
  OBSTACLE_COUNT,
  OBSTACLE_HOLE_RADIUS_MAX,
  OBSTACLE_HOLE_RADIUS_MIN,
  OBSTACLE_LAKE_RADIUS_MAX,
  OBSTACLE_LAKE_RADIUS_MIN,
  OBSTACLE_MIN_DIST_FROM_ORIGIN,
  OBSTACLE_MIN_SPACING,
  OBSTACLE_TREE_RADIUS_MAX,
  OBSTACLE_TREE_RADIUS_MIN,
  WORLD_HALF_SIZE,
} from "../constants";
import type { Obstacle, ObstacleKind, Vec2 } from "../types";

// Weighted toward trees (most common, smallest) with lakes and holes as
// rarer, bigger set pieces.
const KIND_WEIGHTS: ObstacleKind[] = ["tree", "tree", "tree", "tree", "lake", "hole"];

function radiusFor(kind: ObstacleKind, rng: () => number): number {
  if (kind === "lake") return OBSTACLE_LAKE_RADIUS_MIN + rng() * (OBSTACLE_LAKE_RADIUS_MAX - OBSTACLE_LAKE_RADIUS_MIN);
  if (kind === "hole") return OBSTACLE_HOLE_RADIUS_MIN + rng() * (OBSTACLE_HOLE_RADIUS_MAX - OBSTACLE_HOLE_RADIUS_MIN);
  return OBSTACLE_TREE_RADIUS_MIN + rng() * (OBSTACLE_TREE_RADIUS_MAX - OBSTACLE_TREE_RADIUS_MIN);
}

// Scatters OBSTACLE_COUNT obstacles across the world, keeping them off the
// spawn area (near the origin) and spaced apart from each other. Rejection
// sampling with a generous attempt budget — if the world genuinely can't
// fit any more without crowding, it just stops early with fewer than
// OBSTACLE_COUNT rather than looping forever.
export function generateObstacles(rng: () => number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const margin = OBSTACLE_LAKE_RADIUS_MAX + 40;
  let attempts = 0;
  while (obstacles.length < OBSTACLE_COUNT && attempts < OBSTACLE_COUNT * 25) {
    attempts++;
    const position: Vec2 = {
      x: (rng() * 2 - 1) * (WORLD_HALF_SIZE - margin),
      y: (rng() * 2 - 1) * (WORLD_HALF_SIZE - margin),
    };
    if (Math.hypot(position.x, position.y) < OBSTACLE_MIN_DIST_FROM_ORIGIN) continue;
    const kind = KIND_WEIGHTS[Math.floor(rng() * KIND_WEIGHTS.length)]!;
    const radius = radiusFor(kind, rng);
    const overlapsExisting = obstacles.some((o) => Math.hypot(position.x - o.position.x, position.y - o.position.y) < radius + o.radius + OBSTACLE_MIN_SPACING);
    if (overlapsExisting) continue;
    obstacles.push({ id: obstacles.length + 1, kind, position, radius });
  }
  return obstacles;
}

// Pushes `position` (a circle of `radius`) back outside any obstacle it's
// currently overlapping, along the line from the obstacle's center — same
// "resolve after the fact" shape as clampToWorldBounds. Only ever called
// for the player; enemies pass through obstacles untouched.
export function resolvePlayerObstacleCollision(position: Vec2, radius: number, obstacles: Obstacle[]): Vec2 {
  let pos = position;
  for (const obstacle of obstacles) {
    const dx = pos.x - obstacle.position.x;
    const dy = pos.y - obstacle.position.y;
    const dist = Math.hypot(dx, dy);
    const minDist = radius + obstacle.radius;
    if (dist >= minDist) continue;
    if (dist < 1e-6) {
      // Degenerate (exact same point, astronomically unlikely) — push along
      // a fixed direction rather than dividing by zero.
      pos = { x: obstacle.position.x + minDist, y: obstacle.position.y };
    } else {
      const scale = minDist / dist;
      pos = { x: obstacle.position.x + dx * scale, y: obstacle.position.y + dy * scale };
    }
  }
  return pos;
}

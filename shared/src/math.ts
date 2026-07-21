import type { Vec2 } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function distanceSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt(distanceSq(a, b));
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function directionTo(from: Vec2, to: Vec2): Vec2 {
  return normalize({ x: to.x - from.x, y: to.y - from.y });
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

// Distance from `point` to the segment from `origin` extending `dir`
// (normalized) for `length` units — null if the point's projection falls
// outside the segment (behind the origin or past its end).
export function pointToRaySegmentDistance(point: Vec2, origin: Vec2, dir: Vec2, length: number): number | null {
  const toPoint = { x: point.x - origin.x, y: point.y - origin.y };
  const t = dot(toPoint, dir);
  if (t < 0 || t > length) return null;
  const closest = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
  return distance(point, closest);
}

export function rotate(v: Vec2, angleRad: number): Vec2 {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

// mulberry32 — small, fast, deterministic PRNG (no external dependency).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

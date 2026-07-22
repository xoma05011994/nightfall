import type { EnemyType } from "@nightfall/shared/types";

// Four colorways of the same knight sprite — solo always uses "blue"; co-op
// assigns one per connected player by their index in the room's player list
// (host first, insertion order), so party members read as visually distinct
// without needing a server-side "color" concept.
export type PlayerColor = "blue" | "gold" | "green" | "red";

const PLAYER_COLOR_ORDER: PlayerColor[] = ["blue", "gold", "green", "red"];

export function playerColorForIndex(index: number): PlayerColor {
  return PLAYER_COLOR_ORDER[index % PLAYER_COLOR_ORDER.length]!;
}

// Lazily loaded and cached per source — `Image.src` assignment is async, so
// a freshly requested icon may not be ready on its first draw call; callers
// simply skip that frame (image.complete stays false until loaded, then
// every subsequent frame draws it normally). Same pattern as weaponIcons.ts.
const imageCache = new Map<string, HTMLImageElement>();

function getImage(key: string, src: string): HTMLImageElement {
  let img = imageCache.get(key);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(key, img);
  }
  return img;
}

export function getCharacterImage(color: PlayerColor): HTMLImageElement {
  return getImage(`char-${color}`, `/characters/${color}.png`);
}

export function getEnemyImage(type: EnemyType): HTMLImageElement {
  return getImage(`enemy-${type}`, `/enemies/${type}.png`);
}

export function getChestImage(): HTMLImageElement {
  return getImage("chest", "/chest.png");
}

// Draws `img` centered at (0,0), sized to fit within `size` px on its longer
// axis — callers translate into place first. Shared by characters, enemies,
// and the chest so they all follow the same "load once, fit-to-box" pattern
// as drawWeaponIcon.
export function drawEntityIcon(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number): void {
  if (!img.complete || img.naturalWidth === 0) return;
  const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
}

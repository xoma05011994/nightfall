import { WEAPON_DEFS } from "@nightfall/shared/systems/weapons";
import type { WeaponId } from "@nightfall/shared/types";

// Lazily loaded and cached per weapon — `Image.src` assignment is async, so
// a freshly requested icon may not be ready on its first draw call; the
// caller simply skips that frame (image.complete stays false until loaded,
// then every subsequent frame draws it normally).
const imageCache = new Map<WeaponId, HTMLImageElement>();

function getImage(weaponId: WeaponId): HTMLImageElement {
  let img = imageCache.get(weaponId);
  if (!img) {
    img = new Image();
    img.src = WEAPON_DEFS[weaponId].icon;
    imageCache.set(weaponId, img);
  }
  return img;
}

// Draws a weapon's icon image centered at (0,0), sized to fit within
// `size` px on its longer axis. Callers translate/scale into place — used
// by both the world pickup rendering and (indirectly, via the same source
// images) the HUD weapon slots.
export function drawWeaponIcon(ctx: CanvasRenderingContext2D, weaponId: WeaponId, size: number): void {
  const img = getImage(weaponId);
  if (!img.complete || img.naturalWidth === 0) return;
  const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
}

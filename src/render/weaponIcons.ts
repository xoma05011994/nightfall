import type { WeaponId } from "../types";

// Hand-drawn Canvas2D silhouettes for world weapon pickups — distinct per
// weapon so drops read at a glance instead of all looking like the same
// rotated diamond. Drawn centered at (0,0) at roughly `size` px across;
// callers translate/scale into place.
export function drawWeaponIcon(ctx: CanvasRenderingContext2D, weaponId: WeaponId, size: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  const s = size / 24; // icons are authored on a 24-unit grid, like the SVG icons

  switch (weaponId) {
    case "pistol":
      ctx.fillRect(-2 * s, -9 * s, 4 * s, 8 * s);
      ctx.fillRect(-4 * s, -1 * s, 4 * s, 7 * s);
      break;
    case "shotgun":
      ctx.fillRect(-10 * s, -2 * s, 18 * s, 4 * s);
      ctx.globalAlpha = 0.85;
      ctx.fillRect(5 * s, -6 * s, 5 * s, 12 * s);
      ctx.globalAlpha = 1;
      break;
    case "assaultRifle":
      ctx.fillRect(-10 * s, -1.5 * s, 20 * s, 3 * s);
      ctx.globalAlpha = 0.8;
      ctx.fillRect(-3 * s, 1.5 * s, 3 * s, 7 * s);
      ctx.globalAlpha = 1;
      break;
    case "rpg":
      ctx.fillRect(-9 * s, -2.5 * s, 12 * s, 5 * s);
      ctx.beginPath();
      ctx.moveTo(3 * s, -4 * s);
      ctx.lineTo(10 * s, 0);
      ctx.lineTo(3 * s, 4 * s);
      ctx.closePath();
      ctx.fill();
      break;
    case "laserCannon":
      ctx.beginPath();
      ctx.moveTo(-10 * s, 3 * s);
      ctx.lineTo(8 * s, -3 * s);
      ctx.lineTo(8 * s, 3 * s);
      ctx.lineTo(-10 * s, 8 * s);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(4 * s, 0.5 * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    case "flamethrower":
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(-5 * s, 2 * s, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillRect(-2 * s, -1 * s, 8 * s, 4 * s);
      ctx.beginPath();
      ctx.moveTo(6 * s, -2 * s);
      ctx.lineTo(11 * s, 0.5 * s);
      ctx.lineTo(6 * s, 3 * s);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

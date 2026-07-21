import { FENCE_POST_SPACING, REWARD_POPUP_LIFETIME_MS, REWARD_POPUP_RISE_PX, WORLD_HALF_SIZE } from "@nightfall/shared/constants";
import { drawWeaponIcon } from "./weaponIcons";
import { WEAPON_DEFS } from "@nightfall/shared/systems/weapons";
import type { BeamEffect, Chest, ConeEffect, Enemy, LevelPalette, LightningEffect, Player, Projectile, RewardPopupEffect, Vec2, WeaponPickup, XpOrb } from "@nightfall/shared/types";

const DEFAULT_PALETTE: LevelPalette = { bg: "#1c1310", splatterRGB: "139, 0, 0", fence: "#3a2416" };

interface Splatter {
  position: Vec2;
  radius: number;
  alpha: number;
}

export interface RenderState {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: Projectile[];
  xpOrbs: XpOrb[];
  weaponPickups: WeaponPickup[];
  chests: Chest[];
  beamEffects: BeamEffect[];
  coneEffects: ConeEffect[];
  lightningEffects: LightningEffect[];
  rewardPopups: RewardPopupEffect[];
}

const SPLATTER_FIELD_HALF_SIZE = 4000;
const SPLATTER_COUNT = 260;
const BEAM_EFFECT_LIFETIME_MS = 120;
const CONE_EFFECT_LIFETIME_MS = 100;
const LIGHTNING_EFFECT_LIFETIME_MS = 200;
const LIGHTNING_SEGMENTS = 6;
const LIGHTNING_JITTER = 14;
const WEAPON_ICON_WORLD_SCALE = 3.5;

// Simple deterministic hash-based PRNG so a bolt's zigzag stays stable across
// frames while it fades, without needing to store per-segment jitter values.
function seededJitter(seed: number, index: number): number {
  const x = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

// Deterministic ground-texture splatters generated once and reused every
// frame — cheap atmosphere without needing image assets or truly infinite
// procedural generation.
function generateSplatters(): Splatter[] {
  const splatters: Splatter[] = [];
  for (let i = 0; i < SPLATTER_COUNT; i++) {
    splatters.push({
      position: {
        x: (Math.random() * 2 - 1) * SPLATTER_FIELD_HALF_SIZE,
        y: (Math.random() * 2 - 1) * SPLATTER_FIELD_HALF_SIZE,
      },
      radius: 6 + Math.random() * 26,
      alpha: 0.08 + Math.random() * 0.14,
    });
  }
  return splatters;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private splatters = generateSplatters();
  private palette: LevelPalette = DEFAULT_PALETTE;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
  }

  setPalette(palette: LevelPalette | null): void {
    this.palette = palette ?? DEFAULT_PALETTE;
  }

  resize(width: number, height: number): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get viewWidth(): number {
    return this.canvas.width / (window.devicePixelRatio || 1);
  }

  get viewHeight(): number {
    return this.canvas.height / (window.devicePixelRatio || 1);
  }

  render(state: RenderState, nowMs: number): void {
    const ctx = this.ctx;
    const w = this.viewWidth;
    const h = this.viewHeight;
    const camera = state.player.position;

    ctx.fillStyle = this.palette.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 - camera.x, h / 2 - camera.y);

    this.drawSplatters(camera, w, h);
    this.drawFence(camera, w, h);
    this.drawConeEffects(state.coneEffects, nowMs);
    this.drawChests(state.chests, nowMs);
    this.drawWeaponPickups(state.weaponPickups, nowMs);
    this.drawOrbs(state.xpOrbs, nowMs);
    this.drawEnemies(state.enemies, nowMs);
    this.drawBeamEffects(state.beamEffects, nowMs);
    this.drawLightningEffects(state.lightningEffects, nowMs);
    this.drawProjectiles(state.projectiles);
    this.drawProjectiles(state.enemyProjectiles);
    this.drawAura(state.player, nowMs);
    this.drawPlayer(state.player, nowMs);
    this.drawRewardPopups(state.rewardPopups, nowMs);

    ctx.restore();

    this.drawVignette(w, h, state.player.hp / state.player.maxHp);
  }

  private inView(x: number, y: number, camera: Vec2, w: number, h: number, margin: number): boolean {
    const sx = x - camera.x + w / 2;
    const sy = y - camera.y + h / 2;
    return sx >= -margin && sx <= w + margin && sy >= -margin && sy <= h + margin;
  }

  private drawSplatters(camera: Vec2, w: number, h: number): void {
    const ctx = this.ctx;
    for (const s of this.splatters) {
      if (!this.inView(s.position.x, s.position.y, camera, w, h, 60)) continue;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${this.palette.splatterRGB}, ${s.alpha})`;
      ctx.ellipse(s.position.x, s.position.y, s.radius, s.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFence(camera: Vec2, w: number, h: number): void {
    const ctx = this.ctx;
    const half = WORLD_HALF_SIZE;

    ctx.save();
    ctx.strokeStyle = this.palette.fence;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-half, -half);
    ctx.lineTo(half, -half);
    ctx.moveTo(-half, half);
    ctx.lineTo(half, half);
    ctx.moveTo(-half, -half);
    ctx.lineTo(-half, half);
    ctx.moveTo(half, -half);
    ctx.lineTo(half, half);
    ctx.stroke();
    ctx.restore();

    const drawPost = (x: number, y: number): void => {
      if (!this.inView(x, y, camera, w, h, 80)) return;
      ctx.fillStyle = this.palette.fence;
      ctx.fillRect(x - 4, y - 26, 8, 52);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 4, y - 26, 8, 52);
    };
    for (let x = -half; x <= half; x += FENCE_POST_SPACING) {
      drawPost(x, -half);
      drawPost(x, half);
    }
    for (let y = -half + FENCE_POST_SPACING; y < half; y += FENCE_POST_SPACING) {
      drawPost(-half, y);
      drawPost(half, y);
    }
  }

  private drawPlayer(player: Player, nowMs: number): void {
    const ctx = this.ctx;
    const pulse = 1 + Math.sin(nowMs / 260) * 0.04;
    ctx.save();
    ctx.shadowColor = "#c81e1e";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#8b0000";
    ctx.beginPath();
    ctx.arc(player.position.x, player.position.y, player.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#d8cfc2";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  private drawEnemies(enemies: Enemy[], nowMs: number): void {
    const ctx = this.ctx;
    for (const enemy of enemies) {
      ctx.save();
      const spikes = enemy.isBoss ? 12 : enemy.type === "brute" ? 7 : 8;
      const fillStyle = enemy.isBoss ? "#150a1c" : enemy.type === "brute" ? "#241209" : enemy.type === "shooter" ? "#140a1c" : "#1c0d0d";
      const strokeStyle = enemy.isBoss ? "#7a1fa0" : enemy.type === "brute" ? "#7a3414" : enemy.type === "shooter" ? "#4ee2ff" : "#5c1414";
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const angle = (i / spikes) * Math.PI * 2;
        const r = i % 2 === 0 ? enemy.radius * 1.25 : enemy.radius * 0.85;
        const x = enemy.position.x + Math.cos(angle) * r;
        const y = enemy.position.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = enemy.isBoss ? 3 : enemy.type === "brute" ? 2.5 : 1.5;
      if (enemy.isBoss) {
        ctx.shadowColor = "#a020f0";
        ctx.shadowBlur = 16;
      } else if (enemy.type === "shooter") {
        ctx.shadowColor = "#4ee2ff";
        ctx.shadowBlur = 10;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (enemy.burnDamagePerTick > 0) {
        const flicker = 0.5 + Math.sin(nowMs / 90 + enemy.id) * 0.2;
        ctx.fillStyle = `rgba(255, 106, 0, ${flicker})`;
        ctx.beginPath();
        ctx.arc(enemy.position.x, enemy.position.y, enemy.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (enemy.type === "shooter") {
        // A glowing core hints at the ranged threat before it ever fires.
        ctx.fillStyle = "#4ee2ff";
        ctx.beginPath();
        ctx.arc(enemy.position.x, enemy.position.y, enemy.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      const eyeOffset = enemy.isBoss ? 8 : 4;
      const eyeSize = enemy.isBoss ? 3 : 1.6;
      ctx.fillStyle = enemy.isBoss ? "#e042ff" : "#c81e1e";
      ctx.beginPath();
      ctx.arc(enemy.position.x - eyeOffset, enemy.position.y - 2, eyeSize, 0, Math.PI * 2);
      ctx.arc(enemy.position.x + eyeOffset, enemy.position.y - 2, eyeSize, 0, Math.PI * 2);
      ctx.fill();

      if (enemy.isBoss) {
        ctx.fillStyle = "#e042ff";
        ctx.font = "bold 12px Georgia";
        ctx.textAlign = "center";
        ctx.fillText("BOSS", enemy.position.x, enemy.position.y - enemy.radius - 20);
        this.drawHpBar(enemy.position, enemy.radius, enemy.hp / enemy.maxHp);
      } else if (enemy.hp < enemy.maxHp) {
        this.drawHpBar(enemy.position, enemy.radius, enemy.hp / enemy.maxHp);
      }
      ctx.restore();
    }
  }

  private drawAura(player: Player, nowMs: number): void {
    if (player.auraDamagePerTick <= 0) return;
    const ctx = this.ctx;
    const pulse = 1 + Math.sin(nowMs / 220) * 0.05;
    ctx.save();
    ctx.fillStyle = "rgba(200, 30, 30, 0.12)";
    ctx.strokeStyle = "rgba(200, 30, 30, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.position.x, player.position.y, player.auraRadius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawHpBar(position: Vec2, radius: number, ratio: number): void {
    const ctx = this.ctx;
    const width = radius * 2.2;
    const y = position.y - radius - 8;
    ctx.fillStyle = "#2a0d0d";
    ctx.fillRect(position.x - width / 2, y, width, 3);
    ctx.fillStyle = "#c81e1e";
    ctx.fillRect(position.x - width / 2, y, width * Math.max(0, ratio), 3);
  }

  private drawProjectiles(projectiles: Projectile[]): void {
    const ctx = this.ctx;
    ctx.save();
    for (const p of projectiles) {
      const radius = p.splashRadius ? p.radius * 1.8 : p.radius;
      ctx.shadowColor = p.giga ? "#ffcf4a" : p.color;
      ctx.shadowBlur = p.giga ? 18 : 10;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (p.giga) {
        ctx.strokeStyle = "#ffcf4a";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawBeamEffects(beams: BeamEffect[], nowMs: number): void {
    const ctx = this.ctx;
    ctx.save();
    for (const beam of beams) {
      const life = (beam.expiresAtMs - nowMs) / BEAM_EFFECT_LIFETIME_MS;
      ctx.globalAlpha = Math.max(0, Math.min(1, life));
      ctx.strokeStyle = beam.color;
      ctx.shadowColor = beam.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(beam.from.x, beam.from.y);
      ctx.lineTo(beam.to.x, beam.to.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLightningEffects(bolts: LightningEffect[], nowMs: number): void {
    const ctx = this.ctx;
    ctx.save();
    for (const bolt of bolts) {
      const life = (bolt.expiresAtMs - nowMs) / LIGHTNING_EFFECT_LIFETIME_MS;
      const alpha = Math.max(0, Math.min(1, life));
      if (alpha <= 0) continue;

      const dx = bolt.to.x - bolt.from.x;
      const dy = bolt.to.y - bolt.from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#7fe8ff";
      ctx.shadowColor = "#7fe8ff";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bolt.from.x, bolt.from.y);
      for (let i = 1; i < LIGHTNING_SEGMENTS; i++) {
        const t = i / LIGHTNING_SEGMENTS;
        const jitter = seededJitter(bolt.seed, i) * LIGHTNING_JITTER;
        const x = bolt.from.x + dx * t + nx * jitter;
        const y = bolt.from.y + dy * t + ny * jitter;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(bolt.to.x, bolt.to.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawConeEffects(cones: ConeEffect[], nowMs: number): void {
    const ctx = this.ctx;
    ctx.save();
    for (const cone of cones) {
      const life = (cone.expiresAtMs - nowMs) / CONE_EFFECT_LIFETIME_MS;
      ctx.globalAlpha = Math.max(0, Math.min(1, life)) * 0.5;
      ctx.fillStyle = cone.color;
      const angle = Math.atan2(cone.direction.y, cone.direction.x);
      ctx.beginPath();
      ctx.moveTo(cone.origin.x, cone.origin.y);
      ctx.arc(cone.origin.x, cone.origin.y, cone.rangeUnits, angle - cone.angleRad / 2, angle + cone.angleRad / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawChests(chests: Chest[], nowMs: number): void {
    const ctx = this.ctx;
    const glow = 0.6 + Math.sin(nowMs / 260) * 0.15;
    for (const chest of chests) {
      const { x, y } = chest.position;
      const w = chest.radius * 2;
      const h = chest.radius * 1.4;
      ctx.save();
      ctx.shadowColor = `rgba(255, 200, 60, ${glow})`;
      ctx.shadowBlur = 12;
      // Base.
      ctx.fillStyle = "#4a2f14";
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = "#c8901e";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      // Domed lid.
      ctx.fillStyle = "#5c3a18";
      ctx.beginPath();
      ctx.ellipse(x, y - h / 2, w / 2, h / 2.4, 0, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      // Latch.
      ctx.fillStyle = "#ffcf4a";
      ctx.fillRect(x - 2, y - 3, 4, 8);
      ctx.restore();
    }
  }

  private drawWeaponPickups(pickups: WeaponPickup[], nowMs: number): void {
    const ctx = this.ctx;
    const pulse = 1 + Math.sin(nowMs / 300) * 0.12;
    for (const pickup of pickups) {
      const def = WEAPON_DEFS[pickup.weaponId];
      ctx.save();
      ctx.translate(pickup.position.x, pickup.position.y);
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 14;
      drawWeaponIcon(ctx, pickup.weaponId, pickup.radius * 2 * pulse * WEAPON_ICON_WORLD_SCALE, def.color);
      ctx.restore();
    }
  }

  private drawRewardPopups(popups: RewardPopupEffect[], nowMs: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "bold 13px Georgia";
    ctx.textAlign = "center";
    for (const popup of popups) {
      const life = (popup.expiresAtMs - nowMs) / REWARD_POPUP_LIFETIME_MS;
      const alpha = Math.max(0, Math.min(1, life));
      if (alpha <= 0) continue;
      const risen = (1 - life) * REWARD_POPUP_RISE_PX;
      const x = popup.position.x;
      const y = popup.position.y - 30 - risen;

      ctx.globalAlpha = alpha;
      const color = popup.kind === "gold" ? "#ffcf4a" : popup.kind === "xp" ? "#8fd35f" : popup.kind === "magnet" ? "#ff5a5a" : "#c81e1e";
      ctx.save();
      ctx.translate(x, y - 14);
      this.drawRewardIcon(popup.kind, color);
      ctx.restore();

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.fillText(popup.text, x, y);
    }
    ctx.restore();
  }

  private drawRewardIcon(kind: RewardPopupEffect["kind"], color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    if (kind === "gold") {
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "xp") {
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === "magnet") {
      // Horseshoe magnet silhouette.
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 6, Math.PI * 0.15, Math.PI * 0.85, false);
      ctx.stroke();
      ctx.fillRect(-8, -1, 3, 6);
      ctx.fillRect(5, -1, 3, 6);
    } else {
      // Perk — small gift-box diamond.
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawOrbs(orbs: XpOrb[], nowMs: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = "#6fae4a";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#8fd35f";
    const pulse = 1 + Math.sin(nowMs / 200) * 0.15;
    for (const orb of orbs) {
      ctx.beginPath();
      ctx.arc(orb.position.x, orb.position.y, orb.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawVignette(w: number, h: number, hpRatio: number): void {
    const ctx = this.ctx;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.max(w, h) * 0.75;
    const gradient = ctx.createRadialGradient(cx, cy, radius * 0.35, cx, cy, radius);
    const dangerAlpha = (1 - hpRatio) * 0.35;
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.7, `rgba(20,0,0,${0.2 + dangerAlpha})`);
    gradient.addColorStop(1, `rgba(0,0,0,${0.6 + dangerAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}

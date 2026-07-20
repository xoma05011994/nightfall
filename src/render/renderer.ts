import type { Enemy, Player, Projectile, Vec2, XpOrb } from "../types";

interface Splatter {
  position: Vec2;
  radius: number;
  alpha: number;
}

const SPLATTER_FIELD_HALF_SIZE = 4000;
const SPLATTER_COUNT = 260;

// Deterministic ground-texture splatters generated once and reused every
// frame — cheap atmosphere without needing image assets or truly infinite
// procedural generation (out of scope for v0.1's bounded playtest area).
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

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
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

  render(camera: Vec2, player: Player, enemies: Enemy[], projectiles: Projectile[], orbs: XpOrb[], nowMs: number): void {
    const ctx = this.ctx;
    const w = this.viewWidth;
    const h = this.viewHeight;

    ctx.fillStyle = "#070505";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 - camera.x, h / 2 - camera.y);

    this.drawSplatters(camera, w, h);
    this.drawOrbs(orbs, nowMs);
    this.drawEnemies(enemies);
    this.drawProjectiles(projectiles);
    this.drawPlayer(player, nowMs);

    ctx.restore();

    this.drawVignette(w, h, player.hp / player.maxHp);
  }

  private drawSplatters(camera: Vec2, w: number, h: number): void {
    const ctx = this.ctx;
    const margin = 60;
    for (const s of this.splatters) {
      const sx = s.position.x - camera.x + w / 2;
      const sy = s.position.y - camera.y + h / 2;
      if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) continue;
      ctx.beginPath();
      ctx.fillStyle = `rgba(139, 0, 0, ${s.alpha})`;
      ctx.ellipse(s.position.x, s.position.y, s.radius, s.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
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

  private drawEnemies(enemies: Enemy[]): void {
    const ctx = this.ctx;
    for (const enemy of enemies) {
      ctx.save();
      const spikes = 8;
      ctx.fillStyle = "#1c0d0d";
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
      ctx.strokeStyle = "#5c1414";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Glowing eyes for a bit of menace at low geometry cost.
      ctx.fillStyle = "#c81e1e";
      ctx.beginPath();
      ctx.arc(enemy.position.x - 4, enemy.position.y - 2, 1.6, 0, Math.PI * 2);
      ctx.arc(enemy.position.x + 4, enemy.position.y - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();

      if (enemy.hp < enemy.maxHp) this.drawHpBar(enemy.position, enemy.radius, enemy.hp / enemy.maxHp);
      ctx.restore();
    }
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
    ctx.shadowColor = "#ff6a00";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffb347";
    for (const p of projectiles) {
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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
    // Low HP tints the vignette bloodier and stronger — cheap "danger" feedback.
    const dangerAlpha = (1 - hpRatio) * 0.35;
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.7, `rgba(20,0,0,${0.25 + dangerAlpha})`);
    gradient.addColorStop(1, `rgba(0,0,0,${0.75 + dangerAlpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}

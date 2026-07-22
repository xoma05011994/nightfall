import { FENCE_POST_SPACING, REWARD_POPUP_LIFETIME_MS, REWARD_POPUP_RISE_PX, WORLD_HALF_SIZE } from "@nightfall/shared/constants";
import { drawWeaponIcon } from "./weaponIcons";
import { drawEntityIcon, getCharacterImage, getChestImage, getEnemyImage, playerColorForIndex, rotationForAngle, rotationToFace, type PlayerColor } from "./entityIcons";
import { WEAPON_DEFS } from "@nightfall/shared/systems/weapons";
import { shurikenAngle } from "@nightfall/shared/systems/statusEffects";
import { SHURIKEN_ORBIT_RADIUS } from "@nightfall/shared/constants";
import type { BeamEffect, Chest, ConeEffect, Enemy, LevelPalette, LightningEffect, Obstacle, Player, Projectile, RewardPopupEffect, Vec2, WeaponPickup, XpOrb } from "@nightfall/shared/types";
import type { MatchSnapshot, PlayerSnapshot } from "@nightfall/shared/multiplayer";

// A co-op teammate to render, with the color assigned by their index in the
// room's player list (see renderMultiplayer) — not part of the server's
// MatchSnapshot contract, purely a client-side rendering concern.
export interface RemotePlayerRenderInfo extends PlayerSnapshot {
  color: PlayerColor;
}

const DEFAULT_PALETTE: LevelPalette = { bg: "#1c1310", splatterRGB: "139, 0, 0", fence: "#3a2416" };

interface Splatter {
  position: Vec2;
  radius: number;
  alpha: number;
}

export interface RenderState {
  player: Player;
  obstacles: Obstacle[];
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
  // Co-op only — the rest of the party, drawn alongside the local player.
  // Undefined/empty in solo.
  otherPlayers?: RemotePlayerRenderInfo[];
  // Which knight-color sprite to draw the local player as. Solo always
  // omits this (defaults to "blue"); co-op sets it from the local player's
  // index in the room's player list, same scheme as otherPlayers' colors.
  playerColor?: PlayerColor;
  // atan2(dy, dx) angle the local player's sprite should face — always the
  // live mouse-aim direction, computed fresh by the caller every frame
  // (both solo and multiplayer read it straight from input, never from
  // Player.facingAngle, so the local player's own rotation has zero network
  // latency). Defaults to "down" (the sprites' neutral orientation) when
  // omitted, e.g. an initial render before any mouse movement.
  playerAimAngle?: number;
}

const SPLATTER_FIELD_HALF_SIZE = 4000;
const SPLATTER_COUNT = 260;
const BEAM_EFFECT_LIFETIME_MS = 120;
const CONE_EFFECT_LIFETIME_MS = 100;
const LIGHTNING_EFFECT_LIFETIME_MS = 200;
const LIGHTNING_SEGMENTS = 6;
const LIGHTNING_JITTER = 14;
const WEAPON_ICON_WORLD_SCALE = 3.5;

// On-screen max-dimension (px) for each raster sprite, independent of the
// small collision-only radius those entities use for physics — matches the
// weapon icons' precedent of drawing noticeably larger than the hitbox so
// the art actually reads.
const PLAYER_ICON_SIZE = 84;
const CHEST_ICON_SIZE = 85;
const ENEMY_ICON_SIZES: Record<Enemy["type"], number> = {
  grunt: 70,
  brute: 100,
  shooter: 70,
  boss: 170,
};
// How far above each enemy's position its hp bar/label sits — hand-tuned
// per type since the sprites' actual pixel heights don't scale linearly
// with ENEMY_ICON_SIZES (some are wider than tall, some taller than wide).
const ENEMY_HP_BAR_OFFSET: Record<Enemy["type"], number> = {
  grunt: 45,
  brute: 62,
  shooter: 38,
  boss: 95,
};
const BOSS_LABEL_OFFSET = 112;

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
    this.drawObstacles(state.obstacles, camera, w, h);
    this.drawConeEffects(state.coneEffects, nowMs);
    this.drawChests(state.chests, nowMs);
    this.drawWeaponPickups(state.weaponPickups, nowMs);
    this.drawOrbs(state.xpOrbs, nowMs);
    this.drawEnemies(state.enemies, state.player.position, nowMs);
    this.drawBeamEffects(state.beamEffects, nowMs);
    this.drawLightningEffects(state.lightningEffects, nowMs);
    this.drawProjectiles(state.projectiles);
    this.drawProjectiles(state.enemyProjectiles);
    this.drawAura(state.player, nowMs);
    this.drawPlayer(state.player, state.playerColor ?? "blue", state.playerAimAngle ?? Math.PI / 2, nowMs);
    if (!state.player.isGhost) this.drawShurikens(state.player, nowMs);
    if (state.otherPlayers) {
      for (const p of state.otherPlayers) this.drawRemotePlayer(p, nowMs);
    }
    this.drawRewardPopups(state.rewardPopups, nowMs);

    ctx.restore();

    this.drawVignette(w, h, state.player.hp / state.player.maxHp);
  }

  // Co-op: builds a RenderState from the server snapshot (local player drives
  // the camera and reuses the same solo draw calls; the rest of the party is
  // drawn via drawRemotePlayer) and delegates to the normal render() — this
  // keeps one drawing pipeline for both solo and multiplayer.
  renderMultiplayer(snapshot: MatchSnapshot, localPlayerId: string, localAimAngle: number, nowMs: number): void {
    const localIndex = snapshot.players.findIndex((p) => p.id === localPlayerId);
    if (localIndex === -1) return;
    const local = snapshot.players[localIndex]!;
    const otherPlayers = snapshot.players
      .map((p, i) => ({ ...p, color: playerColorForIndex(i) }))
      .filter((p) => p.id !== localPlayerId);
    this.render(
      {
        player: local.player,
        playerColor: playerColorForIndex(localIndex),
        playerAimAngle: localAimAngle,
        obstacles: snapshot.obstacles,
        enemies: snapshot.enemies,
        projectiles: snapshot.projectiles,
        enemyProjectiles: snapshot.enemyProjectiles,
        xpOrbs: snapshot.xpOrbs,
        weaponPickups: snapshot.weaponPickups,
        chests: snapshot.chests,
        beamEffects: snapshot.beamEffects,
        coneEffects: snapshot.coneEffects,
        lightningEffects: snapshot.lightningEffects,
        rewardPopups: snapshot.rewardPopups,
        otherPlayers,
      },
      nowMs,
    );
  }

  private drawRemotePlayer(snapshot: RemotePlayerRenderInfo, nowMs: number): void {
    const ctx = this.ctx;
    const player = snapshot.player;
    // Remote players' facing comes from the server's broadcast
    // Player.facingAngle (their last aim input), not a live cursor we don't
    // have access to.
    const rotation = rotationForAngle(player.facingAngle);
    if (player.isGhost) {
      this.drawGhost(player, snapshot.color, rotation, nowMs);
    } else {
      this.drawCharacterSprite(player, snapshot.color, rotation, nowMs);
      this.drawShurikens(player, nowMs);
    }

    ctx.save();
    ctx.fillStyle = player.isGhost ? "rgba(200, 220, 255, 0.55)" : "#d8cfc2";
    ctx.font = "12px Georgia";
    ctx.textAlign = "center";
    const label = player.isGhost ? `${snapshot.displayName} (ghost)` : snapshot.displayName;
    ctx.fillText(label, player.position.x, player.position.y - PLAYER_ICON_SIZE * 0.62);
    ctx.restore();
  }

  // The knight sprite for a living player — a colored glow behind it keeps
  // party members readable at a glance even before you notice the outfit
  // color (mirrors the old plain-circle glow this replaced). `rotation` is
  // a ctx.rotate() amount (see entityIcons.rotationToFace/rotationForAngle),
  // not a raw facing angle.
  private drawCharacterSprite(player: Player, color: PlayerColor, rotation: number, nowMs: number): void {
    const ctx = this.ctx;
    const pulse = 1 + Math.sin(nowMs / 260) * 0.03;
    const glow = color === "blue" ? "#4ee2ff" : color === "gold" ? "#ffcf4a" : color === "green" ? "#6fe86f" : "#ff5a5a";
    ctx.save();
    ctx.translate(player.position.x, player.position.y);
    ctx.rotate(rotation);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    drawEntityIcon(ctx, getCharacterImage(color), PLAYER_ICON_SIZE * pulse);
    ctx.restore();
  }

  // A downed player: the same knight sprite, desaturated and blue-shifted
  // via canvas filters, translucent and gently pulsing — clearly "not
  // really here" versus a living party member's solid, glowing sprite.
  private drawGhost(player: Player, color: PlayerColor, rotation: number, nowMs: number): void {
    const ctx = this.ctx;
    const pulse = 1 + Math.sin(nowMs / 400) * 0.08;
    ctx.save();
    ctx.translate(player.position.x, player.position.y);
    ctx.rotate(rotation);
    ctx.globalAlpha = 0.5;
    ctx.filter = "grayscale(70%) brightness(1.5) saturate(1.6) hue-rotate(160deg)";
    ctx.shadowColor = "#bcd4ff";
    ctx.shadowBlur = 16;
    drawEntityIcon(ctx, getCharacterImage(color), PLAYER_ICON_SIZE * pulse);
    ctx.restore();
  }

  // Shurikens perk — small spinning blades orbiting the player. Positions
  // come from the exact same shurikenAngle() formula the sim uses (see
  // statusEffects.ts), so what's drawn always matches where a hit can
  // actually land — no separate client-side visual-only state to drift out
  // of sync with the server/solo simulation.
  private drawShurikens(player: Player, nowMs: number): void {
    if (player.shurikenCount <= 0) return;
    const ctx = this.ctx;
    const spin = nowMs / 120; // each blade's own rotation, independent of orbit angle
    for (let i = 0; i < player.shurikenCount; i++) {
      const angle = shurikenAngle(i, player.shurikenCount, nowMs);
      const x = player.position.x + Math.cos(angle) * SHURIKEN_ORBIT_RADIUS;
      const y = player.position.y + Math.sin(angle) * SHURIKEN_ORBIT_RADIUS;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(spin);
      ctx.shadowColor = "#c0c8d8";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#8fa0b8";
      ctx.strokeStyle = "#e8edf5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let p = 0; p < 4; p++) {
        const a = (p / 4) * Math.PI * 2;
        const outer = { x: Math.cos(a) * 9, y: Math.sin(a) * 9 };
        const innerA = a + Math.PI / 4;
        const inner = { x: Math.cos(innerA) * 3, y: Math.sin(innerA) * 3 };
        if (p === 0) ctx.moveTo(outer.x, outer.y);
        else ctx.lineTo(outer.x, outer.y);
        ctx.lineTo(inner.x, inner.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
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

  // Static terrain — blocks the player only (see systems/obstacles.ts),
  // enemies path straight through. Each kind gets a distinct hand-drawn
  // vector look rather than raster art, matching the fence/splatters'
  // existing treatment of ground-layer decoration.
  private drawObstacles(obstacles: Obstacle[], camera: Vec2, w: number, h: number): void {
    const ctx = this.ctx;
    for (const o of obstacles) {
      if (!this.inView(o.position.x, o.position.y, camera, w, h, o.radius + 40)) continue;
      ctx.save();
      ctx.translate(o.position.x, o.position.y);
      if (o.kind === "tree") {
        // Trunk.
        ctx.fillStyle = "#3a2416";
        ctx.fillRect(-o.radius * 0.12, o.radius * 0.1, o.radius * 0.24, o.radius * 0.7);
        // Canopy — three overlapping dark circles read as foliage.
        ctx.fillStyle = "#1c3a1c";
        ctx.strokeStyle = "#0d1f0d";
        ctx.lineWidth = 2;
        for (const [dx, dy, r] of [
          [0, -o.radius * 0.3, o.radius * 0.75],
          [-o.radius * 0.45, 0, o.radius * 0.55],
          [o.radius * 0.45, 0, o.radius * 0.55],
        ] as const) {
          ctx.beginPath();
          ctx.arc(dx, dy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      } else if (o.kind === "lake") {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.beginPath();
        ctx.ellipse(3, 5, o.radius, o.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        const gradient = ctx.createRadialGradient(-o.radius * 0.3, -o.radius * 0.3, 0, 0, 0, o.radius);
        gradient.addColorStop(0, "#2a5a72");
        gradient.addColorStop(0.6, "#123048");
        gradient.addColorStop(1, "#0a1c2c");
        ctx.fillStyle = gradient;
        ctx.strokeStyle = "#4a7a94";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, o.radius, o.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Hole — a jagged dark void with a broken dirt rim.
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(3, 5, o.radius, o.radius * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#2a1810";
        ctx.beginPath();
        const spikes = 10;
        for (let i = 0; i < spikes; i++) {
          const angle = (i / spikes) * Math.PI * 2;
          const jitter = i % 2 === 0 ? 1 : 0.82;
          const x = Math.cos(angle) * o.radius * jitter;
          const y = Math.sin(angle) * o.radius * 0.85 * jitter;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, o.radius * 0.75);
        gradient.addColorStop(0, "#000000");
        gradient.addColorStop(1, "#1c0f08");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(0, 0, o.radius * 0.7, o.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // aimAngle is the live atan2(dy, dx) from the local mouse position — see
  // RenderState.playerAimAngle.
  private drawPlayer(player: Player, color: PlayerColor, aimAngle: number, nowMs: number): void {
    const rotation = rotationForAngle(aimAngle);
    if (player.isGhost) {
      this.drawGhost(player, color, rotation, nowMs);
      return;
    }
    this.drawCharacterSprite(player, color, rotation, nowMs);
  }

  private drawEnemies(enemies: Enemy[], target: Vec2, nowMs: number): void {
    const ctx = this.ctx;
    for (const enemy of enemies) {
      ctx.save();
      const isBrute = enemy.type === "brute";
      // Kept from the old hand-drawn look — a colored glow behind each
      // sprite still reads the threat type/rarity at a glance (purple boss,
      // cyan shooter, green brute), same palette as before.
      const glowColor = enemy.isBoss ? "#a020f0" : enemy.type === "shooter" ? "#4ee2ff" : isBrute ? "#4fd94f" : "#c81e1e";
      ctx.translate(enemy.position.x, enemy.position.y);
      // Faces the local player — reads as "coming right at you" regardless
      // of which party member the AI is actually pathing toward.
      ctx.rotate(rotationToFace(target.x - enemy.position.x, target.y - enemy.position.y));
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = enemy.isBoss ? 20 : isBrute ? 12 : 10;
      drawEntityIcon(ctx, getEnemyImage(enemy.type), ENEMY_ICON_SIZES[enemy.type]);
      ctx.shadowBlur = 0;

      if (enemy.burnDamagePerTick > 0) {
        const flicker = 0.5 + Math.sin(nowMs / 90 + enemy.id) * 0.2;
        ctx.fillStyle = `rgba(255, 106, 0, ${flicker})`;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (enemy.isBoss) {
        ctx.save();
        ctx.fillStyle = "#e042ff";
        ctx.font = "bold 12px Georgia";
        ctx.textAlign = "center";
        ctx.fillText("BOSS", enemy.position.x, enemy.position.y - BOSS_LABEL_OFFSET);
        ctx.restore();
        this.drawHpBar(enemy.position, enemy.radius * 2.2, ENEMY_HP_BAR_OFFSET.boss, enemy.hp / enemy.maxHp);
      } else if (enemy.hp < enemy.maxHp) {
        this.drawHpBar(enemy.position, enemy.radius * 2.2, ENEMY_HP_BAR_OFFSET[enemy.type], enemy.hp / enemy.maxHp);
      }
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

  private drawHpBar(position: Vec2, width: number, aboveOffset: number, ratio: number): void {
    const ctx = this.ctx;
    const y = position.y - aboveOffset;
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

  // Two passes per beam: a wide, low-alpha "glow" stroke underneath a
  // narrow, near-opaque "core" stroke on top — reads as a much more
  // luminous laser than a single flat-color line, without needing a
  // gradient (shadowBlur alone does the diffusion).
  private drawBeamEffects(beams: BeamEffect[], nowMs: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = "round";
    for (const beam of beams) {
      const life = (beam.expiresAtMs - nowMs) / BEAM_EFFECT_LIFETIME_MS;
      const alpha = Math.max(0, Math.min(1, life));
      if (alpha <= 0) continue;

      ctx.beginPath();
      ctx.moveTo(beam.from.x, beam.from.y);
      ctx.lineTo(beam.to.x, beam.to.y);

      ctx.globalAlpha = alpha * 0.35;
      ctx.strokeStyle = beam.color;
      ctx.shadowColor = beam.color;
      ctx.shadowBlur = 22;
      ctx.lineWidth = 12;
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#ffffff";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3;
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

  // Flamethrower cone, layered instead of a single flat-color wedge: a warm
  // radial gradient (white-hot near the player, fading through orange to
  // transparent at the tip) for the body of the flame, a narrower brighter
  // "hot core" wedge on top, and a handful of ember specks scattered inside
  // — each cone effect only lives ~100ms, but the weapon refires every
  // 60ms, so consecutive overlapping cones is what actually reads as a
  // flickering flame rather than a static shape. Ember positions are
  // deterministic per-effect (seeded from its expiry + fire count) so they
  // don't need any persistent particle state.
  private drawConeEffects(cones: ConeEffect[], nowMs: number): void {
    const ctx = this.ctx;
    for (const cone of cones) {
      const life = (cone.expiresAtMs - nowMs) / CONE_EFFECT_LIFETIME_MS;
      const alpha = Math.max(0, Math.min(1, life));
      if (alpha <= 0) continue;
      const angle = Math.atan2(cone.direction.y, cone.direction.x);
      const seed = cone.expiresAtMs + cone.origin.x + cone.origin.y * 3;

      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      const gradient = ctx.createRadialGradient(cone.origin.x, cone.origin.y, 0, cone.origin.x, cone.origin.y, cone.rangeUnits);
      gradient.addColorStop(0, "rgba(255, 235, 150, 0.95)");
      gradient.addColorStop(0.35, "rgba(255, 140, 40, 0.75)");
      gradient.addColorStop(1, "rgba(120, 20, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(cone.origin.x, cone.origin.y);
      ctx.arc(cone.origin.x, cone.origin.y, cone.rangeUnits, angle - cone.angleRad / 2, angle + cone.angleRad / 2);
      ctx.closePath();
      ctx.fill();

      // Hot core — a narrower, shorter wedge for a brighter flame center.
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = "rgba(255, 250, 210, 0.9)";
      ctx.beginPath();
      ctx.moveTo(cone.origin.x, cone.origin.y);
      ctx.arc(cone.origin.x, cone.origin.y, cone.rangeUnits * 0.55, angle - cone.angleRad * 0.28, angle + cone.angleRad * 0.28);
      ctx.closePath();
      ctx.fill();

      // Embers — small glowing specks scattered along the cone's length.
      ctx.fillStyle = "#ffcf4a";
      ctx.shadowColor = "#ff6a00";
      ctx.shadowBlur = 6;
      for (let i = 0; i < 5; i++) {
        const t = 0.3 + 0.65 * ((seededJitter(seed, i * 2) + 1) / 2);
        const spread = seededJitter(seed, i * 2 + 1) * cone.angleRad * 0.45;
        const r = cone.rangeUnits * t;
        const a = angle + spread;
        ctx.globalAlpha = alpha * (0.5 + 0.5 * (1 - t));
        ctx.beginPath();
        ctx.arc(cone.origin.x + Math.cos(a) * r, cone.origin.y + Math.sin(a) * r, 2 + 1.5 * (1 - t), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawChests(chests: Chest[], nowMs: number): void {
    const ctx = this.ctx;
    const glow = 0.6 + Math.sin(nowMs / 260) * 0.15;
    for (const chest of chests) {
      ctx.save();
      ctx.translate(chest.position.x, chest.position.y);
      ctx.shadowColor = `rgba(255, 200, 60, ${glow})`;
      ctx.shadowBlur = 12;
      drawEntityIcon(ctx, getChestImage(), CHEST_ICON_SIZE);
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
      drawWeaponIcon(ctx, pickup.weaponId, pickup.radius * 2 * pulse * WEAPON_ICON_WORLD_SCALE);
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

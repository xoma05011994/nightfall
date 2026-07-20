import "./ui/style.css";
import { Renderer } from "./render/renderer";
import { Hud } from "./ui/hud";
import { StartScreen } from "./ui/startScreen";
import { PerkModal } from "./ui/perkModal";
import { GameOverScreen } from "./ui/gameOverScreen";
import { InputManager } from "./input/InputManager";
import { Game } from "./game/Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root")!;

const renderer = new Renderer(canvas);
const input = new InputManager();
const hud = new Hud(uiRoot);
const perkModal = new PerkModal(uiRoot);
const gameOverScreen = new GameOverScreen(uiRoot, () => {
  gameOverScreen.hide();
  game.start();
  hud.setVisible(true);
});

const game = new Game({
  onLevelUp: (offers) => {
    perkModal.show(offers, (perk) => {
      game.applyPerk(perk);
    });
  },
  onGameOver: () => {
    hud.setVisible(false);
    gameOverScreen.show({ elapsedMs: game.elapsedMs, level: game.player.level, kills: game.kills });
  },
});

const startScreen = new StartScreen(uiRoot, () => {
  startScreen.hide();
  game.start();
  hud.setVisible(true);
});

hud.setVisible(false);

function renderNow(): void {
  renderer.render(game.player.position, game.player, game.enemies, game.projectiles, game.xpOrbs, performance.now());
}

function resize(): void {
  // window.innerWidth/Height can briefly read 0 before the initial layout
  // pass completes (seen in some embedded/preview browser contexts) — fall
  // back to documentElement's box, which is populated as soon as the DOM
  // exists rather than waiting on window layout. Re-render immediately
  // afterward so a late resize (e.g. once layout actually settles) doesn't
  // sit on a stale/blank canvas until the next rAF tick.
  const width = window.innerWidth || document.documentElement.clientWidth;
  const height = window.innerHeight || document.documentElement.clientHeight;
  renderer.resize(width, height);
  renderNow();
}
window.addEventListener("resize", resize);
new ResizeObserver(resize).observe(document.body);
resize();

let lastTime = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  const moveVector = input.getMoveVector();
  game.update(dt, moveVector);

  if (game.phase === "playing" || game.phase === "levelup") {
    hud.update({
      hp: game.player.hp,
      maxHp: game.player.maxHp,
      xp: game.player.xp,
      xpToNext: game.player.xpToNext,
      level: game.player.level,
      elapsedMs: game.elapsedMs,
      kills: game.kills,
    });
  }

  renderer.render(game.player.position, game.player, game.enemies, game.projectiles, game.xpOrbs, now);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

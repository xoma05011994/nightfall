import "./ui/style.css";
import { Renderer } from "./render/renderer";
import { Hud, type HudWeaponSlot } from "./ui/hud";
import { StartScreen } from "./ui/startScreen";
import { PerkModal } from "./ui/perkModal";
import { GameOverScreen } from "./ui/gameOverScreen";
import { WeaponPromptModal } from "./ui/weaponPromptModal";
import { InputManager } from "./input/InputManager";
import { Game } from "./game/Game";
import { WEAPON_DEFS } from "./systems/weapons";
import { normalize } from "./math";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root")!;

const renderer = new Renderer(canvas);
const input = new InputManager();
const hud = new Hud(uiRoot);
const perkModal = new PerkModal(uiRoot);
const weaponPromptModal = new WeaponPromptModal(uiRoot);
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
  onWeaponPrompt: (info) => {
    const slot2 = game.player.weaponSlots[1];
    const slot3 = game.player.weaponSlots[2];
    weaponPromptModal.show(
      {
        incomingName: WEAPON_DEFS[info.weaponId].name,
        slot2Name: slot2 ? WEAPON_DEFS[slot2.weaponId].name : "—",
        slot3Name: slot3 ? WEAPON_DEFS[slot3.weaponId].name : "—",
      },
      (choice) => {
        game.resolveWeaponPrompt(choice);
      },
    );
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
  renderer.render(
    {
      player: game.player,
      enemies: game.enemies,
      projectiles: game.projectiles,
      xpOrbs: game.xpOrbs,
      weaponPickups: game.weaponPickups,
      beamEffects: game.beamEffects,
      coneEffects: game.coneEffects,
    },
    performance.now(),
  );
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
  const mousePos = input.getMouseScreenPos();
  const aimDir = normalize({ x: mousePos.x - renderer.viewWidth / 2, y: mousePos.y - renderer.viewHeight / 2 });
  const fireHeld = input.isFireHeld();

  if (input.consumeJustPressed("Digit1")) game.equipSlot(0);
  if (input.consumeJustPressed("Digit2")) game.equipSlot(1);
  if (input.consumeJustPressed("Digit3")) game.equipSlot(2);
  if (input.consumeJustPressed("KeyR")) game.reloadEquipped();

  game.update(dt, moveVector, aimDir, fireHeld, now);

  if (game.phase === "playing" || game.phase === "levelup" || game.phase === "weaponPrompt") {
    const slots: [HudWeaponSlot, HudWeaponSlot, HudWeaponSlot] = [0, 1, 2].map((i) => {
      const slot = game.player.weaponSlots[i as 0 | 1 | 2];
      return { name: slot ? WEAPON_DEFS[slot.weaponId].name : null, equipped: game.player.equippedSlot === i };
    }) as [HudWeaponSlot, HudWeaponSlot, HudWeaponSlot];

    const equipped = game.player.weaponSlots[game.player.equippedSlot];
    const equippedDef = equipped ? WEAPON_DEFS[equipped.weaponId] : null;

    hud.update({
      hp: game.player.hp,
      maxHp: game.player.maxHp,
      xp: game.player.xp,
      xpToNext: game.player.xpToNext,
      level: game.player.level,
      elapsedMs: game.elapsedMs,
      kills: game.kills,
      slots,
      ammo: equipped?.ammo ?? 0,
      magazineSize: equippedDef?.magazineSize ?? 1,
      reloading: equipped?.reloading ?? false,
      reloadRatio: equipped && equippedDef ? equipped.reloadTimerMs / equippedDef.reloadMs : 0,
    });
  }

  renderer.render(
    {
      player: game.player,
      enemies: game.enemies,
      projectiles: game.projectiles,
      xpOrbs: game.xpOrbs,
      weaponPickups: game.weaponPickups,
      beamEffects: game.beamEffects,
      coneEffects: game.coneEffects,
    },
    now,
  );

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

import "./ui/style.css";
import { Renderer } from "./render/renderer";
import { Hud, type HudWeaponSlot } from "./ui/hud";
import { PerkTray } from "./ui/perkTray";
import { MainMenu } from "./ui/mainMenu";
import { LevelSelectScreen } from "./ui/levelSelectScreen";
import { ShopScreen } from "./ui/shopScreen";
import { PerkModal } from "./ui/perkModal";
import { GameOverScreen } from "./ui/gameOverScreen";
import { WeaponPromptModal } from "./ui/weaponPromptModal";
import { InputManager } from "./input/InputManager";
import { Game } from "./game/Game";
import { LEVELS } from "./systems/levels";
import { loadProfile, purchaseWeaponUpgrade, saveProfile } from "./systems/profile";
import { WEAPON_DEFS } from "./systems/weapons";
import { normalize } from "./math";
import type { LevelDef } from "./types";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root")!;

const renderer = new Renderer(canvas);
const input = new InputManager();
const hud = new Hud(uiRoot);
const perkTray = new PerkTray(uiRoot);
const perkModal = new PerkModal(uiRoot);
const weaponPromptModal = new WeaponPromptModal(uiRoot);

let profile = loadProfile();

function showMainMenu(): void {
  mainMenu.show();
}

function startRun(mode: "endless" | "adventure", levelDef: LevelDef | null): void {
  renderer.setPalette(levelDef?.palette ?? null);
  game.start(mode, levelDef, profile.weaponUpgrades);
  hud.setVisible(true);
  perkTray.setVisible(true);
}

const gameOverScreen = new GameOverScreen(uiRoot, () => {
  gameOverScreen.hide();
  if (game.mode === "adventure") {
    // Adventure runs are discrete trials picked from the level list, win or
    // lose — back to the menu rather than silently re-running the same
    // level with the same seed.
    showMainMenu();
  } else {
    startRun("endless", null);
  }
});

const levelSelectScreen = new LevelSelectScreen(
  uiRoot,
  LEVELS,
  (level) => {
    levelSelectScreen.hide();
    startRun("adventure", level);
  },
  () => {
    levelSelectScreen.hide();
    showMainMenu();
  },
);

const shopScreen = new ShopScreen(
  uiRoot,
  (weaponId) => {
    const updated = purchaseWeaponUpgrade(profile, weaponId);
    if (updated) {
      profile = updated;
      saveProfile(profile);
    }
    shopScreen.show(profile);
  },
  () => {
    shopScreen.hide();
    showMainMenu();
  },
);

const mainMenu = new MainMenu(uiRoot, {
  onEndless: () => {
    mainMenu.hide();
    startRun("endless", null);
  },
  onAdventure: () => {
    mainMenu.hide();
    levelSelectScreen.show();
  },
  onShop: () => {
    mainMenu.hide();
    shopScreen.show(profile);
  },
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
    perkTray.setVisible(false);
    gameOverScreen.show({ won: false, elapsedMs: game.elapsedMs, level: game.player.level, kills: game.kills, gold: game.goldEarned });
  },
  onVictory: () => {
    hud.setVisible(false);
    perkTray.setVisible(false);
    // Coins only bank to the persistent profile on an actual level
    // completion — a defeat still shows the run's gold total, but it's
    // never saved (see systems/profile.ts).
    if (game.mode === "adventure") {
      profile = { ...profile, coins: profile.coins + game.goldEarned };
      saveProfile(profile);
    }
    gameOverScreen.show({ won: true, elapsedMs: game.elapsedMs, level: game.player.level, kills: game.kills, gold: game.goldEarned });
  },
});

hud.setVisible(false);
perkTray.setVisible(false);

function buildRenderState() {
  return {
    player: game.player,
    enemies: game.enemies,
    projectiles: game.projectiles,
    xpOrbs: game.xpOrbs,
    weaponPickups: game.weaponPickups,
    chests: game.chests,
    beamEffects: game.beamEffects,
    coneEffects: game.coneEffects,
    lightningEffects: game.lightningEffects,
  };
}

function renderNow(): void {
  renderer.render(buildRenderState(), performance.now());
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
      gold: game.goldEarned,
      slots,
      ammo: equipped?.ammo ?? 0,
      magazineSize: equippedDef?.magazineSize ?? 1,
      reloading: equipped?.reloading ?? false,
      reloadRatio: equipped && equippedDef ? equipped.reloadTimerMs / equippedDef.reloadMs : 0,
    });
    perkTray.update(game.pickedPerks);
  }

  renderer.render(buildRenderState(), now);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

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
import { PauseModal } from "./ui/pauseModal";
import { SandboxPanel } from "./ui/sandboxPanel";
import { PerkTreeScreen } from "./ui/perkTreeScreen";
import { MultiplayerScreen } from "./ui/multiplayerScreen";
import { InputManager } from "./input/InputManager";
import { Game } from "./game/Game";
import { MultiplayerGame } from "./net/MultiplayerGame";
import { LEVELS } from "@nightfall/shared/systems/levels";
import { loadProfile, purchaseWeaponUpgrade, saveProfile, unlockNextLevel } from "@nightfall/shared/systems/profile";
import { WEAPON_DEFS, isWeaponMaxLevel } from "@nightfall/shared/systems/weapons";
import { getPerkById } from "@nightfall/shared/systems/perks";
import { normalize } from "@nightfall/shared/math";
import type { GameMode, LevelDef } from "@nightfall/shared/types";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root")!;

const renderer = new Renderer(canvas);
const input = new InputManager();
const hud = new Hud(uiRoot);
const perkTray = new PerkTray(uiRoot);
const perkModal = new PerkModal(uiRoot);
const weaponPromptModal = new WeaponPromptModal(uiRoot);
const sandboxPanel = new SandboxPanel(uiRoot, {
  onSpawnEnemy: (type) => game.sandboxSpawnEnemy(type),
  onClearEnemies: () => game.sandboxClearEnemies(),
  onEquipWeapon: (weaponId, level) => game.sandboxEquipWeapon(1, weaponId, level),
  onApplyPerk: (perk) => game.sandboxApplyPerk(perk),
});

let profile = loadProfile();

function showMainMenu(): void {
  mainMenu.show();
}

function leaveRunToMenu(): void {
  game.leaveToMenu();
  pauseModal.hide();
  hud.setVisible(false);
  perkTray.setVisible(false);
  sandboxPanel.setVisible(false);
  showMainMenu();
}

const pauseModal = new PauseModal(
  uiRoot,
  () => {
    game.resume();
    pauseModal.hide();
  },
  leaveRunToMenu,
);

const perkTreeScreen = new PerkTreeScreen(uiRoot, () => {
  perkTreeScreen.hide();
  showMainMenu();
});

// v0.6 M1 — co-op Endless. inMultiplayer gates frame() between the solo
// Game loop and the multiplayer send/render loop; they never run
// concurrently. Movement-only for M1 — no enemies/combat/xp sync yet.
const multiplayerGame = new MultiplayerGame();
let inMultiplayer = false;

multiplayerGame.onLevelUp((offerIds) => {
  const offers = offerIds.map((id) => getPerkById(id)).filter((p): p is NonNullable<typeof p> => p !== undefined);
  perkModal.show(offers, (perk) => {
    multiplayerGame.chooseUpgrade(perk.id);
  });
});

const roomBadge = document.createElement("div");
roomBadge.className = "mp-room-badge";
roomBadge.style.display = "none";
uiRoot.appendChild(roomBadge);

function leaveMultiplayer(): void {
  multiplayerGame.disconnect();
  inMultiplayer = false;
  roomBadge.style.display = "none";
  hud.setVisible(false);
  perkTray.setVisible(false);
  showMainMenu();
}

const multiplayerScreen = new MultiplayerScreen(uiRoot, {
  onCreate: async (displayName) => {
    try {
      const roomCode = await multiplayerGame.createRoom(displayName);
      multiplayerScreen.hide();
      inMultiplayer = true;
      hud.setVisible(true);
      perkTray.setVisible(true);
      roomBadge.innerHTML = `ROOM CODE: <span class="mp-room-code">${roomCode}</span>`;
      roomBadge.style.display = "block";
    } catch (err) {
      multiplayerScreen.showError(err instanceof Error ? err.message : "Failed to create room");
    }
  },
  onJoin: async (displayName, roomCode) => {
    try {
      const joined = await multiplayerGame.joinRoom(displayName, roomCode);
      if (!joined) {
        multiplayerScreen.showError("Room not found");
        return;
      }
      multiplayerScreen.hide();
      inMultiplayer = true;
      hud.setVisible(true);
      perkTray.setVisible(true);
      roomBadge.innerHTML = `ROOM CODE: <span class="mp-room-code">${roomCode}</span>`;
      roomBadge.style.display = "block";
    } catch (err) {
      multiplayerScreen.showError(err instanceof Error ? err.message : "Failed to join room");
    }
  },
  onBack: () => {
    multiplayerScreen.hide();
    showMainMenu();
  },
});

function startRun(mode: GameMode, levelDef: LevelDef | null): void {
  renderer.setPalette(levelDef?.palette ?? null);
  game.start(mode, levelDef, profile.weaponUpgrades);
  hud.setVisible(true);
  perkTray.setVisible(true);
  sandboxPanel.setVisible(mode === "sandbox");
  sandboxPrevEnemyHp = new Map();
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
    levelSelectScreen.show(profile.unlockedLevelIds);
  },
  onShop: () => {
    mainMenu.hide();
    shopScreen.show(profile);
  },
  onSandbox: () => {
    mainMenu.hide();
    startRun("sandbox", null);
  },
  onPerkTree: () => {
    mainMenu.hide();
    perkTreeScreen.show();
  },
  onMultiplayer: () => {
    mainMenu.hide();
    multiplayerScreen.show();
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
    // never saved (see systems/profile.ts). Winning also unlocks the next
    // level in sequence.
    if (game.mode === "adventure") {
      profile = { ...profile, coins: profile.coins + game.goldEarned };
      if (game.levelDef) profile = unlockNextLevel(profile, game.levelDef.id);
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
    enemyProjectiles: game.enemyProjectiles,
    rewardPopups: game.rewardPopups,
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
// Snapshotted each frame in Sandbox mode to compute a live "damage dealt"
// readout by comparing enemy hp before/after game.update() — a dead enemy's
// full remaining hp counts as damage dealt that frame (not exact on
// overkill, but close enough for a dev readout).
let sandboxPrevEnemyHp = new Map<number, number>();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  const moveVector = input.getMoveVector();
  const mousePos = input.getMouseScreenPos();
  const aimDir = normalize({ x: mousePos.x - renderer.viewWidth / 2, y: mousePos.y - renderer.viewHeight / 2 });
  const fireHeld = input.isFireHeld();

  if (inMultiplayer) {
    if (input.consumeJustPressed("Escape")) leaveMultiplayer();
    multiplayerGame.sendInput(dt, moveVector, aimDir, fireHeld);
    const snapshot = multiplayerGame.latestSnapshot;
    if (snapshot) {
      renderer.renderMultiplayer(snapshot, multiplayerGame.playerId, now);
      const local = snapshot.players.find((p) => p.id === multiplayerGame.playerId)?.player;
      if (local) {
        const slots: [HudWeaponSlot, HudWeaponSlot, HudWeaponSlot] = [0, 1, 2].map((i) => {
          const slot = local.weaponSlots[i as 0 | 1 | 2];
          return {
            name: slot ? WEAPON_DEFS[slot.weaponId].name : null,
            equipped: local.equippedSlot === i,
            icon: slot ? WEAPON_DEFS[slot.weaponId].icon : null,
            level: slot?.level ?? 1,
            maxed: slot ? isWeaponMaxLevel(slot.level) : false,
          };
        }) as [HudWeaponSlot, HudWeaponSlot, HudWeaponSlot];
        const equipped = local.weaponSlots[local.equippedSlot];
        const equippedDef = equipped ? WEAPON_DEFS[equipped.weaponId] : null;
        hud.update({
          hp: local.hp,
          maxHp: local.maxHp,
          xp: local.xp,
          xpToNext: local.xpToNext,
          level: local.level,
          elapsedMs: snapshot.elapsedMs,
          kills: 0,
          gold: 0,
          slots,
          ammo: equipped?.ammo ?? 0,
          magazineSize: equippedDef?.magazineSize ?? 1,
          reloading: equipped?.reloading ?? false,
          reloadRatio: equipped && equippedDef ? equipped.reloadTimerMs / equippedDef.reloadMs : 0,
        });
      }
    }
    requestAnimationFrame(frame);
    return;
  }

  if (input.consumeJustPressed("Digit1")) game.equipSlot(0);
  if (input.consumeJustPressed("Digit2")) game.equipSlot(1);
  if (input.consumeJustPressed("Digit3")) game.equipSlot(2);
  if (input.consumeJustPressed("KeyR")) game.reloadEquipped();
  if (input.consumeJustPressed("Escape")) {
    if (game.phase === "playing") {
      game.pause();
      pauseModal.show();
    } else if (game.phase === "paused") {
      game.resume();
      pauseModal.hide();
    }
  }

  game.update(dt, moveVector, aimDir, fireHeld, now);

  if (game.mode === "sandbox" && (game.phase === "playing" || game.phase === "paused")) {
    const prevHp = sandboxPrevEnemyHp;
    let damage = 0;
    for (const [id, hp] of prevHp) {
      const enemy = game.enemies.find((e) => e.id === id);
      damage += enemy ? Math.max(0, hp - enemy.hp) : hp;
    }
    sandboxPanel.setDamageReadout(`${damage.toFixed(0)} dmg`);
    sandboxPrevEnemyHp = new Map(game.enemies.map((e) => [e.id, e.hp]));
  }

  if (game.phase === "playing" || game.phase === "paused" || game.phase === "levelup" || game.phase === "weaponPrompt") {
    const slots: [HudWeaponSlot, HudWeaponSlot, HudWeaponSlot] = [0, 1, 2].map((i) => {
      const slot = game.player.weaponSlots[i as 0 | 1 | 2];
      return {
        name: slot ? WEAPON_DEFS[slot.weaponId].name : null,
        equipped: game.player.equippedSlot === i,
        icon: slot ? WEAPON_DEFS[slot.weaponId].icon : null,
        level: slot?.level ?? 1,
        maxed: slot ? isWeaponMaxLevel(slot.level) : false,
      };
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

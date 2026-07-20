import { describe, expect, it, vi } from "vitest";
import { ADVENTURE_BOSS_1_TRIGGER_MS, ADVENTURE_DURATION_MS, WEAPON_MAX_LEVEL } from "../src/constants";
import { Game } from "../src/game/Game";
import { getLevelById } from "../src/systems/levels";
import { getPerkById } from "../src/systems/perks";
import { WEAPON_DEFS } from "../src/systems/weapons";
import type { GameMode } from "../src/types";

function makeGame(seed?: number, mode: GameMode = "endless") {
  const callbacks = {
    onLevelUp: vi.fn(),
    onWeaponPrompt: vi.fn(),
    onGameOver: vi.fn(),
    onVictory: vi.fn(),
  };
  const game = new Game(callbacks, seed);
  game.start(mode);
  return { game, callbacks };
}

describe("Game — weapon pickup prompt", () => {
  it("prompts when both extra slots are full and touching a new pickup", () => {
    const { game, callbacks } = makeGame();
    game.player.weaponSlots[1] = { weaponId: "shotgun", ammo: 6, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level: 1 };
    game.player.weaponSlots[2] = { weaponId: "assaultRifle", ammo: 30, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level: 1 };
    game.weaponPickups.push({ id: 1, position: { ...game.player.position }, weaponId: "rpg", radius: 16 });

    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);

    expect(game.phase).toBe("weaponPrompt");
    expect(callbacks.onWeaponPrompt).toHaveBeenCalledOnce();
  });

  it("declining ('Leave It') removes the pickup from the world instead of leaving it on the ground", () => {
    const { game, callbacks } = makeGame();
    game.player.weaponSlots[1] = { weaponId: "shotgun", ammo: 6, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level: 1 };
    game.player.weaponSlots[2] = { weaponId: "assaultRifle", ammo: 30, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level: 1 };
    game.weaponPickups.push({ id: 1, position: { ...game.player.position }, weaponId: "rpg", radius: 16 });

    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    expect(game.phase).toBe("weaponPrompt");

    game.resolveWeaponPrompt(null);
    expect(game.phase).toBe("playing");
    expect(game.weaponPickups).toHaveLength(0);

    // Standing in the same spot on the next frame(s) must not re-trigger a
    // prompt — there's nothing left on the ground to touch.
    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 16);
    expect(game.phase).toBe("playing");
    expect(callbacks.onWeaponPrompt).toHaveBeenCalledOnce();
  });

  it("accepting a slot replacement removes the pickup and equips the new weapon", () => {
    const { game } = makeGame();
    game.player.weaponSlots[1] = { weaponId: "shotgun", ammo: 6, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level: 1 };
    game.player.weaponSlots[2] = { weaponId: "assaultRifle", ammo: 30, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level: 1 };
    game.weaponPickups.push({ id: 1, position: { ...game.player.position }, weaponId: "rpg", radius: 16 });

    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    game.resolveWeaponPrompt(1);

    expect(game.phase).toBe("playing");
    expect(game.player.weaponSlots[1]?.weaponId).toBe("rpg");
    expect(game.weaponPickups).toHaveLength(0);
  });
});

describe("Game — in-run weapon leveling", () => {
  it("picking up a weapon type already held levels it up instead of prompting", () => {
    const { game, callbacks } = makeGame();
    game.player.weaponSlots[1] = { weaponId: "shotgun", ammo: 6, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level: 1 };
    game.weaponPickups.push({ id: 1, position: { ...game.player.position }, weaponId: "shotgun", radius: 16 });

    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);

    expect(game.phase).toBe("playing");
    expect(callbacks.onWeaponPrompt).not.toHaveBeenCalled();
    expect(game.player.weaponSlots[1]?.level).toBe(2);
    expect(game.weaponPickups).toHaveLength(0);
  });

  it("caps weapon level at WEAPON_MAX_LEVEL and keeps consuming pickups past it", () => {
    const { game } = makeGame();
    game.player.weaponSlots[1] = { weaponId: "shotgun", ammo: 6, fireTimerMs: 0, reloading: false, reloadTimerMs: 0, level: WEAPON_MAX_LEVEL };
    game.weaponPickups.push({ id: 1, position: { ...game.player.position }, weaponId: "shotgun", radius: 16 });

    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);

    expect(game.player.weaponSlots[1]?.level).toBe(WEAPON_MAX_LEVEL);
    expect(game.weaponPickups).toHaveLength(0);
  });
});

describe("Game — picked perk tracking", () => {
  it("records a newly picked perk with a count of 1", () => {
    const { game } = makeGame();
    game.applyPerk(getPerkById("damage")!);
    expect(game.pickedPerks).toEqual([{ perk: getPerkById("damage"), count: 1 }]);
  });

  it("increments the count on repeat picks instead of duplicating the entry", () => {
    const { game } = makeGame();
    game.applyPerk(getPerkById("damage")!);
    game.applyPerk(getPerkById("speed")!);
    game.applyPerk(getPerkById("damage")!);
    expect(game.pickedPerks).toHaveLength(2);
    expect(game.pickedPerks.find((p) => p.perk.id === "damage")?.count).toBe(2);
    expect(game.pickedPerks.find((p) => p.perk.id === "speed")?.count).toBe(1);
  });

  it("resets picked perks on a new run", () => {
    const { game } = makeGame();
    game.applyPerk(getPerkById("damage")!);
    game.start();
    expect(game.pickedPerks).toHaveLength(0);
  });
});

describe("Game — chests", () => {
  it("removes the chest from the world once touched", () => {
    const { game } = makeGame(1);
    game.chests.push({ id: 1, position: { ...game.player.position }, radius: 18 });
    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    expect(game.chests).toHaveLength(0);
  });

  it("a gold reward increases goldEarned and returns to the playing phase", () => {
    // Seed chosen empirically (via chests.test.ts's rollChestReward roll
    // thresholds) to land a gold reward on the first chest touch.
    let found: ReturnType<typeof makeGame>["game"] | undefined;
    for (let seed = 1; seed <= 50; seed++) {
      const { game } = makeGame(seed);
      const before = game.goldEarned;
      game.chests.push({ id: 1, position: { ...game.player.position }, radius: 18 });
      game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
      if (game.goldEarned > before) {
        found = game;
        break;
      }
    }
    expect(found).toBeDefined();
    expect(found!.phase).toBe("playing");
    expect(found!.goldEarned).toBeGreaterThan(0);
  });

  it("a magnet reward marks every xp orb on the map to home in on the player", () => {
    // Seed chosen empirically to land a magnet reward. Orbs are placed far
    // from the player and pickupRadius — only the magnet flag (not normal
    // proximity homing) could account for them being marked.
    let matched = false;
    for (let seed = 1; seed <= 50 && !matched; seed++) {
      const { game } = makeGame(seed);
      game.xpOrbs.push({ id: 1, position: { x: 5000, y: 5000 }, value: 15, radius: 6 });
      game.xpOrbs.push({ id: 2, position: { x: -5000, y: -5000 }, value: 10, radius: 6 });
      game.chests.push({ id: 1, position: { ...game.player.position }, radius: 18 });
      game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
      if (game.xpOrbs.length === 2 && game.xpOrbs.every((o) => o.magnetized)) {
        matched = true;
      }
    }
    expect(matched).toBe(true);
  });

  it("a magnetized orb actually reaches and is collected by the player over time", () => {
    const { game } = makeGame(1);
    const levelBefore = game.player.level;
    game.xpOrbs.push({ id: 1, position: { x: 200, y: 0 }, value: 100, radius: 6, magnetized: true });
    // Small steps (well under the pull speed's per-frame travel vs. the
    // capture radius) so the discrete homing can't overshoot back and forth
    // past the player forever — mirrors a real ~60fps frame budget.
    for (let i = 0; i < 400 && game.xpOrbs.length > 0; i++) {
      game.update(0.005, { x: 0, y: 0 }, { x: 1, y: 0 }, false, i * 5);
    }
    expect(game.xpOrbs).toHaveLength(0);
    expect(game.player.level).toBeGreaterThan(levelBefore);
  });

  it("a perk reward pauses the game in the levelup phase and offers perk choices", () => {
    // Seed chosen empirically to land a perk reward (routes through the
    // same onLevelUp flow as a level-up XP orb).
    let matched = false;
    for (let seed = 1; seed <= 50 && !matched; seed++) {
      const { game, callbacks } = makeGame(seed);
      const xpBefore = game.player.xp;
      const levelBefore = game.player.level;
      game.chests.push({ id: 1, position: { ...game.player.position }, radius: 18 });
      game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
      // A perk reward never touches xp/level, but does open the perk modal.
      if (game.phase === "levelup" && game.player.xp === xpBefore && game.player.level === levelBefore) {
        expect(callbacks.onLevelUp).toHaveBeenCalledOnce();
        matched = true;
      }
    }
    expect(matched).toBe(true);
  });
});

describe("Game — Adventure mode", () => {
  it("defaults to endless mode and never triggers a boss/victory even past the adventure duration", () => {
    const { game, callbacks } = makeGame(1, "endless");
    game.update(ADVENTURE_DURATION_MS / 1000 + 10, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    expect(game.phase).toBe("playing");
    expect(callbacks.onVictory).not.toHaveBeenCalled();
    expect(game.enemies.some((e) => e.isBoss)).toBe(false);
  });

  it("spawns a boss at the 3-minute mark", () => {
    const { game } = makeGame(1, "adventure");
    game.update(ADVENTURE_BOSS_1_TRIGGER_MS / 1000, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    expect(game.enemies.some((e) => e.isBoss)).toBe(true);
  });

  it("does not spawn the 3-minute boss more than once", () => {
    const { game } = makeGame(1, "adventure");
    game.update(ADVENTURE_BOSS_1_TRIGGER_MS / 1000, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    const bossCountAfterFirst = game.enemies.filter((e) => e.isBoss).length;
    game.update(5, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    expect(game.enemies.filter((e) => e.isBoss).length).toBe(bossCountAfterFirst);
  });

  it("spawns the second boss at the 6-minute mark without declaring victory yet", () => {
    const { game, callbacks } = makeGame(1, "adventure");
    game.update(ADVENTURE_DURATION_MS / 1000, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    // Boss 1 (3min) + boss 2 (6min) — both should have spawned by now, but
    // victory is now killing boss 2, not just reaching the clock mark.
    expect(game.enemies.filter((e) => e.isBoss).length).toBe(2);
    expect(game.phase).toBe("playing");
    expect(callbacks.onVictory).not.toHaveBeenCalled();
  });

  it("keeps running past the 6-minute mark — timer, spawns, everything — until boss 2 dies", () => {
    const { game } = makeGame(1, "adventure");
    game.update(ADVENTURE_DURATION_MS / 1000, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    const elapsedAtMark = game.elapsedMs;
    game.update(5, { x: 0, y: 0 }, { x: 1, y: 0 }, false, ADVENTURE_DURATION_MS + 1000);
    expect(game.phase).toBe("playing");
    expect(game.elapsedMs).toBeGreaterThan(elapsedAtMark);
  });

  it("declares victory once boss 2 is killed", () => {
    const { game, callbacks } = makeGame(1, "adventure");
    game.update(ADVENTURE_DURATION_MS / 1000, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    // Boss 1 (3min) spawned first and is still first in the array — boss 2
    // (6min, the actual win condition) is the most recently spawned boss.
    const bosses = game.enemies.filter((e) => e.isBoss);
    const boss2 = bosses[bosses.length - 1]!;
    boss2.hp = -1;
    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, ADVENTURE_DURATION_MS + 16);
    expect(game.phase).toBe("victory");
    expect(callbacks.onVictory).toHaveBeenCalledOnce();
  });

  it("killing boss 1 alone (before boss 2 spawns) never declares victory", () => {
    const { game, callbacks } = makeGame(1, "adventure");
    game.update(ADVENTURE_BOSS_1_TRIGGER_MS / 1000, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    const boss1 = game.enemies.find((e) => e.isBoss)!;
    boss1.hp = -1;
    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, ADVENTURE_BOSS_1_TRIGGER_MS + 16);
    expect(game.phase).toBe("playing");
    expect(callbacks.onVictory).not.toHaveBeenCalled();
  });

  it("death before 6 minutes ends the run in defeat, not victory", () => {
    const { game, callbacks } = makeGame(1, "adventure");
    game.player.hp = 1;
    // A single large dt tick is enough for a spawned enemy to land a
    // contact hit and kill a 1-hp player well before the clock runs out.
    for (let i = 0; i < 200 && game.phase === "playing"; i++) {
      game.update(1, { x: 0, y: 0 }, { x: 1, y: 0 }, false, i * 1000);
    }
    expect(game.phase).toBe("gameover");
    expect(callbacks.onGameOver).toHaveBeenCalledOnce();
    expect(callbacks.onVictory).not.toHaveBeenCalled();
  });
});

describe("Game — pre-generated levels", () => {
  it("reseeds from the level's own seed, producing the same enemy spawn layout on repeat plays", () => {
    const level = getLevelById("blood-marsh")!;
    const callbacks = { onLevelUp: vi.fn(), onWeaponPrompt: vi.fn(), onGameOver: vi.fn(), onVictory: vi.fn() };

    // Two separate Game instances, constructed with different clock-based
    // seeds, but both told to play the same level — the level's own seed
    // should win out and produce identical enemy placement.
    const gameA = new Game(callbacks, 111);
    gameA.start("adventure", level);
    gameA.update(1, { x: 0, y: 0 }, { x: 0, y: 0 }, false, 0);

    const gameB = new Game(callbacks, 222);
    gameB.start("adventure", level);
    gameB.update(1, { x: 0, y: 0 }, { x: 0, y: 0 }, false, 0);

    expect(gameA.enemies[0]?.position).toEqual(gameB.enemies[0]?.position);
  });

  it("records the active levelDef only in adventure mode", () => {
    const level = getLevelById("blood-marsh")!;
    const { game } = makeGame(1, "endless");
    game.start("adventure", level);
    expect(game.levelDef).toBe(level);
    game.start("endless");
    expect(game.levelDef).toBeNull();
  });
});

describe("Game — weapon upgrades from the meta-progression shop", () => {
  it("boosts projectile damage in adventure mode when a weapon upgrade is active", () => {
    const level = getLevelById("blood-marsh")!;
    const { game } = makeGame(1, "endless");
    game.start("adventure", level, { pistol: 2 }); // +20% damage
    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, true, 0);
    expect(game.projectiles[0]!.damage).toBeCloseTo(WEAPON_DEFS.pistol.damage * 1.2, 5);
  });

  it("does not apply weapon upgrades in endless mode even if passed in", () => {
    const { game } = makeGame(1, "endless");
    game.start("endless", null, { pistol: 5 });
    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, true, 0);
    expect(game.projectiles[0]!.damage).toBeCloseTo(WEAPON_DEFS.pistol.damage, 5);
  });

  it("stacks with perk damageMultiplier rather than replacing it", () => {
    const level = getLevelById("blood-marsh")!;
    const { game } = makeGame(1, "endless");
    game.start("adventure", level, { pistol: 1 }); // +10% damage
    game.applyPerk(getPerkById("damage")!); // *1.25
    game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, true, 0);
    expect(game.projectiles[0]!.damage).toBeCloseTo(WEAPON_DEFS.pistol.damage * 1.1 * 1.25, 5);
  });
});

describe("Game — pause", () => {
  it("pause() freezes the sim (update becomes a no-op) and resume() unfreezes it", () => {
    const { game } = makeGame();
    game.pause();
    expect(game.phase).toBe("paused");

    const elapsedBefore = game.elapsedMs;
    game.update(1, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    expect(game.elapsedMs).toBe(elapsedBefore); // update() returned early

    game.resume();
    expect(game.phase).toBe("playing");
    game.update(1, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    expect(game.elapsedMs).toBeGreaterThan(elapsedBefore);
  });

  it("pause() only takes effect from the playing phase", () => {
    // Seed chosen empirically to land a perk-reward chest, which opens the
    // levelup phase — confirm pause() is a no-op there.
    for (let seed = 1; seed <= 50; seed++) {
      const { game } = makeGame(seed);
      game.chests.push({ id: 1, position: { ...game.player.position }, radius: 18 });
      game.update(0.016, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
      if (game.phase === "levelup") {
        game.pause();
        expect(game.phase).toBe("levelup");
        return;
      }
    }
    throw new Error("no seed landed a levelup-phase chest in range");
  });

  it("resume() only takes effect from the paused phase", () => {
    const { game } = makeGame();
    game.resume();
    expect(game.phase).toBe("playing");
  });

  it("leaveToMenu() parks the game in the start phase, halting the sim", () => {
    const { game } = makeGame();
    game.pause();
    game.leaveToMenu();
    expect(game.phase).toBe("start");
    const elapsedBefore = game.elapsedMs;
    game.update(1, { x: 0, y: 0 }, { x: 1, y: 0 }, false, 0);
    expect(game.elapsedMs).toBe(elapsedBefore);
  });
});

describe("Game — sandbox mode", () => {
  it("never spawns enemies/chests on its own and never triggers gameover", () => {
    const { game, callbacks } = makeGame(1, "sandbox");
    game.player.hp = 1;
    for (let i = 0; i < 200; i++) {
      game.update(1, { x: 0, y: 0 }, { x: 1, y: 0 }, false, i * 1000);
    }
    expect(game.enemies).toHaveLength(0);
    expect(game.chests).toHaveLength(0);
    expect(game.phase).toBe("playing");
    expect(callbacks.onGameOver).not.toHaveBeenCalled();
  });

  it("sandboxSpawnEnemy adds the requested type near the player", () => {
    const { game } = makeGame(1, "sandbox");
    game.sandboxSpawnEnemy("brute");
    expect(game.enemies).toHaveLength(1);
    expect(game.enemies[0]!.type).toBe("brute");
  });

  it("sandboxSpawnEnemy can spawn a boss", () => {
    const { game } = makeGame(1, "sandbox");
    game.sandboxSpawnEnemy("boss");
    expect(game.enemies[0]!.isBoss).toBe(true);
  });

  it("sandboxClearEnemies empties the enemy list", () => {
    const { game } = makeGame(1, "sandbox");
    game.sandboxSpawnEnemy("grunt");
    game.sandboxSpawnEnemy("grunt");
    game.sandboxClearEnemies();
    expect(game.enemies).toHaveLength(0);
  });

  it("sandboxApplyPerk applies immediately without going through the level-up flow", () => {
    const { game, callbacks } = makeGame(1, "sandbox");
    game.sandboxApplyPerk(getPerkById("damage")!);
    expect(game.player.damageMultiplier).toBeCloseTo(1.25, 5);
    expect(game.phase).toBe("playing");
    expect(callbacks.onLevelUp).not.toHaveBeenCalled();
  });

  it("sandboxEquipWeapon equips directly into the given slot at the given level", () => {
    const { game } = makeGame(1, "sandbox");
    game.sandboxEquipWeapon(1, "rpg", 7);
    expect(game.player.weaponSlots[1]?.weaponId).toBe("rpg");
    expect(game.player.weaponSlots[1]?.level).toBe(7);
  });
});

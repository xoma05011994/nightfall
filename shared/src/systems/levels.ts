import type { LevelDef } from "../types";

// 10 pre-generated Adventure levels. Each is deterministic — seeding the
// run's RNG from the level's fixed seed means the same level always plays
// out with the same enemy/chest/pickup pattern, unlike Endless mode (which
// seeds from the clock and is different every time). "Different scenes" is
// expressed as a distinct dark color palette per level rather than distinct
// geometry — the arena shape/size stays the same bounded fenced square.
export const LEVELS: LevelDef[] = [
  { id: "ashen-fields", name: "The Ashen Fields", seed: 1001, palette: { bg: "#211f1c", splatterRGB: "120, 110, 90", fence: "#3a3226" } },
  { id: "blood-marsh", name: "Blood Marsh", seed: 1002, palette: { bg: "#1c1310", splatterRGB: "139, 0, 0", fence: "#3a2416" } },
  { id: "frostbite-hollow", name: "Frostbite Hollow", seed: 1003, palette: { bg: "#141c22", splatterRGB: "90, 130, 160", fence: "#26323a" } },
  { id: "rotting-orchard", name: "The Rotting Orchard", seed: 1004, palette: { bg: "#181f14", splatterRGB: "90, 120, 50", fence: "#2e3a20" } },
  { id: "charnel-grounds", name: "Charnel Grounds", seed: 1005, palette: { bg: "#1d1c1a", splatterRGB: "180, 170, 150", fence: "#3a3630" } },
  { id: "ember-wastes", name: "Ember Wastes", seed: 1006, palette: { bg: "#221510", splatterRGB: "255, 106, 0", fence: "#3a2210" } },
  { id: "drowned-chapel", name: "The Drowned Chapel", seed: 1007, palette: { bg: "#161320", splatterRGB: "80, 60, 140", fence: "#2a2440" } },
  { id: "wraiths-crossing", name: "Wraith's Crossing", seed: 1008, palette: { bg: "#180f1c", splatterRGB: "120, 40, 150", fence: "#301c3a" } },
  { id: "iron-slaughterhouse", name: "The Iron Slaughterhouse", seed: 1009, palette: { bg: "#1e1613", splatterRGB: "160, 60, 40", fence: "#3a281c" } },
  { id: "nightfall-sanctum", name: "Nightfall Sanctum", seed: 1010, palette: { bg: "#1c1310", splatterRGB: "139, 0, 0", fence: "#3a2416" } },
];

export function getLevelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

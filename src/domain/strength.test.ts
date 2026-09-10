import { it, expect } from "vitest";
import { calculateStrengthPoint, getPlayerTitle } from "./strength";
import { titleConfig } from "../config/titleConfig";
import { calculatePlayerStats } from "./stats";
// 最終更新: 2026-09-10 — 標準化、試合数差、未対局と全肩書の境界を検証する。
it("standardizes average results to mean 50 and population SD 10", () => {
  const population = [
    { gamesPlayed: 2, totalResult: 20 },
    { gamesPlayed: 10, totalResult: 0 },
    { gamesPlayed: 4, totalResult: -40 },
  ];
  const scores = population.map((p) => calculateStrengthPoint(p, population));
  expect(scores).toEqual([62.2, 50, 37.8]);
  expect(
    calculateStrengthPoint({ gamesPlayed: 100, totalResult: 1000 }, population),
  ).toBe(scores[0]);
});
it("handles no variation and excludes unplayed members", () => {
  const p = { gamesPlayed: 2, totalResult: 20 };
  expect(calculateStrengthPoint(p, [p, p])).toBe(50);
  expect(calculateStrengthPoint({ gamesPlayed: 0, totalResult: 0 }, [p])).toBe(
    50,
  );
  expect(
    calculateStrengthPoint(p, [p, { gamesPlayed: 0, totalResult: 0 }]),
  ).toBe(50);
});
it("uses every requested title threshold exactly", () => {
  const stats = { ...calculatePlayerStats("x", []), gamesPlayed: 1 };
  titleConfig.forEach((title, i) => {
    expect(getPlayerTitle(stats, title.minStrength)).toBe(title.name);
    expect(getPlayerTitle(stats, title.minStrength - 0.1)).toBe(
      titleConfig[Math.max(0, i - 1)].name,
    );
  });
  expect(getPlayerTitle(stats, 100)).toBe("レジェンド");
  expect(getPlayerTitle(stats, 0)).toBe("レアメタル");
  expect(getPlayerTitle({ ...stats, gamesPlayed: 0 }, 50)).toBe("未対局");
});

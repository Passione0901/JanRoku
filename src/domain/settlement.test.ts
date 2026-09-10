import { it, expect } from "vitest";
import { roundSettlement, calculateGameResults } from "./scoring";
import { entryRules, rules } from "../config/rules";
import type { Four, GameEntry } from "./types";
// 最終更新: 2026-09-10 — 正負の境界値と旧記録の互換性を確認する。
it("rounds five down and six up for both signs", () => {
  for (const [v, e] of [
    [10.4, 10],
    [10.5, 10],
    [10.6, 11],
    [-10.5, -10],
    [-10.6, -11],
    [0.5, 0],
    [-0.5, 0],
    [0.6, 1],
  ])
    expect(roundSettlement(v)).toBe(e);
});
it("rounds new game settlement and preserves old rule precision", () => {
  const entries: Four<GameEntry> = [
    { playerId: "a", rawScore: 40500 },
    { playerId: "b", rawScore: 30600 },
    { playerId: "c", rawScore: 19500 },
    { playerId: "d", rawScore: 9400 },
  ];
  const old = calculateGameResults(entries, rules);
  const next = calculateGameResults(entries, entryRules);
  expect(old.map((p) => p.result)).toEqual([40.5, 5.6, -15.5, -30.6]);
  expect(next.map((p) => p.result)).toEqual([40, 6, -15, -31]);
  expect(next.map((p) => p.rawScore)).toEqual(entries.map((p) => p.rawScore));
});

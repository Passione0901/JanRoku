import { it, expect } from "vitest";
import { calculateGameResults } from "./scoring";
import { rules } from "../config/rules";
import type { Four, GameEntry } from "./types";
// 最終更新: 2026-09-10 — 旧ルールの互換性と素点・順位の保持を確認する。
it("defaults to counting negative points and caps settlement only when disabled", () => {
  const entries: Four<GameEntry> = [
    { playerId: "a", rawScore: 50000 },
    { playerId: "b", rawScore: 30000 },
    { playerId: "c", rawScore: 25000 },
    { playerId: "d", rawScore: -5000 },
  ];
  const normal = calculateGameResults(entries, rules);
  const enabled = calculateGameResults(entries, {
    ...rules,
    countNegativePoints: true,
  });
  const disabled = calculateGameResults(entries, {
    ...rules,
    countNegativePoints: false,
  });
  expect(normal).toEqual(enabled);
  expect(normal[3].result).toBe(-45);
  expect(disabled[3].result).toBe(-40);
  expect(disabled[3].rawScore).toBe(-5000);
  expect(disabled.map((p) => p.rank)).toEqual(normal.map((p) => p.rank));
  expect(disabled.slice(0, 3)).toEqual(normal.slice(0, 3));
});

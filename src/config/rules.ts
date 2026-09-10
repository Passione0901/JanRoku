import type { RuleConfig } from "../domain/types";

export const rules: RuleConfig = {
  id: "standard-25k-30k-5-10-v1",
  playerCount: 4,
  startingPoints: 25_000,
  returnPoints: 30_000,
  scoreUnit: 100,
  resultDivisor: 1_000,
  uma: [10, 5, -5, -10],
  oka: "winner",
  tieBreak: "seat-order",
  bustIncludesZero: false,
};
// 最終更新: 2026-09-10 — 新規の実対局は5捨6入。旧記録・サンプルの計算規則は維持する。
export const entryRules: RuleConfig = {
  ...rules,
  id: "standard-25k-30k-5-10-v2",
  settlementRounding: "five-down-six-up",
};

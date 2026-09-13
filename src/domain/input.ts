import type { Four, GameEntry, RuleConfig } from "./types";
import { isValidDate } from "../utils/date";
import { evaluateScoreExpression } from "./scoreExpression";

export interface DraftEntry {
  playerId: string;
  units: string;
}
export interface InputValidation {
  errors: string[];
  entries: Four<GameEntry> | null;
  total: number;
  expected: number;
  mismatch: boolean;
}

// 最終更新: 2026-09-13 — 計算式の結果を入力単位から点数へ変換する。端数は勝手に丸めない。
export function parseScoreUnits(
  value: string,
  scoreUnit: number,
): number | null {
  const units = evaluateScoreExpression(value);
  if (units === null) return null;
  const score = units * scoreUnit;
  return Number.isSafeInteger(score) && Math.abs(score) <= 10_000_000
    ? score
    : null;
}
export function validateGameInput(
  date: string,
  draft: Four<DraftEntry>,
  config: RuleConfig,
  playerIds: string[],
): InputValidation {
  const errors: string[] = [];
  if (!isValidDate(date)) errors.push("有効な対局日を入力してください。");
  if (
    draft.some(
      (entry) => !entry.playerId || !playerIds.includes(entry.playerId),
    )
  )
    errors.push("メンバーを4人選択してください。");
  if (
    new Set(
      draft.filter((entry) => entry.playerId).map((entry) => entry.playerId),
    ).size !== draft.filter((entry) => entry.playerId).length
  ) {
    errors.push("同じメンバーを複数選択できません。");
  }
  const scores = draft.map((entry) =>
    parseScoreUnits(entry.units, config.scoreUnit),
  );
  draft.forEach((entry, seat) => {
    if (!entry.units.trim())
      errors.push(`${seat + 1}人目の点数を入力してください。`);
    else if (scores[seat] === null)
      errors.push(
        `${seat + 1}人目は整数または計算結果が整数になる式を入力してください（±10,000,000点以内、0での割り算は不可）。`,
      );
  });
  const total = scores.reduce<number>((sum, score) => sum + (score ?? 0), 0);
  const expected = config.startingPoints * config.playerCount;
  return {
    errors,
    total,
    expected,
    mismatch: total !== expected,
    entries: errors.length
      ? null
      : (draft.map((entry, seat) => ({
          playerId: entry.playerId,
          rawScore: scores[seat]!,
        })) as Four<GameEntry>),
  };
}

import type { Four, GameEntry, RuleConfig } from "./types";
import { isValidDate } from "../utils/date";

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

// 最終更新: 2026-09-10 — 空欄を0に変換せず、整数表記のみ受理する。負数は箱割れとして許可。
export function parseScoreUnits(
  value: string,
  scoreUnit: number,
): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null;
  const score = Number(value.trim()) * scoreUnit;
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
        `${seat + 1}人目の点数は整数で入力してください（±10,000,000点以内）。`,
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

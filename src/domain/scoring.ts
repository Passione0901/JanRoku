import { rules } from "../config/rules";
import type {
  Four,
  Game,
  GameEntry,
  GameFormat,
  ScoredGameResult,
  Rank,
  RuleConfig,
} from "./types";
import { isValidDate } from "../utils/date";

// 最終更新: 2026-09-10 — 同点は入力順を優先。順位・同点時のウマ分配変更はこの関数へ集約する。
export function assignRanks(
  entries: Four<GameEntry>,
  config: RuleConfig = rules,
): Four<Rank> {
  if (config.tieBreak !== "seat-order")
    throw new Error("未対応の同点ルールです。");
  const sorted = entries
    .map((entry, seat) => ({ ...entry, seat }))
    .sort((a, b) => b.rawScore - a.rawScore || a.seat - b.seat);
  const ranks: Four<Rank> = [1, 2, 3, 4];
  sorted.forEach((entry, i) => {
    ranks[entry.seat] = (i + 1) as Rank;
  });
  return ranks;
}

// 最終更新: 2026-09-10 — 精算の端数は対局に保存された規則で丸める。
export function calculateGameResults(
  entries: Four<GameEntry>,
  config: RuleConfig = rules,
): Four<ScoredGameResult> {
  const ranks = assignRanks(entries, config);
  const oka =
    config.oka === "winner"
      ? ((config.returnPoints - config.startingPoints) * config.playerCount) /
        config.resultDivisor
      : 0;
  const results = entries.map((entry, i) => ({
    ...entry,
    rawScore: entry.rawScore || 0,
    rank: ranks[i],
    result:
      Math.round(
        (((config.countNegativePoints === false
          ? Math.max(0, entry.rawScore)
          : entry.rawScore) -
          config.returnPoints) /
          config.resultDivisor +
          config.uma[ranks[i] - 1] +
          (ranks[i] === 1 ? oka : 0)) *
          10,
      ) / 10 || 0,
  })) as Four<ScoredGameResult>;
  return config.settlementRounding === "five-down-six-up"
    ? (results.map((entry) => ({
        ...entry,
        result: roundSettlement(entry.result),
      })) as Four<ScoredGameResult>)
    : results;
}

export function isBusted(score: number, config: RuleConfig = rules): boolean {
  return config.bustIncludesZero ? score <= 0 : score < 0;
}

// 最終更新: 2026-09-10 — UI以外から保存しても同じ入力制約を守る。
export function createGame(input: {
  id: string;
  date: string;
  createdAt: string;
  entries: Four<GameEntry>;
  config?: RuleConfig;
  acceptMismatch?: boolean;
  format?: GameFormat;
}): Game {
  const config = input.config ?? rules;
  if (
    input.format !== undefined &&
    input.format !== "hanchan" &&
    input.format !== "tonpu"
  )
    throw new Error("対局形式が不正です。");
  if (!isValidDate(input.date))
    throw new Error("有効な対局日を入力してください。");
  if (
    input.entries.length !== config.playerCount ||
    input.entries.some((entry) => !entry.playerId) ||
    new Set(input.entries.map((entry) => entry.playerId)).size !==
      config.playerCount
  ) {
    throw new Error("異なる4人のメンバーを選択してください。");
  }
  if (
    input.entries.some(
      (entry) =>
        !Number.isSafeInteger(entry.rawScore) ||
        entry.rawScore % config.scoreUnit !== 0 ||
        Math.abs(entry.rawScore) > 10_000_000,
    )
  ) {
    throw new Error(
      `点数は${config.scoreUnit}点単位、±10,000,000点以内で入力してください。`,
    );
  }
  const mismatch =
    input.entries.reduce((sum, entry) => sum + entry.rawScore, 0) !==
    config.startingPoints * config.playerCount;
  if (mismatch && !input.acceptMismatch)
    throw new Error("合計点が一致しません。確認してから登録してください。");
  return {
    id: input.id,
    format: input.format ?? "hanchan",
    date: input.date,
    createdAt: input.createdAt,
    registeredBy: { id: "mock", name: "麻雀会メンバー", source: "mock" },
    players: calculateGameResults(input.entries, config),
    rules: structuredClone(config),
    totalMismatchAccepted: mismatch,
  };
}

// 最終更新: 2026-09-10 — 正負とも絶対値の小数第1位を5捨6入する。
export function roundSettlement(value: number): number {
  const tenths = Math.round(Math.abs(value) * 10);
  return (
    Math.sign(value) * (Math.floor(tenths / 10) + (tenths % 10 >= 6 ? 1 : 0)) ||
    0
  );
}

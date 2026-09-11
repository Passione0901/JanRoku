import type { Game, Player } from "../types";
import { isValidDate } from "../../utils/date";

export type Facts = Record<string, string | number | boolean>;
export interface NewsSubject {
  id: string;
  name: string;
  color: string;
  facts: Facts;
}
export interface NewsSource {
  date: string;
  groupId: string;
  games: Game[];
  players: Player[];
  realRecords: boolean;
}

// 最終更新: 2026-09-12 — 当日入力は実施順とみなす。後日入力・時差未指定・同時刻は順序の根拠にしない。
export function hasReliableInputOrder(games: Game[]): boolean {
  const times = games.map((g) => Date.parse(g.createdAt));
  return (
    new Set(times).size === games.length &&
    games.every(
      (g, i) =>
        /(?:Z|[+-]\d{2}:\d{2})$/i.test(g.createdAt) &&
        Number.isFinite(times[i]) &&
        new Date(times[i] + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) ===
          g.date,
    )
  );
}

// 最終更新: 2026-09-12 — 点数の再計算をせず、保存済みの順位・0.1pt単位の収支を検証する。
function validGame(game: Game): boolean {
  return (
    !!game.id &&
    isValidDate(game.date) &&
    game.players.length === 4 &&
    new Set(game.players.map((p) => p.playerId)).size === 4 &&
    new Set(game.players.map((p) => p.rank)).size === 4 &&
    game.players.every(
      (p) =>
        !!p.playerId &&
        Number.isInteger(p.rank) &&
        p.rank >= 1 &&
        p.rank <= 4 &&
        Number.isFinite(p.result) &&
        Number.isSafeInteger(Math.round(p.result * 10)) &&
        Math.abs(p.result * 10 - Math.round(p.result * 10)) < 1e-8,
    )
  );
}

// ルールIDに頼らずスコア仕様を比較する。旧データの省略値は既存の計算規則にそろえる。
export function ruleSignature(game: Game): string | null {
  const r = game.rules;
  if (
    !r ||
    r.playerCount !== 4 ||
    !Array.isArray(r.uma) ||
    r.uma.length !== 4 ||
    ![
      r.startingPoints,
      r.returnPoints,
      r.scoreUnit,
      r.resultDivisor,
      ...r.uma,
    ].every(Number.isFinite) ||
    !["winner", "none"].includes(r.oka) ||
    r.tieBreak !== "seat-order" ||
    typeof r.bustIncludesZero !== "boolean" ||
    (game.format !== undefined &&
      !["hanchan", "tonpu"].includes(game.format)) ||
    (r.settlementRounding !== undefined &&
      r.settlementRounding !== "five-down-six-up") ||
    (r.countNegativePoints !== undefined &&
      typeof r.countNegativePoints !== "boolean")
  )
    return null;
  return JSON.stringify([
    game.format ?? "hanchan",
    r.playerCount,
    r.startingPoints,
    r.returnPoints,
    r.scoreUnit,
    r.resultDivisor,
    r.uma,
    r.oka,
    r.tieBreak,
    r.bustIncludesZero,
    r.countNegativePoints ?? true,
    r.settlementRounding ?? "tenths",
  ]);
}
function signature(games: Game[]): string | null {
  const parts = games.map(ruleSignature);
  return parts.some((p) => p === null)
    ? null
    : JSON.stringify([...new Set(parts)].sort());
}

// 最終更新: 2026-09-12 — 対象日以前の同会スナップショットだけで事実を作り、順序の推測はしない。
export function collectNewsFacts(source: NewsSource): NewsSubject[] {
  if (!source.realRecords || !source.groupId || !isValidDate(source.date))
    return [];
  const games = source.games.filter((g) => g.date === source.date);
  if (!games.length) return [];
  const roster = new Map(source.players.map((p) => [p.id, p]));
  if (
    roster.size !== source.players.length ||
    source.players.some((p) => !p.id || !p.name.trim()) ||
    games.some(
      (g) => !validGame(g) || g.players.some((p) => !roster.has(p.playerId)),
    ) ||
    new Set(games.map((g) => g.id)).size !== games.length
  )
    throw new Error(
      "この日の記録を確認できないため、ニュースを作成できません。",
    );
  const ids = [
    ...new Set(games.flatMap((g) => g.players.map((p) => p.playerId))),
  ].sort();
  const totals = new Map(
    ids.map((id) => [
      id,
      games.reduce(
        (sum, g) =>
          sum +
          Math.round(
            (g.players.find((p) => p.playerId === id)?.result ?? 0) * 10,
          ),
        0,
      ),
    ]),
  );
  if ([...totals.values()].some((n) => !Number.isSafeInteger(n)))
    throw new Error("収支の合計を確認できません。");
  const values = [...totals.values()].sort((a, b) => b - a);
  const past = source.games.filter((g) => g.date < source.date);
  const pastValid =
    past.every(validGame) &&
    new Set(past.map((g) => g.id)).size === past.length &&
    past.every((g) => !games.some((dayGame) => dayGame.id === g.id));
  return ids.map((id) => {
    const player = roster.get(id)!;
    const ownGames = games.filter((g) =>
      g.players.some((p) => p.playerId === id),
    );
    const rows = ownGames.map((g) => g.players.find((p) => p.playerId === id)!);
    const orderVerified = hasReliableInputOrder(ownGames);
    const ranks = [1, 2, 3, 4].map(
      (rank) => rows.filter((p) => p.rank === rank).length,
    );
    const ownSignature = signature(ownGames);
    const priorDays = new Map<string, Game[]>();
    for (const game of past)
      if (game.players.some((p) => p.playerId === id))
        priorDays.set(game.date, [...(priorDays.get(game.date) ?? []), game]);
    const comparable = [...priorDays.values()].filter(
      (day) => ownSignature !== null && signature(day) === ownSignature,
    );
    const previousTotals = comparable.map((day) =>
      day.reduce(
        (sum, g) =>
          sum +
          Math.round(g.players.find((p) => p.playerId === id)!.result * 10),
        0,
      ),
    );
    const facts: Facts = {
      "context.dataScope": "unlocked-records",
      "context.factsValidated": true,
      "context.sameGroup": true,
      "context.orderVerified": orderVerified,
      "context.comparableHistoryComplete":
        pastValid &&
        ownSignature !== null &&
        [...priorDays.values()].every((day) => signature(day) !== null) &&
        previousTotals.every(Number.isSafeInteger),
      "day.date": source.date,
      "day.playerCount": ids.length,
      "day.leadGap": (values[0] - values[1]) / 10,
      "player.id": id,
      "player.name": player.name,
      "player.gamesPlayed": rows.length,
      "player.totalResult": totals.get(id)! / 10,
      "player.topCount": ranks[0],
      "player.secondCount": ranks[1],
      "player.lastCount": ranks[3],
      "player.topTwoCount": ranks[0] + ranks[1],
      "player.isSoleDailyLeader":
        totals.get(id) === values[0] && values[0] > values[1],
      "player.previousComparableDays": previousTotals.length,
    };
    if (rows.length === 1) facts["player.onlyRank"] = rows[0].rank;
    if (previousTotals.length)
      facts["player.previousBestDaily"] = Math.max(...previousTotals) / 10;
    if (orderVerified) {
      const ordered = [...ownGames].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
      );
      let cumulative = 0,
        min = 0,
        topStreak = 0,
        topTwoStreak = 0,
        maxTop = 0,
        maxTopTwo = 0;
      for (const game of ordered) {
        const row = game.players.find((p) => p.playerId === id)!;
        cumulative += Math.round(row.result * 10);
        min = Math.min(min, cumulative);
        topStreak = row.rank === 1 ? topStreak + 1 : 0;
        topTwoStreak = row.rank <= 2 ? topTwoStreak + 1 : 0;
        maxTop = Math.max(maxTop, topStreak);
        maxTopTwo = Math.max(maxTopTwo, topTwoStreak);
      }
      const latest = ordered.at(-1)!.players.find((p) => p.playerId === id)!;
      Object.assign(facts, {
        "player.minCumulative": min / 10,
        "player.recovery": (cumulative - min) / 10,
        "player.latestResult": latest.result,
        "player.latestRank": latest.rank,
        "player.beforeLatestResult":
          (cumulative - Math.round(latest.result * 10)) / 10,
        "player.maxTopStreak": maxTop,
        "player.maxTopTwoStreak": maxTopTwo,
      });
    }
    return { id, name: player.name, color: player.color, facts };
  });
}

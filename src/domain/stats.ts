import { calculateCompatibility } from "./compatibility";
import type {
  BasePlayerStats,
  DailySummary,
  Four,
  Game,
  PlayerGame,
  PlayerStats,
} from "./types";
import {
  calculateStrengthPoint,
  getPlayerTitle,
  strengthPopulation,
} from "./strength";
import { isBusted } from "./scoring";

// 最終更新: 2026-09-10 — 日付→登録日時→IDを共通順序とし、編集しても対局の順番を保つ。
export const chronological = (a: Game, b: Game) =>
  a.date.localeCompare(b.date) ||
  Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
  a.id.localeCompare(b.id);
export const roundResult = (value: number) => Math.round(value * 10) / 10;

export function calculatePlayerStats(
  playerId: string,
  games: Game[],
  population = strengthPopulation(games),
): PlayerStats {
  const history: PlayerGame[] = [];
  const rankCounts: Four<number> = [0, 0, 0, 0];
  const days = new Map<string, number>();
  let totalTenths = 0;
  let highest: number | null = null;
  let lowest: number | null = null;
  for (const game of [...games].sort(chronological)) {
    const entry = game.players.find((player) => player.playerId === playerId);
    if (!entry) continue;
    totalTenths += Math.round(entry.result * 10);
    if (entry.rawScore !== null) {
      highest =
        highest === null ? entry.rawScore : Math.max(highest, entry.rawScore);
      lowest =
        lowest === null ? entry.rawScore : Math.min(lowest, entry.rawScore);
    }
    rankCounts[entry.rank - 1]++;
    days.set(
      game.date,
      (days.get(game.date) ?? 0) + Math.round(entry.result * 10),
    );
    history.push({
      ...entry,
      gameId: game.id,
      format: game.format,
      date: game.date,
      createdAt: game.createdAt,
      cumulativeResult: totalTenths / 10,
      busted:
        entry.rawScore === null ? null : isBusted(entry.rawScore, game.rules),
    });
  }
  const count = history.length;
  const daily = [...days.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const worst = [...days.entries()].sort(
    (a, b) => a[1] - b[1] || a[0].localeCompare(b[0]),
  )[0];
  const rate = (n: number) => (count ? (n / count) * 100 : 0);
  const stats: BasePlayerStats = {
    playerId,
    gamesPlayed: count,
    recentGames: history.slice(-10),
    history,
    highestRawScore: highest,
    lowestRawScore: lowest,
    bestDay: daily[0]?.[0] ?? null,
    bestDailyResult: daily[0] ? daily[0][1] / 10 : null,
    worstDay: worst?.[0] ?? null,
    worstDailyResult: worst ? worst[1] / 10 : null,
    totalResult: totalTenths / 10,
    averageRank: count
      ? rankCounts.reduce((sum, n, i) => sum + n * (i + 1), 0) / count
      : null,
    rankCounts,
    rankRates: rankCounts.map(rate) as Four<number>,
    topTwoRate: rate(rankCounts[0] + rankCounts[1]),
    bustRate: history.some((g) => g.busted !== null)
      ? (history.filter((g) => g.busted === true).length /
          history.filter((g) => g.busted !== null).length) *
        100
      : count
        ? null
        : 0,
  };
  const strengthPoint = calculateStrengthPoint(stats, population);
  return {
    ...stats,
    strengthPoint,
    compatibility: calculateCompatibility(playerId, games),
    title: getPlayerTitle(stats, strengthPoint),
  };
}

export function calculateDailySummaries(games: Game[]): DailySummary[] {
  const days = new Map<string, Game[]>();
  for (const game of games) {
    const day = days.get(game.date);
    if (day) day.push(game);
    else days.set(game.date, [game]);
  }
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => {
      const totals = new Map<
        string,
        { playerId: string; totalResult: number; gamesPlayed: number }
      >();
      for (const game of entries)
        for (const player of game.players) {
          const row = totals.get(player.playerId) ?? {
            playerId: player.playerId,
            totalResult: 0,
            gamesPlayed: 0,
          };
          row.totalResult = roundResult(row.totalResult + player.result);
          row.gamesPlayed++;
          totals.set(player.playerId, row);
        }
      return {
        date,
        games: entries.sort(chronological),
        results: [...totals.values()].sort(
          (a, b) => b.totalResult - a.totalResult,
        ),
      };
    });
}

export const sortOptions = [
  ["totalResult", "累計", "desc"],
  ["strengthPoint", "強さP", "desc"],
  ["averageRank", "平均順位", "asc"],
  ["firstRate", "1位率", "desc"],
  ["topTwoRate", "連対率", "desc"],
  ["gamesPlayed", "対局回数", "desc"],
  ["highestRawScore", "最高持ち点", "desc"],
  ["bestDailyResult", "1日の最高収支", "desc"],
  ["bustRate", "箱割れ率", "asc"],
] as const;
export type SortKey = (typeof sortOptions)[number][0];
export function sortPlayerStats(
  stats: PlayerStats[],
  key: SortKey,
  direction: "asc" | "desc",
): PlayerStats[] {
  const value = (s: PlayerStats) =>
    key === "firstRate"
      ? s.gamesPlayed
        ? s.rankRates[0]
        : null
      : key === "bustRate" || key === "topTwoRate"
        ? s.gamesPlayed
          ? s[key]
          : null
        : s[key];
  return [...stats].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (av === null)
      return bv === null ? a.playerId.localeCompare(b.playerId) : 1;
    if (bv === null) return -1;
    return (
      (av - bv) * (direction === "asc" ? 1 : -1) ||
      a.playerId.localeCompare(b.playerId)
    );
  });
}

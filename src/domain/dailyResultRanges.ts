import type { PlayerGame } from "./types";
export interface DailyResultRange {
  date: string;
  gamesPlayed: number;
  highest: number;
  lowest: number | null;
}
// 最終更新: 2026-09-11 — 日別合計ではなく、同日の各対局収支の最大・最小を集計する。
export function dailyResultRanges(history: PlayerGame[]): DailyResultRange[] {
  const days = new Map<string, DailyResultRange>();
  for (const game of history) {
    const day = days.get(game.date);
    if (!day)
      days.set(game.date, {
        date: game.date,
        gamesPlayed: 1,
        highest: game.result,
        lowest: null,
      });
    else {
      day.lowest = Math.min(day.lowest ?? day.highest, game.result);
      day.highest = Math.max(day.highest, game.result);
      day.gamesPlayed++;
    }
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

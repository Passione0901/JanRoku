import type { Game } from "./types";

export const COMPATIBILITY_MIN_GAMES = 5;
export const COMPATIBILITY_MIN_DIFFERENCE = 5;
export interface OpponentCompatibility {
  playerId: string;
  gamesPlayed: number;
  totalResult: number;
  averageResult: number;
  difference: number;
  rating: "good" | "bad";
}
// 最終更新: 2026-09-10 — 相手との順位比較ではなく、同卓時の本人の収支を全対局平均と比較する。
export function calculateCompatibility(
  playerId: string,
  games: Game[],
): OpponentCompatibility[] {
  const opponents = new Map<string, { count: number; tenths: number }>();
  let count = 0,
    tenths = 0;
  for (const game of games) {
    const own = game.players.find((p) => p.playerId === playerId);
    if (!own) continue;
    const value = Math.round(own.result * 10);
    count++;
    tenths += value;
    for (const opponent of game.players) {
      if (opponent.playerId === playerId) continue;
      const row = opponents.get(opponent.playerId) ?? { count: 0, tenths: 0 };
      row.count++;
      row.tenths += value;
      opponents.set(opponent.playerId, row);
    }
  }
  if (!count) return [];
  const overall = tenths / count / 10;
  const result: OpponentCompatibility[] = [];
  for (const [id, row] of opponents) {
    if (row.count < COMPATIBILITY_MIN_GAMES) continue;
    const average = row.tenths / row.count / 10;
    const difference = average - overall;
    const rating =
      average > 0 && difference >= COMPATIBILITY_MIN_DIFFERENCE
        ? "good"
        : average < 0 && difference <= -COMPATIBILITY_MIN_DIFFERENCE
          ? "bad"
          : null;
    if (rating)
      result.push({
        playerId: id,
        gamesPlayed: row.count,
        totalResult: row.tenths / 10,
        averageResult: average,
        difference,
        rating,
      });
  }
  return result.sort(
    (a, b) =>
      Math.abs(b.difference) - Math.abs(a.difference) ||
      b.gamesPlayed - a.gamesPlayed ||
      a.playerId.localeCompare(b.playerId),
  );
}

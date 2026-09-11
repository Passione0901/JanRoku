import type { Game } from "./types";
export const COMPATIBILITY_MIN_GAMES = 5;
export const COMPATIBILITY_MILD_MIN_GAMES = 3;
export interface OpponentCompatibility {
  playerId: string;
  gamesPlayed: number;
  wins: number;
  winRate: number;
  rating: "good" | "slightlyGood" | "slightlyBad" | "bad";
}
// 最終更新: 2026-09-11 — 相手より上位だった回数を同卓回数で割る。同順位は分母だけに含める。
export function calculateCompatibility(
  playerId: string,
  games: Game[],
): OpponentCompatibility[] {
  const opponents = new Map<string, { count: number; wins: number }>();
  for (const game of games) {
    const own = game.players.find((p) => p.playerId === playerId);
    if (!own) continue;
    for (const opponent of game.players) {
      if (opponent.playerId === playerId) continue;
      const row = opponents.get(opponent.playerId) ?? { count: 0, wins: 0 };
      row.count++;
      if (own.rank < opponent.rank) row.wins++;
      opponents.set(opponent.playerId, row);
    }
  }
  const result: OpponentCompatibility[] = [];
  for (const [id, row] of opponents) {
    if (row.count < COMPATIBILITY_MILD_MIN_GAMES) continue;
    // 整数で閾値を比較し、画面表示の丸めで判定が変わることを防ぐ。
    const percentWins = row.wins * 100;
    const rating =
      row.count >= COMPATIBILITY_MIN_GAMES && percentWins >= 70 * row.count
        ? "good"
        : row.count >= COMPATIBILITY_MIN_GAMES && percentWins <= 30 * row.count
          ? "bad"
          : percentWins >= 55 * row.count
            ? "slightlyGood"
            : percentWins <= 45 * row.count
              ? "slightlyBad"
              : null;
    if (rating)
      result.push({
        playerId: id,
        gamesPlayed: row.count,
        wins: row.wins,
        winRate: percentWins / row.count,
        rating,
      });
  }
  return result.sort(
    (a, b) =>
      Math.abs(b.winRate - 50) - Math.abs(a.winRate - 50) ||
      b.gamesPlayed - a.gamesPlayed ||
      a.playerId.localeCompare(b.playerId),
  );
}

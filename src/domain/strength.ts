import { titleConfig } from "../config/titleConfig";
import type { BasePlayerStats, Game } from "./types";
export interface StrengthSample {
  gamesPlayed: number;
  totalResult: number;
}
// 最終更新: 2026-09-10 — 未対局を除き、各人の平均収支を同じ重みで比較する。
export function strengthPopulation(games: Game[]): StrengthSample[] {
  const members = new Map<string, StrengthSample>();
  for (const game of games)
    for (const p of game.players) {
      const entry = members.get(p.playerId) ?? {
        gamesPlayed: 0,
        totalResult: 0,
      };
      entry.gamesPlayed++;
      entry.totalResult += p.result;
      members.set(p.playerId, entry);
    }
  return [...members.values()];
}
// 最終更新: 2026-09-10 — 偏差値は平均50・標準偏差10。比較対象がない場合は中立値50。
export function calculateStrengthPoint(
  stats: StrengthSample,
  population: StrengthSample[] = [stats],
): number {
  if (!stats.gamesPlayed) return 50;
  const values = population
    .filter((p) => p.gamesPlayed > 0)
    .map((p) => p.totalResult / p.gamesPlayed);
  if (values.length < 2) return 50;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  if (variance < 1e-12) return 50;
  return (
    Math.round(
      (50 +
        (10 * (stats.totalResult / stats.gamesPlayed - mean)) /
          Math.sqrt(variance)) *
        10,
    ) / 10
  );
}
// 最終更新: 2026-09-10 — 肩書きは表示中の偏差値だけで決定する。
export function getPlayerTitle(
  stats: BasePlayerStats,
  strengthPoint: number,
): string {
  if (!stats.gamesPlayed) return "未対局";
  return (
    [...titleConfig].reverse().find((t) => strengthPoint >= t.minStrength)
      ?.name ?? titleConfig[0].name
  );
}

import { createGame } from "../domain/scoring";
import type { Four, Game, GameEntry } from "../domain/types";

// 最終更新: 2026-09-10 — 期待値を手計算できる固定対局を共通化。
export const testPlayers = ["sample01", "sample02", "sample03", "sample04"];
export function fixture(
  id: string,
  date: string,
  scores: Four<number> = [40000, 30000, 20000, 10000],
): Game {
  return createGame({
    id,
    date,
    createdAt: `${date}T12:00:00.000Z`,
    entries: scores.map((rawScore, i) => ({
      playerId: testPlayers[i],
      rawScore,
    })) as Four<GameEntry>,
  });
}
export const statFixtures = () => [
  fixture("a", "2026-09-09"),
  fixture("b", "2026-09-09", [-1200, 41200, 35000, 25000]),
  fixture("c", "2026-09-10", [50000, 30000, 20000, 0]),
];
export class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

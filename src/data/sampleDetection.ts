import type { Game } from "../domain/types";
import { generateSampleGames } from "./sampleGames";
const samples = new Map(generateSampleGames().map((game) => [game.id, game]));
// 最終更新: 2026-09-10 — 編集済みの対局は残し、初期内容と一致するサンプルだけを識別する。
export function isInitialSample(game: Game): boolean {
  const sample = samples.get(game.id);
  if (
    !sample ||
    game.updatedAt ||
    game.date !== sample.date ||
    game.createdAt !== sample.createdAt ||
    (game.format ?? "hanchan") !== "hanchan" ||
    game.totalMismatchAccepted !== sample.totalMismatchAccepted
  )
    return false;
  return (
    game.players.every((p, i) => {
      const s = sample.players[i];
      return (
        p.playerId === s.playerId &&
        p.rawScore === s.rawScore &&
        p.rank === s.rank &&
        p.result === s.result
      );
    }) &&
    Object.entries(sample.rules).every(
      ([key, value]) =>
        JSON.stringify(game.rules[key as keyof Game["rules"]]) ===
        JSON.stringify(value),
    )
  );
}

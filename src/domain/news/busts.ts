import type { Game, GameResult } from "../types";
import { isBusted } from "../scoring";

// 最終更新: 2026-09-12 — 収支のマイナスと飛びを混同しない。推定値や欠損は「不明」で保持する。
export function recordedBust(game: Game, row: GameResult): boolean | null {
  if (game.inputMode === "results" || /逆算|推定|調整|仮入力|復元|換算/.test(game.note ?? "")
    || row.rawScore === null || !Number.isSafeInteger(row.rawScore)
    || Math.abs(row.rawScore) > 10_000_000 || typeof game.rules?.bustIncludesZero !== "boolean") return null;
  return isBusted(row.rawScore, game.rules);
}

import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import type { Game } from "../domain/types";
import { formatDate, formatInputTime } from "../utils/date";
import { rawScore, result, resultClass } from "../utils/format";
import { PlayerIdentity } from "./PlayerIdentity";

// 最終更新: 2026-09-10 — 日別・全履歴の対局表示を統一する。
export function GameCard({
  game,
  label,
  onDelete,
  busy,
}: {
  game: Game;
  label: string;
  onDelete: (game: Game) => void;
  busy: boolean;
}) {
  return (
    <article className="game-card">
      <div className="game-card-header">
        <div>
          <span className="game-number">{label}</span>
          <a href={`#/daily/${game.date}`}>{formatDate(game.date)}</a>
          {game.format === "tonpu" && <span className="title-badge">東風</span>}
          {game.inputMode === "results" && (
            <span className="title-badge">収支入力</span>
          )}
          {game.updatedAt && <small>編集済み</small>}
        </div>
        <div className="game-actions">
          <a
            className="button subtle"
            href={`#/edit/${game.id}`}
            aria-label={`${label}を編集`}
          >
            <Pencil size={16} /> 編集
          </a>
          <button
            className="button subtle"
            onClick={() => onDelete(game)}
            disabled={busy}
            aria-label={`${label}を削除`}
          >
            <Trash2 size={16} /> 削除
          </button>
        </div>
      </div>
      <p className="game-input-time">
        入力日時：
        <time dateTime={game.createdAt}>{formatInputTime(game.createdAt)}</time>
        （日本時間）
      </p>
      {game.totalMismatchAccepted && (
        <div className="mismatch-note">
          <AlertTriangle size={13} />
          {game.inputMode === "results"
            ? "収支合計が0でないことを確認して登録"
            : "合計点の不一致を確認して登録"}
        </div>
      )}

      <table className="game-results">
        <thead>
          <tr>
            <th>順位</th>
            <th>メンバー</th>
            <th>持ち点</th>
            <th>対局収支（pt）</th>
          </tr>
        </thead>
        <tbody>
          {[...game.players]
            .sort((a, b) => a.rank - b.rank)
            .map((entry) => (
              <tr key={entry.playerId}>
                <td>
                  <span className={`result-rank rank-${entry.rank}`}>
                    {entry.rank}
                  </span>
                </td>
                <td>
                  <PlayerIdentity id={entry.playerId} compact />
                </td>
                <td
                  className={
                    entry.rawScore !== null && entry.rawScore < 0
                      ? "negative"
                      : ""
                  }
                >
                  {entry.rawScore === null ? (
                    <span className="muted">未記録</span>
                  ) : (
                    rawScore(entry.rawScore)
                  )}
                </td>
                <td className={`game-result ${resultClass(entry.result)}`}>
                  {result(entry.result)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </article>
  );
}

import type { PlayerGame } from "../domain/types";
import { result } from "../utils/format";
import { formatDate } from "../utils/date";
import "./RecentGames.css";

// 最終更新: 2026-09-12 — 順位と収支の一覧を維持し、配色だけを共通の無彩色にする。
export function RecentGames({ games }: { games: PlayerGame[] }) {
  if (!games.length) return <span className="muted">まだ対局がありません</span>;
  return (
    <div className="recent-games" aria-label="直近10戦（右が最新）">
      {games.map((game) => (
        <span
          className={`rank-chip rank-${game.rank}`}
          key={game.gameId}
          title={`${formatDate(game.date)} · ${game.rank}位 · ${result(game.result)}`}
        >
          <b>{game.rank}</b>
          <small>{result(game.result)}</small>
        </span>
      ))}
    </div>
  );
}

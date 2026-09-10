import type { PlayerGame } from "../domain/types";
import { result } from "../utils/format";
import { formatDate } from "../utils/date";

// 最終更新: 2026-09-10 — 最新を右に統一し、色だけに頼らず順位と収支を併記する。
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

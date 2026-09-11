import type { PlayerGame } from "../domain/types";
import { useId, useState } from "react";
import { result } from "../utils/format";
import { formatDate } from "../utils/date";
import "./RecentGames.css";

// 最終更新: 2026-09-12 — 順位を共通の目盛りで並べ、詳細は選んだ対局の1行に集約する。
export function RecentGames({ games }: { games: PlayerGame[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const detailId = useId();
  if (!games.length) return <span className="muted">まだ対局がありません</span>;
  const recent = games.slice(-10);
  const active =
    recent.find((game) => game.gameId === selected) ??
    recent[recent.length - 1];
  const offset = 10 - recent.length;
  const x = (index: number) => 12 + (offset + index) * 24;
  const y = (rank: number) => 6 + (rank - 1) * 11;
  const label = (game: PlayerGame) =>
    `${formatDate(game.date)} · ${game.rank}位 · ${result(game.result)}pt`;
  return (
    <div
      className="recent-form"
      role="group"
      aria-label="直近10戦の順位（左が過去、右が最新）"
    >
      <div className="recent-form__chart">
        <div className="recent-form__axis" aria-hidden="true">
          <span>1位</span>
          <span>4位</span>
        </div>
        <div className="recent-form__plot">
          <svg
            viewBox="0 0 240 45"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path className="recent-form__guide" d="M0 6H240 M0 39H240" />
            <polyline
              className="recent-form__line"
              points={recent
                .map((game, index) => `${x(index)},${y(game.rank)}`)
                .join(" ")}
            />
            {recent.map((game, index) => (
              <circle
                key={game.gameId}
                className={
                  game.gameId === active.gameId
                    ? "recent-form__dot is-active"
                    : "recent-form__dot"
                }
                cx={x(index)}
                cy={y(game.rank)}
                r={game.gameId === active.gameId ? 3.5 : 2.5}
              />
            ))}
          </svg>
          {recent.map((game, index) => (
            <button
              key={game.gameId}
              type="button"
              className="recent-form__point"
              style={{ left: `${(offset + index) * 10}%` }}
              aria-label={label(game)}
              aria-describedby={detailId}
              aria-pressed={active.gameId === game.gameId}
              title={label(game)}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") setSelected(game.gameId);
              }}
              onFocus={() => setSelected(game.gameId)}
              onClick={() => setSelected(game.gameId)}
            />
          ))}
        </div>
      </div>
      <div className="recent-form__detail" id={detailId}>
        <span className="recent-form__when">
          {active.gameId === recent[recent.length - 1].gameId
            ? "最新"
            : "選択中"}
        </span>
        <time dateTime={active.date}>{formatDate(active.date)}</time>
        <span>{active.rank}位</span>
        <strong>
          {result(active.result)}
          <small>pt</small>
        </strong>
      </div>
    </div>
  );
}

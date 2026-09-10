import { useMemo, useState } from "react";
import { History, Plus } from "lucide-react";
import type { Game } from "../domain/types";
import { chronological } from "../domain/stats";
import { usePlayers } from "../hooks/usePlayers";
import { GameCard } from "../components/GameCard";

// 最終更新: 2026-09-10 — 大人数・長期利用でもDOMを増やしすぎないよう段階表示する。
export function HistoryPage({
  games,
  onDelete,
  busy,
}: {
  games: Game[];
  onDelete: (game: Game) => void;
  busy: boolean;
}) {
  const { players } = usePlayers();
  const [player, setPlayer] = useState("");
  const [visible, setVisible] = useState(12);
  const sorted = useMemo(
    () =>
      [...games]
        .sort(chronological)
        .reverse()
        .filter(
          (game) =>
            !player || game.players.some((entry) => entry.playerId === player),
        ),
    [games, player],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GAME ARCHIVE</p>
          <h1>
            対局履歴
            <span className="heading-dot" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="muted">ひとつずつの勝負を、いつでも振り返る。</p>
        </div>
        <a className="button primary desktop-add" href="#/input">
          <Plus size={17} />
          戦を記録
        </a>
      </div>
      <div className="section-toolbar">
        <h2>
          登録済み <span>{sorted.length} 戦</span>
        </h2>
        <label className="filter-label">
          参加者
          <select
            aria-label="履歴の参加者"
            value={player}
            onChange={(event) => {
              setPlayer(event.target.value);
              setVisible(12);
            }}
          >
            <option value="">全員</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!sorted.length ? (
        <div className="empty-state">
          <History size={30} />
          <p>
            {player
              ? "このメンバーの対局履歴はありません。"
              : "まだ対局がありません。"}
          </p>
          {player && (
            <button className="button subtle" onClick={() => setPlayer("")}>
              全員の履歴を表示
            </button>
          )}
          <a className="button primary" href="#/input">
            対局を記録
          </a>
        </div>
      ) : (
        <div className="game-grid">
          {sorted.slice(0, visible).map((game, i) => (
            <GameCard
              key={game.id}
              game={game}
              label={`記録 ${sorted.length - i}`}
              onDelete={onDelete}
              busy={busy}
            />
          ))}
        </div>
      )}
      {visible < sorted.length && (
        <button
          className="button subtle load-more"
          onClick={() => setVisible(visible + 12)}
        >
          あと{Math.min(12, sorted.length - visible)}件表示{" "}
          <span className="muted">残り {sorted.length - visible} 件</span>
        </button>
      )}
    </>
  );
}

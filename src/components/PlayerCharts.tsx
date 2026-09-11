import { useState } from "react";
import { usePlayers } from "../hooks/usePlayers";
import { AllPlayersChart } from "./AllPlayersChart";
import type { PlayerStats } from "../domain/types";
import "./PlayerCharts.css";
// 最終更新: 2026-09-12 — 全員を初期選択し、チェックしたメンバーを共通の軸で比較する。
export function PlayerCharts({ stats }: { stats: PlayerStats[] }) {
  const { players } = usePlayers();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const visiblePlayerIds = players
    .filter((p) => !hiddenIds.has(p.id))
    .map((p) => p.id);
  return (
    <section
      className="player-charts"
      id="player-charts"
      aria-label="メンバー別の成績グラフ"
    >
      <div className="section-toolbar">
        <h2>メンバー別の成績グラフ</h2>
      </div>
      <fieldset className="chart-members">
        <legend>表示するメンバー</legend>
        <div className="chart-members-actions">
          <button
            type="button"
            className="button subtle"
            onClick={() => setHiddenIds(new Set())}
            disabled={visiblePlayerIds.length === players.length}
          >
            全員選択
          </button>
          <button
            type="button"
            className="button subtle"
            onClick={() => setHiddenIds(new Set(players.map((p) => p.id)))}
            disabled={!visiblePlayerIds.length}
          >
            全員解除
          </button>
        </div>
        <div className="chart-members-options">
          {players.map((p) => (
            <label key={p.id} className="chart-member-option">
              <input
                type="checkbox"
                checked={!hiddenIds.has(p.id)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setHiddenIds((current) => {
                    const next = new Set(current);
                    if (checked) next.delete(p.id);
                    else next.add(p.id);
                    return next;
                  });
                }}
              />
              <i aria-hidden="true" style={{ background: p.color }} />
              <span>{p.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="muted">
        縦軸：累計収支（pt） · 横軸：対局順（左が過去 → 右が最新）
      </p>
      <p className="muted">
        チェックしたメンバーを同じ目盛りで比較できます。点を選ぶと対局の詳細を表示します。
      </p>
      <div className="player-chart-single">
        <article className="panel chart-panel">
          <AllPlayersChart stats={stats} visiblePlayerIds={visiblePlayerIds} />
        </article>
      </div>
    </section>
  );
}

import { useState } from "react";
import { usePlayers } from "../hooks/usePlayers";
import { AllPlayersChart } from "./AllPlayersChart";
import type { PlayerStats } from "../domain/types";
import { PlayerIdentity } from "./PlayerIdentity";
import { ResultChart } from "./ResultChart";
import { result, resultClass } from "../utils/format";
// 最終更新: 2026-09-10 — 全メンバーの推移を独立したグラフで表示する。
export function PlayerCharts({ stats }: { stats: PlayerStats[] }) {
  const { players, findPlayer } = usePlayers();
  const [selection, setSelection] = useState("all");
  const selected = players.some((p) => p.id === selection) ? selection : "all";
  return (
    <section
      className="player-charts"
      id="player-charts"
      aria-label="メンバー別の成績グラフ"
    >
      <div className="section-toolbar">
        <h2>メンバー別の成績グラフ</h2>
      </div>
      <label className="chart-picker">
        表示するメンバー
        <select
          value={selected}
          onChange={(event) => setSelection(event.target.value)}
        >
          <option value="all">全員</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        縦軸：累計収支（pt） · 横軸：対局順（左が過去 → 右が最新）
      </p>
      <p className="muted">
        点を選ぶと対局の詳細を表示します。全員モードでは同じ目盛りで比較できます。
      </p>
      <div className="player-chart-single">
        {selected === "all" && (
          <article className="panel chart-panel">
            <AllPlayersChart stats={stats} />
          </article>
        )}
        {stats
          .filter((s) => s.playerId === selected)
          .map((s) => (
            <article className="panel chart-panel" key={s.playerId}>
              <div className="panel-heading">
                <PlayerIdentity id={s.playerId} />
                <strong className={resultClass(s.totalResult)}>
                  {result(s.totalResult)} pt
                </strong>
              </div>
              <ResultChart
                history={s.history}
                color={findPlayer(s.playerId).color}
              />
            </article>
          ))}
      </div>
    </section>
  );
}

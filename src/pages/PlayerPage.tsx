import { CompatibilityPanel } from "../components/CompatibilityPanel";
import { useState } from "react";
import { ArrowLeft, TrendingUp } from "lucide-react";
import type { PlayerStats } from "../domain/types";
import { usePlayers } from "../hooks/usePlayers";
import {
  average,
  percent,
  rawScore,
  result,
  resultClass,
} from "../utils/format";
import { formatDate, formatInputTime } from "../utils/date";
import { PlayerIdentity } from "../components/PlayerIdentity";
import { TitleBadge } from "../components/TitleBadge";
import { StatsDetails } from "../components/StatsDetails";
import { ResultChart } from "../components/ResultChart";

// 最終更新: 2026-09-10 — 個人画面は集計モデルを表示するだけで追加の統計計算を行わない。
export function PlayerPage({ stats }: { stats: PlayerStats }) {
  const { findPlayer } = usePlayers();
  const [visible, setVisible] = useState(20);
  const history = [...stats.history].reverse();
  return (
    <>
      <a className="back-link" href="#/">
        <ArrowLeft size={16} />
        戦績ランキング
      </a>
      <div className="profile-heading">
        <div>
          <p className="eyebrow">PLAYER RECORD</p>
          <h1 className="sr-only">
            {findPlayer(stats.playerId).name}の個人戦績
          </h1>
          <PlayerIdentity id={stats.playerId} />
          <TitleBadge title={stats.title} />
        </div>
        <div className="profile-strength">
          <span>
            強さP <small>偏差値</small>
          </span>
          <strong>{stats.gamesPlayed ? stats.strengthPoint : "—"}</strong>
        </div>
      </div>
      <div className="profile-summary">
        <div className="profile-total">
          <span>累計収支</span>
          <strong className={resultClass(stats.totalResult)}>
            {result(stats.totalResult)}
            <small> pt</small>
          </strong>
        </div>
        <div>
          <span>平均順位</span>
          <strong>{average(stats.averageRank)}</strong>
        </div>
        <div>
          <span>対局回数</span>
          <strong>
            {stats.gamesPlayed}
            <small> 戦</small>
          </strong>
        </div>
        <div>
          <span>連対率</span>
          <strong>{percent(stats.topTwoRate)}</strong>
        </div>
      </div>
      <section className="panel chart-panel">
        <div className="panel-heading">
          <h2>
            <TrendingUp size={18} />
            累計収支の推移
          </h2>
          <span className="muted">全期間 · pt</span>
        </div>
        <ResultChart
          history={stats.history}
          color={findPlayer(stats.playerId).color}
        />
      </section>
      <section className="panel profile-details">
        <StatsDetails stats={stats} />
      </section>
      <CompatibilityPanel entries={stats.compatibility} />
      <section className="profile-history">
        <div className="section-toolbar">
          <h2>
            全対局履歴 <span>{stats.gamesPlayed} 戦</span>
          </h2>
          <span className="muted">新しい順</span>
        </div>
        {!history.length ? (
          <div className="empty-state">まだ対局がありません。</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>順位</th>
                  <th>素点</th>
                  <th>対局収支（pt）</th>
                  <th>累計収支（pt）</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, visible).map((entry) => (
                  <tr key={entry.gameId}>
                    <td>
                      <a href={`#/daily/${entry.date}`}>
                        {formatDate(entry.date)}
                      </a>
                      {entry.format === "tonpu" && (
                        <span className="title-badge">東風</span>
                      )}
                      <small className="game-input-time">
                        入力日時：{formatInputTime(entry.createdAt)}（日本時間）
                      </small>
                    </td>
                    <td>
                      <span className={`result-rank rank-${entry.rank}`}>
                        {entry.rank}位
                      </span>
                    </td>
                    <td>{rawScore(entry.rawScore)}</td>
                    <td className={resultClass(entry.result)}>
                      {result(entry.result)}
                    </td>
                    <td className={resultClass(entry.cumulativeResult)}>
                      {result(entry.cumulativeResult)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visible < history.length && (
          <button
            className="button subtle load-more"
            onClick={() => setVisible(visible + 20)}
          >
            あと{Math.min(20, history.length - visible)}件表示
          </button>
        )}
      </section>
    </>
  );
}

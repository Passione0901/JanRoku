import { PlayerCharts } from "../components/PlayerCharts";
import { usePlayers } from "../hooks/usePlayers";
import { Fragment, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Plus,
  Trophy,
} from "lucide-react";
import type { DailySummary, PlayerStats } from "../domain/types";
import { sortOptions, sortPlayerStats, type SortKey } from "../domain/stats";
import { average, percent, result, resultClass } from "../utils/format";
import { shortDate } from "../utils/date";
import { PlayerIdentity } from "../components/PlayerIdentity";
import { TitleBadge } from "../components/TitleBadge";
import { RecentGames } from "../components/RecentGames";
import { StatsDetails } from "../components/StatsDetails";

// 最終更新: 2026-09-10 — 比較に必要な列を常設し、記録と順位内訳を行内展開する。
export function RankingPage({
  stats,
  gameCount,
  days,
}: {
  stats: PlayerStats[];
  gameCount: number;
  days: DailySummary[];
}) {
  const { findPlayer } = usePlayers();
  const [sort, setSort] = useState<SortKey>("totalResult");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = useMemo(
    () => sortPlayerStats(stats, sort, direction),
    [stats, sort, direction],
  );
  const leaders = useMemo(
    () =>
      sortPlayerStats(stats, "totalResult", "desc")
        .filter((entry) => entry.gamesPlayed > 0)
        .slice(0, 3),
    [stats],
  );
  const toggle = (id: string) => setExpanded(expanded === id ? null : id);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">THE LEAGUE / ALL TIME</p>
          <h1>
            戦績ランキング
            <span className="heading-dot" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="muted">いつもの卓の、これまでの記録。</p>
        </div>
        <a className="button primary desktop-add" href="#/input">
          <Plus size={18} />
          戦を記録
        </a>
      </div>
      <button
        className="button subtle"
        onClick={() =>
          document
            .getElementById("player-charts")
            ?.scrollIntoView({ behavior: "smooth" })
        }
      >
        メンバー別の折れ線グラフを見る
      </button>
      <div className="league-meta">
        <span>
          <b>{stats.length}</b> メンバー
        </span>
        <i />
        <span>
          <b>{gameCount}</b> 戦
        </span>
        <i />
        <span>
          <b>{days.length}</b> 開催日
        </span>
        <span className="latest-date">
          最終対局 {days[0] ? shortDate(days[0].date) : "—"}
        </span>
      </div>
      {leaders.length > 0 && (
        <section className="podium" aria-label="累計収支トップ3">
          {leaders.map((s, i) => (
            <article className={`podium-card podium-${i + 1}`} key={s.playerId}>
              <div className="podium-top">
                <span className="podium-place">
                  {i === 0 ? (
                    <Trophy size={16} />
                  ) : (
                    <span className="small-diamond">◆</span>
                  )}{" "}
                  {["LEAGUE LEADER", "2ND PLACE", "3RD PLACE"][i]}
                </span>
                <span className="podium-number">0{i + 1}</span>
              </div>
              <div className="podium-person">
                <TitleBadge title={s.title} />
                <PlayerIdentity
                  id={s.playerId}
                  subtitle={`${s.gamesPlayed} 戦`}
                />
              </div>
              <div className="podium-score">
                <span className={resultClass(s.totalResult)}>
                  {result(s.totalResult)}
                </span>
                <small>pt</small>
              </div>
              <div className="podium-footer">
                <span>
                  平均順位 <b>{average(s.averageRank)}</b>
                </span>
                <span>
                  1位率 <b>{percent(s.rankRates[0])}</b>
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
      <section className="ranking-section">
        <div className="section-toolbar">
          <h2>
            全メンバー <span>{stats.length.toString().padStart(2, "0")}</span>
          </h2>
          <div className="sort-controls">
            <label htmlFor="ranking-sort">並び替え</label>
            <select
              id="ranking-sort"
              value={sort}
              onChange={(event) => {
                const selected = sortOptions.find(
                  (option) => option[0] === event.target.value,
                )!;
                setSort(selected[0]);
                setDirection(selected[2]);
              }}
            >
              {sortOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className="button subtle sort-direction"
              aria-label={
                direction === "desc"
                  ? "降順。昇順に切り替え"
                  : "昇順。降順に切り替え"
              }
              onClick={() => setDirection(direction === "asc" ? "desc" : "asc")}
            >
              {direction === "desc" ? (
                <ArrowDown size={16} />
              ) : (
                <ArrowUp size={16} />
              )}
              <span>{direction === "desc" ? "降順" : "昇順"}</span>
            </button>
          </div>
        </div>
        <div className="desktop-ranking table-scroll">
          <table className="ranking-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">メンバー / 肩書き</th>
                <th scope="col">回数</th>
                <th scope="col" className="score-column">
                  累計 <span>pt</span>
                </th>
                <th scope="col">
                  強さP <span className="mock-mark">偏差値</span>
                </th>
                <th scope="col">平均順位</th>
                <th scope="col">連対率</th>
                <th scope="col" className="recent-column">
                  直近10戦 <span>最新 →</span>
                </th>
                <th scope="col">
                  <span className="sr-only">詳細</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <Fragment key={s.playerId}>
                  <tr className={expanded === s.playerId ? "expanded-row" : ""}>
                    <td>
                      <span className={`table-place place-${i + 1}`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </td>
                    <td>
                      <div className="table-player">
                        <TitleBadge title={s.title} />
                        <PlayerIdentity id={s.playerId} compact />
                      </div>
                    </td>
                    <td>
                      {s.gamesPlayed}
                      <small className="unit">戦</small>
                    </td>
                    <td className={`table-total ${resultClass(s.totalResult)}`}>
                      {result(s.totalResult)}
                    </td>
                    <td>
                      <b>{s.gamesPlayed ? s.strengthPoint : "—"}</b>
                    </td>
                    <td>{average(s.averageRank)}</td>
                    <td>{percent(s.topTwoRate)}</td>
                    <td className="recent-column">
                      <RecentGames games={s.recentGames} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => toggle(s.playerId)}
                        aria-expanded={expanded === s.playerId}
                        aria-label={`${findPlayer(s.playerId).name}の記録と順位を${expanded === s.playerId ? "閉じる" : "展開"}`}
                      >
                        <ChevronDown size={18} />
                      </button>
                    </td>
                  </tr>
                  {expanded === s.playerId && (
                    <tr className="details-row">
                      <td colSpan={9}>
                        <StatsDetails stats={s} />
                        <a
                          className="text-link"
                          href={`#/players/${s.playerId}`}
                        >
                          個人戦績と全対局を見る <ChevronRight size={16} />
                        </a>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-ranking">
          {sorted.map((s, i) => (
            <article className="mobile-player-card" key={s.playerId}>
              <div className="mobile-card-heading">
                <span className={`table-place place-${i + 1}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <TitleBadge title={s.title} />
                <PlayerIdentity id={s.playerId} compact />
              </div>
              <div className="mobile-key-stats">
                <div>
                  <small>累計</small>
                  <strong className={resultClass(s.totalResult)}>
                    {result(s.totalResult)}
                    <small> pt</small>
                  </strong>
                </div>
                <div>
                  <small>強さP（偏差値）</small>
                  <b>{s.gamesPlayed ? s.strengthPoint : "—"}</b>
                </div>
                <div>
                  <small>回数</small>
                  <b>
                    {s.gamesPlayed}
                    <small> 戦</small>
                  </b>
                </div>
              </div>
              <div className="mobile-rank-meta">
                <span>
                  平均順位 <b>{average(s.averageRank)}</b>
                </span>
                <span>
                  連対率 <b>{percent(s.topTwoRate)}</b>
                </span>
              </div>
              <RecentGames games={s.recentGames} />
              <button
                className="expand-button"
                onClick={() => toggle(s.playerId)}
                aria-expanded={expanded === s.playerId}
              >
                記録・順位の内訳 <ChevronDown size={16} />
              </button>
              {expanded === s.playerId && (
                <StatsDetails stats={s} showRecent={false} />
              )}
            </article>
          ))}
        </div>
        <div className="table-footnote">
          <span>
            <i className="status-dot" />
            全期間の戦績を表示中
          </span>
          <span>名前を選ぶと個人戦績へ · 直近10戦は右が最新</span>
        </div>
      </section>
      <PlayerCharts stats={sorted} />
    </>
  );
}

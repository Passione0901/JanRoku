import type { PlayerStats } from "../domain/types";
import {
  average,
  percent,
  rawScore,
  result,
  resultClass,
} from "../utils/format";
import { formatDate } from "../utils/date";
import { RecentGames } from "./RecentGames";

// 最終更新: 2026-09-10 — 一覧展開と個人詳細で同じ23項目の値を表示する。
export function StatsDetails({
  stats,
  showRecent = true,
}: {
  stats: PlayerStats;
  showRecent?: boolean;
}) {
  return (
    <div className="stats-details">
      {stats.history.some((g) => g.rawScore === null) && (
        <p className="muted">
          収支入力の対局は、収支順の順位で集計しています。持ち点の記録と箱割れ率は、持ち点を入力した対局のみが対象です。
        </p>
      )}
      {showRecent && (
        <section className="detail-section">
          <h3>
            直近10戦 <small>最新 →</small>
          </h3>
          <RecentGames games={stats.recentGames} />
        </section>
      )}
      <div className="details-columns">
        <section className="detail-section">
          <h3>自己ベスト / ワースト</h3>
          <dl className="record-grid">
            <div>
              <dt>最高持ち点</dt>
              <dd>{rawScore(stats.highestRawScore)}</dd>
            </div>
            <div>
              <dt>最低持ち点</dt>
              <dd>{rawScore(stats.lowestRawScore)}</dd>
            </div>
            <div>
              <dt>最高の日</dt>
              <dd>{formatDate(stats.bestDay)}</dd>
            </div>
            <div>
              <dt>1日の最高収支</dt>
              <dd className={resultClass(stats.bestDailyResult ?? 0)}>
                {result(stats.bestDailyResult)}
              </dd>
            </div>
            <div>
              <dt>最低の日</dt>
              <dd>{formatDate(stats.worstDay)}</dd>
            </div>
            <div>
              <dt>1日の最低収支</dt>
              <dd className={resultClass(stats.worstDailyResult ?? 0)}>
                {result(stats.worstDailyResult)}
              </dd>
            </div>
          </dl>
        </section>
        <section className="detail-section">
          <h3>順位の内訳</h3>
          <div
            className="placement-bar"
            role="img"
            aria-label={stats.rankRates
              .map((rate, i) => `${i + 1}位 ${percent(rate)}`)
              .join("、")}
          >
            {stats.rankRates.map((rate, i) => (
              <span
                key={i}
                className={`rank-${i + 1}`}
                style={{ width: `${rate}%` }}
              />
            ))}
          </div>
          <div className="placement-grid">
            {stats.rankCounts.map((count, i) => (
              <div key={i}>
                <span className={`placement-label rank-text-${i + 1}`}>
                  {i + 1}位
                </span>
                <strong>
                  {count}
                  <small> 回</small>
                </strong>
                <span>{percent(stats.rankRates[i])}</span>
              </div>
            ))}
          </div>
          <dl className="record-grid rank-summary">
            <div>
              <dt>平均順位</dt>
              <dd>{average(stats.averageRank)}</dd>
            </div>
            <div>
              <dt>連対率</dt>
              <dd>{percent(stats.topTwoRate)}</dd>
            </div>
            <div>
              <dt>箱割れ率</dt>
              <dd>{percent(stats.bustRate)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

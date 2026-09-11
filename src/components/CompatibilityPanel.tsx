import type { OpponentCompatibility } from "../domain/compatibility";
import { PlayerIdentity } from "./PlayerIdentity";
import { percent, resultClass } from "../utils/format";

const ratingLabels = {
  good: "相性が良い",
  slightlyGood: "相性がやや良い",
  slightlyBad: "相性がやや悪い",
  bad: "相性が悪い",
};
// 最終更新: 2026-09-11 — 普通・判定前の相手は表示せず、相性と相手より上位だった回数・割合を表示する。
export function CompatibilityPanel({
  entries,
}: {
  entries: OpponentCompatibility[];
}) {
  return (
    <section
      className="panel compatibility-panel"
      aria-labelledby="compatibility-title"
    >
      <div className="panel-heading">
        <h2 id="compatibility-title">対戦相手との相性</h2>
        <span className="muted">全期間</span>
      </div>
      {entries.length ? (
        <div className="compatibility-list">
          {entries.map((entry) => (
            <article className="compatibility-row" key={entry.playerId}>
              <div className="compatibility-person">
                <PlayerIdentity
                  id={entry.playerId}
                  compact
                  subtitle={`同卓 ${entry.gamesPlayed}戦`}
                />
                <span
                  className={`title-badge ${entry.rating === "good" || entry.rating === "slightlyGood" ? "positive" : "negative"}`}
                >
                  {ratingLabels[entry.rating]}
                </span>
              </div>
              <dl className="compatibility-values">
                <div>
                  <dt>相手より上位だった割合</dt>
                  <dd className={resultClass(entry.winRate - 50)}>
                    {percent(entry.winRate)}
                  </dd>
                </div>
                <div>
                  <dt>上回った回数／同卓回数</dt>
                  <dd>
                    {entry.wins} / {entry.gamesPlayed}
                    <small> 戦</small>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          現時点では、相性に目立った傾向がある相手はいません。
        </p>
      )}
    </section>
  );
}

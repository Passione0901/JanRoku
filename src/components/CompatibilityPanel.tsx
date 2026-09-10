import type { OpponentCompatibility } from "../domain/compatibility";
import {
  COMPATIBILITY_MIN_GAMES,
  COMPATIBILITY_MIN_DIFFERENCE,
} from "../domain/compatibility";
import { PlayerIdentity } from "./PlayerIdentity";
import { result, resultClass } from "../utils/format";

// 最終更新: 2026-09-10 — 普通・判定前の相手は表示せず、判定根拠を個人ページ内で確認できるようにする。
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
                  className={`title-badge ${entry.rating === "good" ? "positive" : "negative"}`}
                >
                  {entry.rating === "good" ? "相性が良い" : "相性が悪い"}
                </span>
              </div>
              <dl className="compatibility-values">
                <div>
                  <dt>同卓時の平均収支</dt>
                  <dd className={resultClass(entry.averageResult)}>
                    {result(entry.averageResult)}
                    <small> pt／戦</small>
                  </dd>
                </div>
                <div>
                  <dt>全体平均との差</dt>
                  <dd className={resultClass(entry.difference)}>
                    {result(entry.difference)}
                    <small> pt／戦</small>
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
      <details className="compatibility-criteria">
        <summary>判定基準</summary>
        <p>
          同卓{COMPATIBILITY_MIN_GAMES}
          戦以上が対象です。同卓時の平均収支がプラスで、本人の全対局平均より
          {COMPATIBILITY_MIN_DIFFERENCE}
          pt以上高い相手を「相性が良い」、マイナスで
          {COMPATIBILITY_MIN_DIFFERENCE}
          pt以上低い相手を「相性が悪い」と表示します。通常範囲・対局数不足の相手は表示しません。同卓メンバーやルールの影響も含む、記録上の傾向です。
        </p>
      </details>
    </section>
  );
}

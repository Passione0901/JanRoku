import type { OpponentCompatibility } from "../domain/compatibility";
import {
  COMPATIBILITY_MIN_GAMES,
  COMPATIBILITY_MILD_MIN_GAMES,
  COMPATIBILITY_MILD_MIN_DIFFERENCE,
  COMPATIBILITY_MIN_DIFFERENCE,
} from "../domain/compatibility";
import { PlayerIdentity } from "./PlayerIdentity";
import { result, resultClass } from "../utils/format";

const ratingLabels = {
  good: "相性が良い",
  slightlyGood: "相性がやや良い",
  slightlyBad: "相性がやや悪い",
  bad: "相性が悪い",
};
// 最終更新: 2026-09-11 — 普通・判定前の相手は表示せず、判定根拠を個人ページ内で確認できるようにする。
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
          同卓時の本人の平均収支を、全対局の平均収支と比較します。 同卓
          {COMPATIBILITY_MIN_GAMES}戦以上で、平均収支がプラスかつ全体平均より
          {COMPATIBILITY_MIN_DIFFERENCE}
          pt以上高ければ「相性が良い」、マイナスかつ
          {COMPATIBILITY_MIN_DIFFERENCE}pt以上低ければ「相性が悪い」です。
          上記に当てはまらず、同卓{COMPATIBILITY_MILD_MIN_GAMES}
          戦以上で、平均収支がプラスかつ{COMPATIBILITY_MILD_MIN_DIFFERENCE}
          pt以上高ければ「相性がやや良い」、マイナスかつ
          {COMPATIBILITY_MILD_MIN_DIFFERENCE}
          pt以上低ければ「相性がやや悪い」です。
          それ以外は「普通」とし、対局数不足の相手とともに表示しません。同卓メンバーやルールの影響も含む、記録上の傾向です。
        </p>
      </details>
    </section>
  );
}

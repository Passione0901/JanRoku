import { useId, useMemo, useState } from "react";
import type { PlayerGame } from "../domain/types";
import { dailyResultRanges } from "../domain/dailyResultRanges";
import { formatDate } from "../utils/date";
import { result, resultClass } from "../utils/format";
// 最終更新: 2026-09-11 — 日付を選んで対局ごとの最高・最低を表示し、1対局なら最低欄を省く。
export function DailyResultRange({
  history,
  bestDay,
  worstDay,
}: {
  history: PlayerGame[];
  bestDay?: string | null;
  worstDay?: string | null;
}) {
  const days = useMemo(() => dailyResultRanges(history), [history]);
  const [date, setDate] = useState("");
  const selected = days.find((day) => day.date === date) ?? days[0];
  const id = useId();
  return (
    <section className="daily-result-range" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>日別の最高・最低収支</h3>
      {selected ? (
        <>
          <label className="daily-result-date" htmlFor={id}>
            対局日
            <select
              id={id}
              value={selected.date}
              onChange={(event) => setDate(event.target.value)}
            >
              {days.map((day) => (
                <option key={day.date} value={day.date}>
                  {formatDate(day.date)}（{day.gamesPlayed}戦）
                </option>
              ))}
            </select>
          </label>
          <dl className="record-grid">
            <div className="daily-extreme-column">
              {bestDay !== undefined && (
                <>
                  <dt>最高の1日</dt>
                  <dd>{formatDate(bestDay)}</dd>
                </>
              )}
              <dt>その日の最高収支</dt>
              <dd className={resultClass(selected.highest)}>
                {result(selected.highest)}
                <small> pt</small>
              </dd>
            </div>
            {(selected.lowest !== null || worstDay !== undefined) && (
              <div className="daily-extreme-column">
                {worstDay !== undefined && (
                  <>
                    <dt>最低の1日</dt>
                    <dd>{formatDate(worstDay)}</dd>
                  </>
                )}
                {selected.lowest !== null && (
                  <>
                    <dt>その日の最低収支</dt>
                    <dd className={resultClass(selected.lowest)}>
                      {result(selected.lowest)}
                      <small> pt</small>
                    </dd>
                  </>
                )}
              </div>
            )}
          </dl>
        </>
      ) : (
        <p className="muted">まだ対局がありません。</p>
      )}
    </section>
  );
}

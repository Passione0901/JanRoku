import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { DailySummary, Game } from "../domain/types";
import { formatDate } from "../utils/date";
import { result, resultClass } from "../utils/format";
import { PlayerIdentity } from "../components/PlayerIdentity";
import { GameCard } from "../components/GameCard";

// 最終更新: 2026-09-10 — 日別集計済みモデルを表示し、日付をURLで共有・復元する。
export function DailyPage({
  days,
  selectedDate,
  onDelete,
  busy,
}: {
  days: DailySummary[];
  selectedDate?: string;
  onDelete: (game: Game) => void;
  busy: boolean;
}) {
  const selected = selectedDate
    ? days.find((day) => day.date === selectedDate)
    : days[0];
  const index = selected ? days.indexOf(selected) : -1;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DAILY RESULTS</p>
          <h1>
            日別の記録
            <span className="heading-dot" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="muted">あの日の勝ち負けを、まとめて。</p>
        </div>
      </div>
      {days.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={30} />
          <p>対局を登録すると、日別の記録が表示されます。</p>
          <a className="button primary" href="#/input">
            戦を記録
          </a>
        </div>
      ) : (
        <>
          <div className="day-picker">
            <label htmlFor="day-select">
              <CalendarDays size={18} />
              開催日
            </label>
            <select
              id="day-select"
              value={selected?.date ?? ""}
              onChange={(event) => {
                window.location.hash = `/daily/${event.target.value}`;
              }}
            >
              {!selected && <option value="">日付を選択</option>}
              {days.map((day) => (
                <option key={day.date} value={day.date}>
                  {formatDate(day.date)} · {day.games.length} 戦
                </option>
              ))}
            </select>
            <div className="day-arrows">
              {days[index + 1] ? (
                <a
                  className="icon-button"
                  href={`#/daily/${days[index + 1].date}`}
                  aria-label="前の開催日"
                >
                  <ChevronLeft size={19} />
                </a>
              ) : (
                <button
                  className="icon-button"
                  disabled
                  aria-label="前の開催日"
                >
                  <ChevronLeft size={19} />
                </button>
              )}
              {index > 0 ? (
                <a
                  className="icon-button"
                  href={`#/daily/${days[index - 1].date}`}
                  aria-label="次の開催日"
                >
                  <ChevronRight size={19} />
                </a>
              ) : (
                <button
                  className="icon-button"
                  disabled
                  aria-label="次の開催日"
                >
                  <ChevronRight size={19} />
                </button>
              )}
            </div>
          </div>
          {selected ? (
            <div className="daily-layout">
              <section className="daily-totals panel">
                <div className="panel-heading">
                  <h2>{formatDate(selected.date)}</h2>
                  <p className="muted">
                    この日の合計収支 / {selected.games.length} 戦
                  </p>
                </div>
                <div>
                  {selected.results.map((entry, i) => (
                    <div className="daily-player" key={entry.playerId}>
                      <span className="table-place">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <PlayerIdentity
                        id={entry.playerId}
                        subtitle={`${entry.gamesPlayed} 戦`}
                        compact
                      />
                      <strong className={resultClass(entry.totalResult)}>
                        {result(entry.totalResult)}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className="daily-games">
                <h2>
                  この日の対局 <small>古い順</small>
                </h2>
                {selected.games.map((game, i) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    label={`第${i + 1}戦`}
                    onDelete={onDelete}
                    busy={busy}
                  />
                ))}
              </section>
            </div>
          ) : (
            <div className="empty-state">
              この日付には記録がありません。別の開催日を選択してください。
            </div>
          )}
        </>
      )}
    </>
  );
}

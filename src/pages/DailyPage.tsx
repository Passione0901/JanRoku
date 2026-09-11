import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Newspaper,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { useNewsAvailability } from "../hooks/useNewsAvailability";
import type { DailySummary, Game } from "../domain/types";
import { formatDate } from "../utils/date";
import { result, resultClass } from "../utils/format";
import { PlayerIdentity } from "../components/PlayerIdentity";
import { GameCard } from "../components/GameCard";
const DailyNewsPage = lazy(() => import("./DailyNewsPage"));

// 最終更新: 2026-09-10 — 日別集計済みモデルを表示し、日付をURLで共有・復元する。
export function DailyPage({
  days,
  selectedDate,
  onDelete,
  busy,
  newsRequested = false,
  newsEnabled = false,
  games = [],
}: {
  days: DailySummary[];
  selectedDate?: string;
  onDelete: (game: Game) => void;
  busy: boolean;
  newsRequested?: boolean;
  newsEnabled?: boolean;
  games?: Game[];
}) {
  const selected = selectedDate
    ? days.find((day) => day.date === selectedDate)
    : days[0];
  const index = selected ? days.indexOf(selected) : -1;
  const available = useNewsAvailability(selected?.date ?? "");
  if (newsRequested)
    return selected && available && newsEnabled ? (
      <Suspense
        fallback={
          <div className="empty-state" role="status">
            ニュースを準備中…
          </div>
        }
      >
        <DailyNewsPage key={selected.date} date={selected.date} games={games} />
      </Suspense>
    ) : (
      <div className="empty-state">
        <p>
          {!newsEnabled
            ? "ニュースは実際の記録から閲覧できます。"
            : !selected
              ? "この日付には記録がありません。"
              : "ニュースは開催日の翌日0時（日本時間）から読めます。"}
        </p>
        <a
          className="button subtle"
          href={selected ? `#/daily/${selected.date}` : "#/daily"}
        >
          日別の記録に戻る
        </a>
      </div>
    );
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
        </div>
      </div>
      {days.length === 0 ? (
        <div className="empty-state">
          <CalendarDays size={30} />
          <p>対局を登録すると、日別の記録が表示されます。</p>
          <a className="button primary" href="#/input">
            対局を記録
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
            {selected && available && newsEnabled && (
              <a
                className="button subtle day-news-button"
                href={`#/daily/${selected.date}/news`}
              >
                <Newspaper size={17} />
                ニュース
              </a>
            )}
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

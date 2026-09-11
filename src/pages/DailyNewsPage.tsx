import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { Game } from "../domain/types";
import { usePlayers } from "../hooks/usePlayers";
import { useGroup } from "../hooks/useGroup";
import { createNewsEdition } from "../domain/news/edition";
import { formatDate } from "../utils/date";
import { result, resultClass } from "../utils/format";
import "./DailyNewsPage.css";

// 最終更新: 2026-09-12 — 当日の事実から作る記事と創作コメントを区別し、何度でも読める一画面にする。
export default function DailyNewsPage({
  date,
  games,
}: {
  date: string;
  games: Game[];
}) {
  const { players } = usePlayers();
  const group = useGroup();
  const title = useRef<HTMLHeadingElement>(null);
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const generated = useMemo(() => {
    try {
      return {
        edition: createNewsEdition({
          date,
          games,
          players,
          groupId: group.id,
          realRecords: true,
        }),
        error: "",
      };
    } catch (error) {
      return {
        edition: null,
        error:
          error instanceof Error
            ? error.message
            : "ニュースを作成できませんでした。",
      };
    }
  }, [date, games, players, group.id]);
  const edition = generated.edition;
  useEffect(() => {
    title.current?.focus();
  }, [date]);
  useEffect(() => {
    if (!playing || !edition || edition.ticker.length < 2) return;
    const timer = setInterval(() => setTick((n) => n + 1), 7000);
    return () => clearInterval(timer);
  }, [playing, edition]);
  return (
    <div className="daily-news-page">
      <a className="back-link" href={`#/daily/${date}`}>
        日別の記録に戻る
      </a>
      <header className="news-masthead">
        <div>
          <p className="news-edition-date">{formatDate(date)} の振り返り</p>
          <h1 ref={title} tabIndex={-1}>
            雀録ニュース
          </h1>
        </div>
        {edition && (
          <p>
            {edition.playerCount}人参加 · {edition.formatSummary}
          </p>
        )}
      </header>
      {!edition ? (
        <div className="empty-state" role="status">
          {generated.error || "この日のニュースはまだありません。"}
        </div>
      ) : (
        <>
          <section className="news-front" aria-labelledby="news-front-title">
            <p className="news-kicker">一面見出し</p>
            <h2 id="news-front-title">{edition.headline}</h2>
            <p className="muted">
              勝利、接戦、巻き返し。この日の選手たちにスポットを当てます。
            </p>
          </section>
          <section className="news-ticker" aria-label="この日の速報テロップ">
            <strong>この日の速報</strong>
            <p aria-live={playing ? "off" : "polite"}>
              {edition.ticker[tick % edition.ticker.length]}
            </p>
            <div className="news-ticker-controls">
              <button
                className="icon-button"
                aria-label="前の速報"
                onClick={() =>
                  setTick(
                    (n) =>
                      (n + edition.ticker.length - 1) % edition.ticker.length,
                  )
                }
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                {(tick % edition.ticker.length) + 1}/{edition.ticker.length}
              </span>
              <button
                className="icon-button"
                aria-label="次の速報"
                onClick={() => setTick((n) => n + 1)}
              >
                <ChevronRight size={18} />
              </button>
              <button
                className="icon-button"
                aria-label={playing ? "速報の自動再生を停止" : "速報を自動再生"}
                onClick={() => setPlaying((v) => !v)}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
            </div>
          </section>
          <section className="news-section" aria-labelledby="news-digest-title">
            <h2 id="news-digest-title">本日のニュース</h2>
            <ul className="news-digest">
              {edition.news.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </section>
          <section
            className="news-section"
            aria-labelledby="news-members-title"
          >
            <h2 id="news-members-title">選手の一言総評</h2>
            <p className="muted">勝負の結果に添える、編集部の一言。</p>
            <div className="news-member-list">
              {edition.members.map((m) => (
                <div className="news-member-row" key={m.id}>
                  <div className="news-member-name">
                    <i style={{ background: m.color }} aria-hidden="true" />
                    <strong>{m.name}</strong>
                    <small>{m.games}戦</small>
                    <b className={resultClass(m.total)}>{result(m.total)} pt</b>
                  </div>
                  <p>{m.summary}</p>
                </div>
              ))}
            </div>
          </section>
          <section
            className="news-section"
            aria-labelledby="news-interview-title"
          >
            <h2 id="news-interview-title">架空インタビュー</h2>
            <p className="muted">
              本人の発言ではありません。成績を題材にした架空の質問と回答です。
            </p>
            <div className="news-interviews">
              {edition.members.map((m) => (
                <details key={m.id}>
                  <summary>{m.name}選手</summary>
                  <dl>
                    <dt>Q. {m.question}</dt>
                    <dd>A. {m.answer}</dd>
                  </dl>
                </details>
              ))}
            </div>
          </section>
          <section
            className="news-section news-article-section"
            aria-labelledby="news-article-title"
          >
            <h2 id="news-article-title">この日の特集</h2>
            <article className="news-article">
              <h3>{edition.headline}</h3>
              {edition.paragraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </article>
            <section
              className="news-reader-comments"
              aria-labelledby="news-comments-title"
            >
              <h3 id="news-comments-title">架空の読者コメント</h3>
              <p className="muted">実際に投稿されたコメントではありません。</p>
              {edition.comments.map((text, i) => (
                <p className="news-reader-comment" key={i}>
                  {text}
                </p>
              ))}
            </section>
          </section>
          <a className="button subtle" href={`#/daily/${date}`}>
            日別の記録に戻る
          </a>
        </>
      )}
    </div>
  );
}

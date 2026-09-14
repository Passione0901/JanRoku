import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDate } from "../utils/date";
// Updated 2026-09-14: Expand both plot axes while keeping labels and line widths readable.
export function ChartZoom({
  children,
}: {
  children: (width: number, zoom: number) => ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(760);
  // Measure the unzoomed viewport so resizing does not change the chosen magnification.
  useEffect(() => {
    if (!viewport.current || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setBaseWidth(Math.max(640, entry.contentRect.width)));
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div className="chart-zoom-controls">
        <button
          className="button subtle"
          aria-label="グラフを縮小"
          disabled={zoom === 1}
          onClick={() => setZoom((v) => Math.max(1, v - 1))}
        >
          − 縮小
        </button>
        <span aria-live="polite">{zoom}倍</span>
        <button
          className="button subtle"
          aria-label="グラフを拡大"
          disabled={zoom === 8}
          onClick={() => setZoom((v) => Math.min(8, v + 1))}
        >
          ＋ 拡大
        </button>
        <button
          className="button subtle"
          onClick={() => {
            setZoom(1);
            viewport.current?.scrollTo({ left: 0, top: 0 });
          }}
        >
          表示をリセット
        </button>
      </div>
      <p className="chart-direction">
        縦・横を1〜8倍に拡大できます。上下左右にスワイプ／スクロールして移動。
      </p>
      <div
        className="chart-viewport"
        style={{ maxHeight: 'min(70vh, 640px)', overflow: 'auto' }}
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label="グラフ表示範囲"
      >
        <div style={{ width: baseWidth * zoom }}>
          {children(baseWidth * zoom, zoom)}
        </div>
      </div>
    </>
  );
}
// Updated 2026-09-14: Divide days between games; label a day only once, with sparse labels when crowded.
function dayRanges(games: { date: string }[], width: number) {
  const x = (i: number) => 58 + (i / games.length) * (width - 80);
  return games.flatMap((g, i) => {
    if (i && games[i - 1].date === g.date) return [];
    let end = i + 1;
    while (end < games.length && games[end].date === g.date) end++;
    return [{ date: g.date, start: i, left: i ? x(i + .5) : 58, center: (x(i + 1) + x(end)) / 2 }];
  });
}
export function ChartDayGrid({ games, width, bottom = 384 }: { games: { date: string }[]; width: number; bottom?: number }) {
  return <g className="chart-day-grid" aria-hidden="true">{dayRanges(games, width).filter(d => d.start > 0).map(d =>
    <line key={d.start} x1={d.left} x2={d.left} y1="24" y2={bottom} stroke="#777d90" strokeOpacity=".35" strokeDasharray="3 5" />
  )}</g>;
}
export function ChartDates({ games, width, offsetY = 0 }: {
  games: { date: string }[]; width: number; offsetY?: number;
}) {
  let lastX = -Infinity;
  let lastYear = '';
  return <g transform={`translate(0 ${offsetY})`}>{dayRanges(games, width).map(d => {
    if (d.center - lastX < 95) return null;
    lastX = d.center;
    const year = d.date.slice(0, 4);
    const showYear = year !== lastYear;
    lastYear = year;
    return <g key={d.start}>
      <title>{formatDate(d.date)}</title>
      <text x={d.center} y="236" textAnchor={d.center > width - 65 ? 'end' : 'middle'} fill="#b9bfd0" fontSize="13">
        {`${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`}
      </text>
      {showYear && <text x={d.center} y="257" textAnchor={d.center > width - 65 ? 'end' : 'middle'} fill="#999eb0" fontSize="11">{year}年</text>}
    </g>;
  })}</g>;
}

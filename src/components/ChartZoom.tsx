import { useRef, useState, type ReactNode } from "react";
import { formatDate } from "../utils/date";
// 最終更新: 2026-09-10 — 横軸だけを拡大し、スクロールとキー操作で移動できる共通枠。
export function ChartZoom({
  children,
}: {
  children: (width: number, zoom: number) => ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
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
            viewport.current?.scrollTo({ left: 0 });
          }}
        >
          表示をリセット
        </button>
      </div>
      <p className="chart-direction">
        横軸を1〜8倍に拡大できます。左右にスワイプ／スクロールして移動。
      </p>
      <div
        className="chart-viewport"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label="グラフ表示範囲"
      >
        <div style={{ width: `${zoom * 100}%`, minWidth: 430 * zoom }}>
          {children(760 * zoom, zoom)}
        </div>
      </div>
    </>
  );
}
// 最終更新: 2026-09-10 — 対局の位置に日付を付け、拡大時はより多くの目盛りを表示する。
export function ChartDates({
  games,
  width,
}: {
  games: { date: string }[];
  width: number;
}) {
  const x = (i: number) => 58 + ((i + 1) / games.length) * (width - 80);
  const chosen: number[] = [];
  for (let i = 0; i < games.length - 1; i++) {
    if (
      (!chosen.length || x(i) - x(chosen.at(-1)!) >= 150) &&
      x(games.length - 1) - x(i) >= 150
    )
      chosen.push(i);
  }
  chosen.push(games.length - 1);
  return (
    <g>
      {chosen.map((i) => (
        <g key={i}>
          <line x1={x(i)} x2={x(i)} y1="205" y2="217" stroke="#777d90" />
          <text
            x={x(i)}
            y="236"
            textAnchor={i === games.length - 1 ? "end" : "middle"}
            fill="#b9bfd0"
            fontSize="13"
          >
            {formatDate(games[i].date)}
          </text>
          <text
            x={x(i)}
            y="257"
            textAnchor={i === games.length - 1 ? "end" : "middle"}
            fill="#999eb0"
            fontSize="12"
          >
            {i + 1}戦目
          </text>
        </g>
      ))}
    </g>
  );
}

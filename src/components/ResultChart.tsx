import { ChartZoom, ChartDates } from "./ChartZoom";
import { useId, useState } from "react";
import type { PlayerGame } from "../domain/types";
import { result } from "../utils/format";
import { formatDate } from "../utils/date";

// 最終更新: 2026-09-10 — 集計済み累計から軽量SVGを描画。0戦・1戦・全負数も同じ軸処理を使う。
export function ResultChart({
  history,
  color = "#ddbd7e",
}: {
  history: PlayerGame[];
  color?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = history.find((entry) => entry.gameId === selectedId);
  const gradient = useId().replaceAll(":", "");
  const geometry = (width: number) => {
    const values = [0, ...history.map((entry) => entry.cumulativeResult)];
    const min = Math.min(-10, ...values);
    const max = Math.max(10, ...values);
    const padding = (max - min) * 0.12;
    const low = min - padding;
    const high = max + padding;
    const y = (value: number) => 24 + ((high - value) / (high - low)) * 176;
    const points = values.map((value, i) => ({
      x: 58 + (i / Math.max(1, values.length - 1)) * (width - 80),
      y: y(value),
      value,
    }));
    return { points, y, min, max };
  };
  if (!history.length)
    return (
      <div className="empty-state">
        対局を登録すると、累計収支の推移が表示されます。
      </div>
    );
  return (
    <div className="chart-wrap">
      <ChartZoom>
        {(width) => {
          const { points, y, min, max } = geometry(width);
          const line = points
            .map((point, i) => `${i === 0 ? "M" : "L"}${point.x},${point.y}`)
            .join(" ");
          const ticks = [max, (max + min) / 2, min];
          return (
            <svg
              viewBox={`0 0 ${width} 280`}
              role="img"
              aria-label={`累計収支の推移。${history.length}戦、現在${result(history.at(-1)!.cumulativeResult)}ポイント。左が過去、右が最新。縦軸は累計収支pt。`}
            >
              <defs>
                <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity=".16" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1="58"
                    x2={width - 22}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="#2c303d"
                  />
                  <text
                    x="45"
                    y={y(tick) + 4}
                    textAnchor="end"
                    fill="#999eb0"
                    fontSize="12"
                  >
                    {Math.round(tick)}
                  </text>
                </g>
              ))}
              <line
                x1="58"
                x2={width - 22}
                y1={y(0)}
                y2={y(0)}
                stroke="#555969"
                strokeDasharray="4 5"
              />
              <path
                d={`${line} L${width - 22},210 L58,210 Z`}
                fill={`url(#${gradient})`}
              />
              <path
                d={line}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.slice(1).map((point, i) => (
                <circle
                  key={history[i].gameId}
                  tabIndex={0}
                  role="button"
                  aria-label={`${formatDate(history[i].date)}・${i + 1}戦目・累計${result(point.value)}pt`}
                  onClick={() => setSelectedId(history[i].gameId)}
                  onFocus={() => setSelectedId(history[i].gameId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(history[i].gameId);
                    }
                  }}
                  cx={point.x}
                  cy={point.y}
                  r="7"
                  fill={color}
                  stroke="#191c25"
                  strokeWidth="1"
                >
                  <title>
                    {formatDate(history[i].date)} · {i + 1}戦目 · 累計{" "}
                    {result(point.value)}
                  </title>
                </circle>
              ))}
              <ChartDates games={history} width={width} />
            </svg>
          );
        }}
      </ChartZoom>
      <p className="chart-direction">過去 → 最新（対局順） · 累計収支 pt</p>
      <p className="chart-selection" role="status">
        {selected
          ? `${formatDate(selected.date)} · ${selected.rank}位 · 対局収支 ${result(selected.result)}pt · 累計 ${result(selected.cumulativeResult)}pt`
          : "点をタップして成績を確認"}
      </p>
    </div>
  );
}

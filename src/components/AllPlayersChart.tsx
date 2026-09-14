import { ChartZoom, ChartDates, ChartDayGrid } from "./ChartZoom";
import { chartTicks } from '../utils/chartTicks';
import { useState } from "react";
import type { PlayerStats } from "../domain/types";
import { usePlayers } from "../hooks/usePlayers";
import { result } from "../utils/format";
import { ChartLineKey, chartLineStyle } from './ChartLineKey';
// 最終更新: 2026-09-12 — 選択を変えても共通の対局順・収支軸を保ち、非表示の人の詳細は隠す。
export function AllPlayersChart({
  stats,
  visiblePlayerIds,
}: {
  stats: PlayerStats[];
  visiblePlayerIds: string[];
}) {
  const { findPlayer, players } = usePlayers();
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [detail, setDetail] = useState<{
    playerId: string;
    label: string;
  } | null>(null);
  const visibleStats = stats.filter((s) =>
    visiblePlayerIds.includes(s.playerId),
  );
  const games = [
    ...new Map(
      stats.flatMap((s) => s.history).map((g) => [g.gameId, g]),
    ).values(),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.gameId.localeCompare(b.gameId),
  );
  if (!visiblePlayerIds.length)
    return (
      <div className="empty-state">
        表示するメンバーにチェックを入れてください。
      </div>
    );
  if (!visibleStats.some((s) => s.history.length))
    return <div className="empty-state">まだ対局がありません。</div>;
  const indices = new Map(games.map((g, i) => [g.gameId, i + 1]));
  const values = stats.flatMap((s) => s.history.map((g) => g.cumulativeResult));
  const low = Math.min(-10, ...values),
    high = Math.max(10, ...values);
  const padding = (high - low) * 0.08;
  const y = (v: number) => 24 + ((high + padding - v) / (high - low + padding * 2)) * 360;

  return (
    <div className="chart-wrap">
      <ChartZoom>
        {(width) => {
          const x = (i: number) => 58 + (i / games.length) * (width - 80);
          return (
            <svg
              viewBox={`0 0 ${width} 464`}
              role="img"
              aria-label="選択したメンバーの累計収支。左が過去、右が最新。共通の収支軸で表示。"
            >
              <ChartDayGrid games={games} width={width} />
              {chartTicks(low - padding, high + padding).map((v) => (
                <g key={v}>
                  <line
                    x1="58"
                    x2={width - 22}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="#484b58"
                    strokeOpacity={v === 0 ? .9 : .45}
                    strokeWidth={v === 0 ? 1.5 : 1}
                  />
                  <text
                    x="48"
                    y={y(v) + 4}
                    textAnchor="end"
                    fill="#999eb0"
                    fontSize="12"
                  >
                    {v.toLocaleString('ja-JP')}
                  </text>
                </g>
              ))}
              {visibleStats
                .filter((s) => s.history.length)
                .map((s) => {
                  const player = findPlayer(s.playerId);
                  const style = chartLineStyle(s.playerId, players.map(p => p.id));
                  const points = [
                    { x: 58, y: y(0) },
                    ...s.history.map((g) => ({
                      x: x(indices.get(g.gameId)!),
                      y: y(g.cumulativeResult),
                    })),
                  ];
                  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
                  return (
                    <g key={s.playerId}
                      onMouseMove={e => setHover({ id: s.playerId, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHover(null)}>
                      <path d={line} fill="none" stroke="transparent" strokeWidth="16" pointerEvents="stroke"
                        onClick={() => setDetail({ playerId: s.playerId, label: player.name })} />
                      <path
                        data-player-id={s.playerId}
                        d={points
                          .map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`)
                          .join(" ")}
                        fill="none"
                        className={style.dash ? 'chart-player-line chart-player-line-dashed' : 'chart-player-line'}
                        stroke={style.color}
                        strokeWidth={hover?.id === s.playerId ? 4.5 : 3}
                        strokeDasharray={style.dash}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                      {s.history.map((g, i) => {
                        const label = `${player.name} · ${g.date} · 累計 ${result(g.cumulativeResult)}pt`;
                        return (
                          <circle
                            key={g.gameId}
                            cx={points[i + 1].x}
                            cy={points[i + 1].y}
                            r="4"
                            fill={style.color}
                            stroke="var(--surface, #191c25)"
                            strokeWidth="1.5"
                            role="button"
                            tabIndex={0}
                            aria-label={label}
                            onClick={() =>
                              setDetail({ playerId: s.playerId, label })
                            }
                            onFocus={() =>
                              setDetail({ playerId: s.playerId, label })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setDetail({ playerId: s.playerId, label });
                              }
                            }}
                          >
                            <title>{label}</title>
                          </circle>
                        );
                      })}
                    </g>
                  );
                })}
              <ChartDates games={games} width={width} offsetY={184} />
            </svg>
          );
        }}
      </ChartZoom>
      {hover && visiblePlayerIds.includes(hover.id) && <div role="tooltip" style={{ position: 'fixed', left: Math.max(8, Math.min(hover.x + 14, window.innerWidth - 200)), top: Math.max(8, hover.y - 42), maxWidth: 184, padding: '6px 10px', borderRadius: 6, background: 'var(--surface, #191c25)', color: 'var(--text, #eee)', border: '1px solid var(--border, #777)', pointerEvents: 'none', zIndex: 1000 }}>{findPlayer(hover.id).name}</div>}
      <p className="chart-selection" role="status">
        {detail && visiblePlayerIds.includes(detail.playerId)
          ? detail.label
          : "線にカーソルを合わせると名前、点を選ぶと成績を表示します。"}
      </p>
      <div className="chart-legend">
        {visibleStats.map((s) => (
          <span key={s.playerId}>
            <ChartLineKey id={s.playerId} />
            {findPlayer(s.playerId).name}
            {!s.history.length ? "（未対局）" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

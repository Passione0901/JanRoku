import { ChartZoom, ChartDates } from "./ChartZoom";
import { useState } from "react";
import type { PlayerStats } from "../domain/types";
import { usePlayers } from "../hooks/usePlayers";
import { result } from "../utils/format";
// 最終更新: 2026-09-12 — 選択を変えても共通の対局順・収支軸を保ち、非表示の人の詳細は隠す。
export function AllPlayersChart({
  stats,
  visiblePlayerIds,
}: {
  stats: PlayerStats[];
  visiblePlayerIds: string[];
}) {
  const { findPlayer } = usePlayers();
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
  const y = (v: number) => 24 + ((high - v) / (high - low)) * 176;

  return (
    <div className="chart-wrap">
      <ChartZoom>
        {(width) => {
          const x = (i: number) => 58 + (i / games.length) * (width - 80);
          return (
            <svg
              viewBox={`0 0 ${width} 280`}
              role="img"
              aria-label="選択したメンバーの累計収支。左が過去、右が最新。共通の収支軸で表示。"
            >
              {[low, 0, high].map((v) => (
                <g key={v}>
                  <line
                    x1="58"
                    x2={width - 22}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="#484b58"
                  />
                  <text
                    x="48"
                    y={y(v) + 4}
                    textAnchor="end"
                    fill="#999eb0"
                    fontSize="12"
                  >
                    {Math.round(v)}
                  </text>
                </g>
              ))}
              {visibleStats
                .filter((s) => s.history.length)
                .map((s) => {
                  const player = findPlayer(s.playerId);
                  const points = [
                    { x: 58, y: y(0) },
                    ...s.history.map((g) => ({
                      x: x(indices.get(g.gameId)!),
                      y: y(g.cumulativeResult),
                    })),
                  ];
                  return (
                    <g key={s.playerId}>
                      <path
                        d={points
                          .map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`)
                          .join(" ")}
                        fill="none"
                        stroke={player.color}
                        strokeWidth="2.5"
                      />
                      {s.history.map((g, i) => {
                        const label = `${player.name} · ${g.date} · 累計 ${result(g.cumulativeResult)}pt`;
                        return (
                          <circle
                            key={g.gameId}
                            cx={points[i + 1].x}
                            cy={points[i + 1].y}
                            r="5"
                            fill={player.color}
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
              <ChartDates games={games} width={width} />
            </svg>
          );
        }}
      </ChartZoom>
      <p className="chart-selection" role="status">
        {detail && visiblePlayerIds.includes(detail.playerId)
          ? detail.label
          : "線上の点を選ぶと成績を表示します。"}
      </p>
      <div className="chart-legend">
        {visibleStats.map((s) => (
          <span key={s.playerId}>
            <i style={{ background: findPlayer(s.playerId).color }} />
            {findPlayer(s.playerId).name}
            {!s.history.length ? "（未対局）" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

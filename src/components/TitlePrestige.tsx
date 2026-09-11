import type { CSSProperties } from "react";
import "./TitlePrestige.css";

// 最終更新: 2026-09-11 — 枠の可動部・光の経路・粒子を分離し、称号の文字を動かさない。
export function TitlePrestige({ rank }: { rank: number }) {
  const fins = rank >= 61 ? 3 : 1;
  const particles = rank >= 68 ? 6 : rank >= 61 ? 4 : 2;
  return (
    <span className="rank-prestige" aria-hidden="true">
      <span className="prestige-rail" />
      <svg
        className="prestige-trace"
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
      >
        <rect x="1" y="1" width="98" height="28" rx="3" pathLength="100" />
      </svg>
      {(["left", "right"] as const).map((side) => (
        <span key={side} className={`prestige-flank prestige-flank--${side}`}>
          {Array.from({ length: fins }, (_, i) => (
            <i key={i} style={{ "--fin": i } as CSSProperties} />
          ))}
        </span>
      ))}
      {rank === 55 && (
        <span className="prestige-rivets">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {rank >= 61 && <span className="prestige-crest" />}
      {rank >= 68 && <span className="prestige-core" />}
      {(rank === 63 || rank === 65 || rank === 70) && (
        <span className="prestige-wave" />
      )}
      <span className="prestige-particles">
        {Array.from({ length: particles }, (_, i) => (
          <i key={i} style={{ "--particle": i } as CSSProperties} />
        ))}
      </span>
    </span>
  );
}

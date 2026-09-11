import { useEffect, useRef, useId, type CSSProperties } from "react";
import { titleConfig } from "../config/titleConfig";
import { registerTitleShader } from "./titleShader";
import { TitleWear } from "./TitleWear";
import { TitlePrestige } from "./TitlePrestige";
import "./TitleBadge.css";

// 最終更新: 2026-09-11 — 称号だけに装飾を付け、未対局や他のラベルは従来の表示を保つ。
export function TitleBadge({ title }: { title: string }) {
  const rank = titleConfig.find((entry) => entry.name === title)?.minStrength;
  const ref = useRef<HTMLSpanElement>(null);
  const shaderRef = useRef<HTMLCanvasElement>(null);
  const instance = useId();
  const phase =
    [...instance].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 17;

  // 最終更新: 2026-09-11 — 全称号を対象にし、画面外・非表示タブだけアニメを止める。
  useEffect(() => {
    const element = ref.current;
    if (!element || rank === undefined) return;
    const shader =
      shaderRef.current && rank >= 52
        ? registerTitleShader(shaderRef.current, rank)
        : undefined;
    let visible = true;
    const update = () => {
      element.dataset.animate = String(visible && !document.hidden);
      shader?.setVisible(visible);
    };
    const observer =
      "IntersectionObserver" in window
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            update();
          })
        : undefined;
    observer?.observe(element);
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      shader?.dispose();
      document.removeEventListener("visibilitychange", update);
    };
  }, [rank]);

  if (rank === undefined) return <span className="title-badge">{title}</span>;
  return (
    <span
      ref={ref}
      className={`rank-title ${rank <= 48 ? "rank-title--worn" : "rank-title--prestige"}`}
      data-rank={rank}
      data-animate="false"
      style={
        {
          "--rank-delay": `${-2.5 - (rank % 5) * 0.35 - phase * 0.17}s`,
        } as CSSProperties
      }
    >
      <span className="rank-title__face" aria-hidden="true">
        <span className="rank-title__texture" />
        {rank > 48 && <span className="rank-title__light" />}
        {rank >= 52 && (
          <canvas ref={shaderRef} className="rank-title__shader" />
        )}
      </span>
      <span className="rank-title__name">{title}</span>
      {rank <= 48 && <TitleWear rank={rank} />}
      {rank >= 52 && <TitlePrestige rank={rank} />}
    </span>
  );
}

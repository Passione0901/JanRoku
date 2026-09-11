import { useEffect, useRef, type CSSProperties } from "react";
import { titleConfig } from "../config/titleConfig";
import { registerTitleShader } from "./titleShader";
import "./TitleBadge.css";

// 最終更新: 2026-09-11 — 称号だけに装飾を付け、未対局や他のラベルは従来の表示を保つ。
export function TitleBadge({ title }: { title: string }) {
  const rank = titleConfig.find((entry) => entry.name === title)?.minStrength;
  const ref = useRef<HTMLSpanElement>(null);
  const shaderRef = useRef<HTMLCanvasElement>(null);

  // 最終更新: 2026-09-11 — 全称号を対象にし、画面外・非表示タブだけアニメを止める。
  useEffect(() => {
    const element = ref.current;
    if (!element || rank === undefined) return;
    const shader =
      shaderRef.current && rank >= 61
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
      className="rank-title"
      data-rank={rank}
      data-animate="false"
      style={
        { "--rank-delay": `${-2.5 - (rank % 5) * 0.35}s` } as CSSProperties
      }
    >
      <span className="rank-title__face" aria-hidden="true">
        <span className="rank-title__texture" />
        <span className="rank-title__light" />
        {rank >= 61 && (
          <canvas ref={shaderRef} className="rank-title__shader" />
        )}
      </span>
      <span className="rank-title__name">{title}</span>
      <span
        className="rank-title__ornament rank-title__ornament--left"
        aria-hidden="true"
      />
      <span
        className="rank-title__ornament rank-title__ornament--right"
        aria-hidden="true"
      />
      {rank >= 61 && <span className="rank-title__crest" aria-hidden="true" />}
      {rank >= 68 && <span className="rank-title__jewel" aria-hidden="true" />}
      {rank >= 61 && (
        <span className="rank-title__sparkles" aria-hidden="true" />
      )}
    </span>
  );
}

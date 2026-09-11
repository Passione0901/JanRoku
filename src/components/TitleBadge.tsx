import { useEffect, useRef } from "react";
import { titleConfig } from "../config/titleConfig";
import "./TitleBadge.css";

// 最終更新: 2026-09-11 — 称号だけに装飾を付け、未対局や他のラベルは従来の表示を保つ。
export function TitleBadge({ title }: { title: string }) {
  const rank = titleConfig.find((entry) => entry.name === title)?.minStrength;
  const ref = useRef<HTMLSpanElement>(null);

  // 最終更新: 2026-09-11 — 画面外・非表示タブのアニメを止め、スマホの描画負荷を抑える。
  useEffect(() => {
    const element = ref.current;
    if (
      !element ||
      rank === undefined ||
      rank < 52 ||
      !("IntersectionObserver" in window)
    )
      return;
    let visible = false;
    const update = () => {
      element.dataset.animate = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
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
    >
      <span className="rank-title__face" aria-hidden="true">
        <span className="rank-title__texture" />
        <span className="rank-title__light" />
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
    </span>
  );
}

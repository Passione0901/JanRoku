import type { CSSProperties } from "react";
import { usePlayers } from "../hooks/usePlayers";
import { MahjongAvatar } from "./MahjongAvatar";

// 最終更新: 2026-09-10 — 名前から常に個人戦績へ移動できる共通表示。
export function PlayerIdentity({
  id,
  subtitle,
  compact = false,
}: {
  id: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const { findPlayer } = usePlayers();
  const player = findPlayer(id);
  return (
    <a
      className={`player-identity ${compact ? "compact" : ""}`}
      href={`#/players/${id}`}
    >
      <span
        className="avatar"
        style={{ "--player-color": player.color } as CSSProperties}
      >
        <MahjongAvatar id={player.id} />
      </span>
      <span className="identity-text">
        <strong>{player.name}</strong>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </a>
  );
}
export function TitleBadge({ title }: { title: string }) {
  return <span className="title-badge">{title}</span>;
}

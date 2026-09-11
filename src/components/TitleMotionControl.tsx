import { useSyncExternalStore } from "react";
import {
  getTitleMotion,
  setTitleMotion,
  subscribeTitleMotion,
  type TitleMotion,
} from "./titleMotion";

// 最終更新: 2026-09-11 — アニメを見たい人が端末設定に関係なくページ内で選べる。
export function TitleMotionControl() {
  const mode = useSyncExternalStore(subscribeTitleMotion, getTitleMotion);
  return (
    <label className="title-motion-control">
      <span>称号アニメーション</span>
      <select
        value={mode}
        onChange={(event) => setTitleMotion(event.target.value as TitleMotion)}
      >
        <option value="on">表示する</option>
        <option value="system">端末の設定に合わせる</option>
        <option value="off">表示しない</option>
      </select>
    </label>
  );
}

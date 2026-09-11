export type TitleMotion = "on" | "system" | "off";
export const TITLE_MOTION_EVENT = "janroku-title-motion-change";
export const TITLE_MOTION_KEY = "janroku.title-motion.v1";

// 最終更新: 2026-09-11 — 明示的な「表示する」を端末設定より優先し、CSSとGPUへ同じ値を渡す。
export function resolveTitleMotion(mode: TitleMotion, reduced: boolean) {
  return mode === "on" || (mode === "system" && !reduced);
}
function validMode(value: string | null | undefined): value is TitleMotion {
  return value === "on" || value === "off" || value === "system";
}
function savedMode(): TitleMotion {
  try {
    const value = localStorage.getItem(TITLE_MOTION_KEY);
    if (validMode(value)) return value;
  } catch {
    /* 保存できない環境でもアニメーション表示を利用できる。 */
  }
  return "on";
}
export function getTitleMotion(): TitleMotion {
  const value = document.documentElement.dataset.titleMotion;
  return validMode(value) ? value : savedMode();
}
export function titleMotionEnabled() {
  return document.documentElement.dataset.titleMotionEnabled !== "false";
}
function applyTitleMotion(mode: TitleMotion) {
  document.documentElement.dataset.titleMotion = mode;
  document.documentElement.dataset.titleMotionEnabled = String(
    resolveTitleMotion(
      mode,
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    ),
  );
  window.dispatchEvent(new Event(TITLE_MOTION_EVENT));
}
export function setTitleMotion(mode: TitleMotion) {
  try {
    localStorage.setItem(TITLE_MOTION_KEY, mode);
  } catch {
    /* 現在のページには反映する。 */
  }
  applyTitleMotion(mode);
}
export function subscribeTitleMotion(listener: () => void) {
  window.addEventListener(TITLE_MOTION_EVENT, listener);
  return () => window.removeEventListener(TITLE_MOTION_EVENT, listener);
}
// 最終更新: 2026-09-11 — 端末追随とタブ間の変更はアプリ起動時に一度だけ購読する。
export function initializeTitleMotion() {
  applyTitleMotion(savedMode());
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const systemChanged = () => applyTitleMotion(getTitleMotion());
  const storageChanged = (event: StorageEvent) => {
    if (event.key === TITLE_MOTION_KEY || event.key === null)
      applyTitleMotion(savedMode());
  };
  query?.addEventListener("change", systemChanged);
  window.addEventListener("storage", storageChanged);
  return () => {
    query?.removeEventListener("change", systemChanged);
    window.removeEventListener("storage", storageChanged);
  };
}

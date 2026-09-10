import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
export const THEME_KEY = "janroku.theme.v1";
export type Theme = "light" | "dark";
// 最終更新: 2026-09-10 — 保存済み設定を優先し、未設定なら端末の配色に追随する。
export function preferredTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* 保存不可でも切替可能。 */
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}
export function applyInitialTheme() {
  document.documentElement.dataset.theme = preferredTheme();
}
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(preferredTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: light)");
    const update = () => setTheme(preferredTheme());
    query?.addEventListener("change", update);
    window.addEventListener("storage", update);
    return () => {
      query?.removeEventListener("change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  const label =
    theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え";
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          /* 現在の画面には反映。 */
        }
      }}
    >
      {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

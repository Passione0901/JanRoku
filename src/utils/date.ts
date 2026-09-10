// 最終更新: 2026-09-10 — 日別集計は入力した暦日を使い、UTC変換による日付ずれを防ぐ。
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const formatDate = (date: string | null) =>
  date?.replaceAll("-", "/") ?? "—";
export const shortDate = (date: string) => date.slice(5).replace("-", "/");
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
// 最終更新: 2026-09-10 — 登録時刻を日本時間で統一し、端末による表示のずれを防ぐ。
export function formatInputTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

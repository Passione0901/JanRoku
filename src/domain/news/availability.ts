// 最終更新: 2026-09-12 — 日本の開催日の翌日0時を、端末のタイムゾーンに依存せず求める。
export function newsAvailableAt(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Infinity;
  const utc = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(utc) ||
    new Date(utc).toISOString().slice(0, 10) !== date
  )
    return Infinity;
  return utc + 15 * 60 * 60 * 1000;
}
export function isNewsAvailable(date: string, now = Date.now()): boolean {
  return Number.isFinite(now) && now >= newsAvailableAt(date);
}

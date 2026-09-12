// 最終更新: 2026-09-12 — 開催日当日から閲覧可能にする。未来の日付だけは日本時間で待機する。
export function newsAvailableAt(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Infinity;
  const utc = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(utc) ||
    new Date(utc).toISOString().slice(0, 10) !== date
  )
    return Infinity;
  return utc - 9 * 60 * 60 * 1000;
}
export function isNewsAvailable(date: string, now = Date.now()): boolean {
  return Number.isFinite(now) && now >= newsAvailableAt(date);
}

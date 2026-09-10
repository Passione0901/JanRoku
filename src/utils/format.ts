// 最終更新: 2026-09-10 — 表示丸めはここだけで行い、集計値の精度を保つ。
const integerFormat = new Intl.NumberFormat("ja-JP");
export const rawScore = (value: number | null) =>
  value === null ? "—" : `${integerFormat.format(value)}点`;
export const result = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
export const percent = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;
export const average = (value: number | null) =>
  value === null ? "—" : value.toFixed(2);
export const resultClass = (value: number) =>
  value > 0 ? "positive" : value < 0 ? "negative" : "neutral";

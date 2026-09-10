import type { Four, Game, GameResult, GameFormat, Rank } from "./types";
import { entryRules } from "../config/rules";
import { isValidDate } from "../utils/date";

// 最終更新: 2026-09-10 — 空欄を0と解釈せず、持ち点入力と同じ確認フローへ渡す。
export function validateResultInput(
  date: string,
  draft: { playerId: string; resultUnits?: string }[],
  availableIds: string[],
) {
  const errors: string[] = [];
  const entries = draft.map((p, i) => {
    const value = p.resultUnits?.trim() ?? "";
    if (!/^[+-]?\d+(?:\.\d)?$/.test(value))
      errors.push(`${i + 1}人目の収支を0.1pt単位で入力してください。`);
    return { playerId: p.playerId, result: Number(value) };
  });
  if (entries.some((p) => !availableIds.includes(p.playerId)))
    errors.push("メンバーを4人選択してください。");
  let preview: Game | null = null;
  try {
    if (!errors.length)
      preview = createResultGame({
        id: "preview",
        date,
        createdAt: "2000-01-01T00:00:00Z",
        entries,
        acceptMismatch: true,
      });
  } catch (e) {
    errors.push(
      e instanceof Error ? e.message : "入力内容を確認してください。",
    );
  }
  const total =
    entries.reduce(
      (n, p) => n + (Number.isFinite(p.result) ? Math.round(p.result * 10) : 0),
      0,
    ) / 10;
  return {
    errors,
    entries: preview ? entries : null,
    total,
    expected: 0,
    mismatch: total !== 0,
    previews: preview?.players ?? null,
  };
}

// 最終更新: 2026-09-10 — 精算済みptをそのまま保存。持ち点を捏造せず、順位は収支順とする。
export function createResultGame(input: {
  id: string;
  date: string;
  createdAt: string;
  format?: GameFormat;
  entries: { playerId: string; result: number }[];
  acceptMismatch?: boolean;
}): Game {
  if (!isValidDate(input.date))
    throw new Error("有効な対局日を入力してください。");
  if (
    input.entries.length !== 4 ||
    input.entries.some((p) => !p.playerId) ||
    new Set(input.entries.map((p) => p.playerId)).size !== 4
  )
    throw new Error("異なる4人のメンバーを選択してください。");
  if (
    input.entries.some(
      (p) =>
        !Number.isFinite(p.result) ||
        Math.abs(p.result) > 100000 ||
        Math.abs(p.result * 10 - Math.round(p.result * 10)) > 1e-8,
    )
  )
    throw new Error("収支は0.1pt単位、±100,000pt以内で入力してください。");
  const mismatch =
    input.entries.reduce((n, p) => n + Math.round(p.result * 10), 0) !== 0;
  if (mismatch && !input.acceptMismatch)
    throw new Error(
      "収支の合計が0ではありません。確認してから登録してください。",
    );
  const ordered = input.entries
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => b.result - a.result || a.i - b.i);
  return {
    id: input.id,
    date: input.date,
    createdAt: input.createdAt,
    format: input.format ?? "hanchan",
    inputMode: "results",
    registeredBy: { id: "mock", name: "麻雀会メンバー", source: "mock" },
    rules: structuredClone(entryRules),
    totalMismatchAccepted: mismatch,
    players: input.entries.map((p, i) => ({
      playerId: p.playerId,
      result: Math.round(p.result * 10) / 10,
      rawScore: null,
      rank: (ordered.findIndex((p) => p.i === i) + 1) as Rank,
    })) as Four<GameResult>,
  };
}

import { isInitialSample } from "./sampleDetection";
import type { Game, Player, RuleConfig } from "../domain/types";
import { validGame, validRules } from "./LocalStorageGameRepository";
import { normalize } from "./PlayerRepository";
export interface SharedData {
  version: 1;
  players: Player[];
  games: Game[];
  rules?: RuleConfig;
}
// 最終更新: 2026-09-10 — 外部データを検証してからアプリに渡す。
export function validateShared(value: unknown): SharedData {
  if (!value || typeof value !== "object")
    throw new Error("共有データの形式が不正です。");
  const d = value as SharedData;
  if (
    d.version !== 1 ||
    !Array.isArray(d.players) ||
    !Array.isArray(d.games) ||
    !d.games.every(validGame) ||
    (d.rules !== undefined && !validRules(d.rules))
  )
    throw new Error("共有データの形式が不正です。");
  const ids = new Set<string>(),
    names = new Set<string>();
  for (const p of d.players) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !/^[a-z0-9-]+$/.test(p.id) ||
      typeof p.name !== "string" ||
      typeof p.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(p.color)
    )
      throw new Error("メンバーの形式が不正です。");
    const name = normalize(p.name).toLowerCase();
    if (ids.has(p.id) || names.has(name))
      throw new Error("メンバーが重複しています。");
    ids.add(p.id);
    names.add(name);
  }
  if (
    new Set(d.games.map((g) => g.id)).size !== d.games.length ||
    d.games.some((g) => g.players.some((p) => !ids.has(p.playerId)))
  )
    throw new Error("対局のメンバーまたはIDが不正です。");
  return d;
}
// 最終更新: 2026-09-10 — キー順や旧形式の省略値で重複判定が変わらないようにする。
export function fingerprint(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(fingerprint).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + fingerprint(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
// 最終更新: 2026-09-10 — 同名メンバーを統合し、異なる既存対局は上書きしない。
export function mergeLocal(shared: SharedData, local: SharedData): SharedData {
  const next = structuredClone(shared);
  const mapping = new Map<string, string>();
  for (const p of local.players) {
    const existing = next.players.find(
      (q) =>
        normalize(q.name).toLowerCase() === normalize(p.name).toLowerCase(),
    );
    if (existing) mapping.set(p.id, existing.id);
    else {
      if (next.players.some((q) => q.id === p.id))
        throw new Error(
          "同じIDで名前が異なるメンバーがいます。取り込みを中止しました。",
        );
      next.players.push(p);
      mapping.set(p.id, p.id);
    }
  }
  for (const g of local.games) {
    if (isInitialSample(g)) continue;
    const mapped = {
      ...g,
      players: g.players.map((p) => ({
        ...p,
        playerId: mapping.get(p.playerId) ?? p.playerId,
      })) as Game["players"],
    };
    const old = next.games.find((q) => q.id === g.id);
    if (!old) next.games.push(mapped);
    else if (
      fingerprint({ ...old, format: old.format ?? "hanchan" }) !==
      fingerprint({ ...mapped, format: mapped.format ?? "hanchan" })
    )
      throw new Error(
        "同じ対局が別の内容で保存されています。競合するため取り込みを中止しました。",
      );
  }
  return validateShared(next);
}

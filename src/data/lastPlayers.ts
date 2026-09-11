import type { Four, Player } from "../domain/types";
import { groupStorageKey, type GroupId } from "./groups";
export const LAST_PLAYERS_KEY = "janroku.last-players.v1";
// 最終更新: 2026-09-10 — 直前の新規対局の席順だけを端末に保存し、点数は引き継がない。
export function rememberPlayers(
  ids: string[],
  groupId: GroupId = "main",
): void {
  try {
    window.localStorage.setItem(
      groupStorageKey(LAST_PLAYERS_KEY, groupId),
      JSON.stringify(ids),
    );
  } catch {
    /* 対局の保存成功を設定保存の失敗で取り消さない。 */
  }
}
export function previousPlayers(
  players: Player[],
  groupId: GroupId = "main",
): Four<string> {
  const empty: Four<string> = ["", "", "", ""];
  try {
    const ids: unknown = JSON.parse(
      window.localStorage.getItem(groupStorageKey(LAST_PLAYERS_KEY, groupId)) ??
        "null",
    );
    if (!Array.isArray(ids) || ids.length !== 4) return empty;
    const used = new Set<string>();
    return ids.map((id) => {
      if (
        typeof id !== "string" ||
        !players.some((p) => p.id === id) ||
        used.has(id)
      )
        return "";
      used.add(id);
      return id;
    }) as Four<string>;
  } catch {
    return empty;
  }
}

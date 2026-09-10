import type { Four, Player } from "../domain/types";
export const LAST_PLAYERS_KEY = "janroku.last-players.v1";
// 最終更新: 2026-09-10 — 直前の新規対局の席順だけを端末に保存し、点数は引き継がない。
export function rememberPlayers(ids: string[]): void {
  try {
    window.localStorage.setItem(LAST_PLAYERS_KEY, JSON.stringify(ids));
  } catch {
    /* 対局の保存成功を設定保存の失敗で取り消さない。 */
  }
}
export function previousPlayers(players: Player[]): Four<string> {
  const empty: Four<string> = ["", "", "", ""];
  try {
    const ids: unknown = JSON.parse(
      window.localStorage.getItem(LAST_PLAYERS_KEY) ?? "null",
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

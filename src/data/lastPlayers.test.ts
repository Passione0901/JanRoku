import { it, expect, afterEach } from "vitest";
import {
  rememberPlayers,
  previousPlayers,
  LAST_PLAYERS_KEY,
} from "./lastPlayers";
import { players } from "../config/players";
afterEach(() => window.localStorage.removeItem(LAST_PLAYERS_KEY));
// 最終更新: 2026-09-10 — 席順の保存と、削除済み・破損データの扱いを確認する。
it("restores the previous four seats", () => {
  const ids = players.slice(0, 4).map((p) => p.id);
  rememberPlayers(ids);
  expect(previousPlayers(players)).toEqual(ids);
});
it("does not restore deleted players or duplicate seats", () => {
  rememberPlayers(["sample01", "sample01", "deleted", "sample02"]);
  expect(previousPlayers(players)).toEqual(["sample01", "", "", "sample02"]);
});
it("ignores malformed saved data", () => {
  window.localStorage.setItem(LAST_PLAYERS_KEY, "bad");
  expect(previousPlayers(players)).toEqual(["", "", "", ""]);
});

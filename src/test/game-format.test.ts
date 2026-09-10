import { it, expect } from "vitest";
import {
  LocalStorageGameRepository,
  STORAGE_KEY,
} from "../data/LocalStorageGameRepository";
import { fixture, MemoryStorage } from "./fixtures";
import { formatInputTime } from "../utils/date";
// 最終更新: 2026-09-10 — 古い形式との互換性と東風の保存・編集を確認する。
it("preserves original input time and game format across edits and reloads", async () => {
  const storage = new MemoryStorage();
  const old = fixture("old", "2026-09-01");
  delete old.format;
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, games: [old] }));
  const repo = new LocalStorageGameRepository(() => storage);
  expect(await repo.getGames()).toHaveLength(1);
  const game = { ...fixture("east", "2026-09-02"), format: "tonpu" as const };
  await repo.addGame(game);
  await repo.updateGame({ ...game, updatedAt: "2026-09-10T12:00:00Z" });
  const saved = (
    await new LocalStorageGameRepository(() => storage).getGames()
  )[1];
  expect(saved.format).toBe("tonpu");
  expect(saved.createdAt).toBe(game.createdAt);
  expect(formatInputTime("2026-09-10T12:34:56Z")).toBe("2026/09/10 21:34:56");
});

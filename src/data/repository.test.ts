import { describe, expect, it, vi } from "vitest";
import {
  LocalStorageGameRepository,
  STORAGE_KEY,
} from "./LocalStorageGameRepository";
import { fixture, MemoryStorage } from "../test/fixtures";

// 最終更新: 2026-09-10 — 初回投入、CRUD、空データ、破損・容量不足時の保全を検証。
describe("LocalStorageGameRepository", () => {
  it("初回だけ48半荘を投入し、別インスタンスで再読込可能", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageGameRepository(() => storage);
    const games = await repository.getGames();
    expect(games).toHaveLength(48);
    const reloaded = new LocalStorageGameRepository(() => storage);
    expect(await reloaded.getGames()).toEqual(games);
  });
  it("追加・編集・削除が永続化され、他の対局は保持される", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageGameRepository(() => storage);
    const game = fixture("new-game", "2026-09-10");
    await repository.addGame(game);
    expect(await repository.getGames()).toHaveLength(49);
    const edited = fixture("new-game", "2026-09-10", [50000, 30000, 20000, 0]);
    await repository.updateGame(edited);
    expect(
      (await repository.getGames()).find((entry) => entry.id === "new-game")
        ?.players[0].rawScore,
    ).toBe(50000);
    await repository.deleteGame("new-game");
    expect(await repository.getGames()).toHaveLength(48);
  });
  it("重複ID追加と存在しない編集を拒否", async () => {
    const repository = new LocalStorageGameRepository(() => newStorage);
    const newStorage = new MemoryStorage();
    const game = fixture("new", "2026-09-10");
    await repository.addGame(game);
    await expect(repository.addGame(game)).rejects.toThrow("すでに");
    await expect(
      repository.updateGame({ ...game, id: "missing" }),
    ).rejects.toThrow("見つかりません");
  });
  it("全件削除した空配列を初回と誤認して再投入しない", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, games: [] }));
    expect(
      await new LocalStorageGameRepository(() => storage).getGames(),
    ).toEqual([]);
  });
  it("破損した元データを上書きせず、明示リセットで復元", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "broken json");
    const repository = new LocalStorageGameRepository(() => storage);
    await expect(repository.getGames()).rejects.toThrow("元のデータは保持");
    expect(storage.getItem(STORAGE_KEY)).toBe("broken json");
    await repository.resetToSample();
    expect(await repository.getGames()).toHaveLength(48);
  });
  it("未知の保存形式、改変された計算値を拒否", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageGameRepository(() => storage);
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, games: [] }));
    await expect(repository.getGames()).rejects.toThrow("形式");
    const game = fixture("tampered", "2026-09-10");
    game.players[0].result = 999;
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, games: [game] }));
    await expect(repository.getGames()).rejects.toThrow("形式");
  });
  it("容量不足時に既存データを保持して失敗を返す", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageGameRepository(() => storage);
    await repository.getGames();
    const saved = storage.getItem(STORAGE_KEY);
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
    await expect(
      repository.addGame(fixture("new", "2026-09-10")),
    ).rejects.toThrow("保存できません");
    expect(storage.getItem(STORAGE_KEY)).toBe(saved);
  });
  it("保存領域自体が使えない場合も操作可能なエラーにする", async () => {
    const repository = new LocalStorageGameRepository(() => {
      throw new Error("SecurityError");
    });
    await expect(repository.getGames()).rejects.toThrow("保存領域");
  });
  it("別タブの変更を購読し解除できる", () => {
    const repository = new LocalStorageGameRepository();
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent("storage", { key: "other-key" }));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

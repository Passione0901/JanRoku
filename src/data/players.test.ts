import { describe, it, expect } from "vitest";
import {
  LocalStoragePlayerRepository,
  PLAYER_STORAGE_KEY,
} from "./PlayerRepository";
import { MemoryStorage } from "../test/fixtures";
describe("member persistence", () => {
  it("preserves defaults and persists stable added identities", async () => {
    const storage = new MemoryStorage();
    const repo = new LocalStoragePlayerRepository(() => storage);
    expect(await repo.getPlayers()).toHaveLength(9);
    const player = await repo.addPlayer("　田中　");
    expect(player.name).toBe("田中");
    expect(
      await new LocalStoragePlayerRepository(() => storage).getPlayers(),
    ).toEqual(expect.arrayContaining([player]));
    expect(await repo.getPlayers()).toHaveLength(10);
  });
  it("rejects duplicate and invalid names", async () => {
    const repo = new LocalStoragePlayerRepository(() => new MemoryStorage());
    for (const name of ["メンバーA", " ", "x".repeat(31), "x\ny"])
      await expect(repo.addPlayer(name)).rejects.toThrow();
    const storage = new MemoryStorage();
    const persistent = new LocalStoragePlayerRepository(() => storage);
    await persistent.addPlayer("Ａｌｉｃｅ");
    await expect(persistent.addPlayer(" alice ")).rejects.toThrow("同じ名前");
  });
  it("preserves corrupted data and reports write failure", async () => {
    const storage = new MemoryStorage();
    storage.setItem(PLAYER_STORAGE_KEY, "broken");
    const repo = new LocalStoragePlayerRepository(() => storage);
    await expect(repo.addPlayer("田中")).rejects.toThrow("読み込めません");
    expect(storage.getItem(PLAYER_STORAGE_KEY)).toBe("broken");
    const fail = new LocalStoragePlayerRepository(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    }));
    await expect(fail.addPlayer("田中")).rejects.toThrow("保存できません");
  });
});

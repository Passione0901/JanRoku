import { beforeEach, expect, it } from "vitest";
import { GitHubStore, TOKEN_STORAGE_KEY } from "./GitHubStore";
import { mergeLocal, type SharedData } from "./sharedData";
import { players } from "../config/players";
import { fixture } from "../test/fixtures";
let data: SharedData;
let revision: number;
let conflict: boolean;
let denied: boolean;
const encode = (value: unknown) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(value))));
const request: typeof fetch = async (_url, init) => {
  if (String(_url).endsWith("/JanRoku"))
    return new Response(JSON.stringify({ permissions: { push: true } }));
  if (init?.method === "PUT") {
    if (denied) return new Response("{}", { status: 403 });
    const body = JSON.parse(init.body as string) as {
      sha: string;
      content: string;
    };
    if (conflict) {
      conflict = false;
      data.players.push({ id: "other", name: "別端末", color: "#123456" });
      revision++;
      return new Response("{}", { status: 409 });
    }
    if (body.sha !== String(revision))
      return new Response("{}", { status: 409 });
    data = JSON.parse(
      decodeURIComponent(escape(atob(body.content))),
    ) as SharedData;
    revision++;
    return new Response(JSON.stringify({ content: { sha: String(revision) } }));
  }
  return new Response(
    JSON.stringify({ sha: String(revision), content: encode(data) }),
  );
};
beforeEach(() => {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  data = { version: 1, players: structuredClone(players), games: [] };
  revision = 1;
  conflict = false;
  denied = false;
});
// 最終更新: 2026-09-10 — 2端末・競合・移行失敗時に共有データが失われないことを確認。
it("syncs member names and colors between two clients", async () => {
  const phone = new GitHubStore(request),
    pc = new GitHubStore(request);
  await phone.connect("test-token");
  const p = await phone.playerRepository.addPlayer("山田");
  expect(await pc.playerRepository.getPlayers()).toContainEqual(p);
});
it("requires authentication before writing", async () => {
  const store = new GitHubStore(request);
  await expect(store.playerRepository.addPlayer("山田")).rejects.toThrow(
    "認証",
  );
  expect(data.players).toHaveLength(9);
});
it("merges a SHA conflict without losing another client change", async () => {
  const store = new GitHubStore(request);
  await store.connect("test-token");
  conflict = true;
  await store.playerRepository.addPlayer("山田");
  expect(data.players.map((p) => p.name)).toEqual(
    expect.arrayContaining(["山田", "別端末"]),
  );
});
it("rejects a duplicate member", async () => {
  const store = new GitHubStore(request);
  await store.connect("test-token");
  await expect(store.playerRepository.addPlayer("メンバーA")).rejects.toThrow(
    "同じ名前",
  );
});
it("reports write failures instead of local success", async () => {
  const store = new GitHubStore(request);
  await store.connect("test-token");
  denied = true;
  await expect(store.playerRepository.addPlayer("山田")).rejects.toThrow(
    "権限",
  );
  expect(data.players).toHaveLength(9);
});
it("syncs add, update and delete while keeping original creation time", async () => {
  const a = new GitHubStore(request),
    b = new GitHubStore(request);
  await a.connect("test-token");
  await a.gameRepository.addGame(fixture("g", "2026-09-10"));
  const [old] = await a.gameRepository.getGames();
  await a.gameRepository.updateGame({
    ...old,
    date: "2026-09-09",
    createdAt: "2020-01-01T00:00:00Z",
  });
  const [updated] = await b.gameRepository.getGames();
  expect(updated.date).toBe("2026-09-09");
  expect(updated.createdAt).toBe(old.createdAt);
  expect(data.games[0].syncRevision).toBeUndefined();
  await a.gameRepository.getGames();
  await a.gameRepository.deleteGame("g");
  await b.refresh();
  expect(await b.gameRepository.getGames()).toHaveLength(0);
});
it("rejects stale edits even after a background refresh", async () => {
  const store = new GitHubStore(request);
  await store.connect("test-token");
  await store.gameRepository.addGame(fixture("g", "2026-09-10"));
  const [old] = await store.gameRepository.getGames();
  data.games[0].date = "2026-09-08";
  revision++;
  await store.refresh();
  await store.gameRepository.getGames();
  await expect(
    store.gameRepository.updateGame({ ...old, date: "2026-09-09" }),
  ).rejects.toThrow("別の端末");
  expect(data.games[0].date).toBe("2026-09-08");
});
it("merges local data once, remapping same names with different IDs", () => {
  const local = {
    version: 1 as const,
    players: [...players, { id: "phone", name: "山田", color: "#123456" }],
    games: [fixture("g", "2026-09-10")],
  };
  data.players.push({ id: "pc", name: "山田", color: "#654321" });
  local.games[0].players[0].playerId = "phone";
  const merged = mergeLocal(data, local);
  expect(merged.players).toHaveLength(10);
  expect(merged.games[0].players[0].playerId).toBe("pc");
  expect(mergeLocal(merged, local)).toEqual(merged);
});
it("aborts conflicting imports without changing shared data", () => {
  data.games = [fixture("g", "2026-09-10")];
  const local = structuredClone(data);
  local.games[0].date = "2026-09-09";
  expect(() => mergeLocal(data, local)).toThrow("競合");
  expect(data.games[0].date).toBe("2026-09-10");
});
it("rejects malformed remote content", async () => {
  data.games = [{ id: "invalid" } as never];
  await expect(new GitHubStore(request).read()).rejects.toThrow("形式");
});
it("deletes an unused member and syncs the removal to another client", async () => {
  const a = new GitHubStore(request),
    b = new GitHubStore(request);
  await a.connect("test-token");
  const player = await a.playerRepository.addPlayer("削除テスト");
  await a.playerRepository.deletePlayer!(player.id);
  expect(
    (await b.playerRepository.getPlayers()).some((p) => p.id === player.id),
  ).toBe(false);
});
it("blocks deleting a member referenced by a game", async () => {
  const store = new GitHubStore(request);
  await store.connect("test-token");
  await store.gameRepository.addGame(fixture("g", "2026-09-10"));
  await expect(store.playerRepository.deletePlayer!("sample01")).rejects.toThrow(
    "対局履歴",
  );
  expect(data.players.some((p) => p.id === "sample01")).toBe(true);
  await store.gameRepository.getGames();
  await store.gameRepository.deleteGame("g");
  await store.playerRepository.deletePlayer!("sample01");
  expect(data.players.some((p) => p.id === "sample01")).toBe(false);
});
it("requires authentication to delete members", async () => {
  await expect(
    new GitHubStore(request).playerRepository.deletePlayer!("sample01"),
  ).rejects.toThrow("認証");
});

it("restores authentication after reopening and forgets it on disconnect", async () => {
  const phone = new GitHubStore(request);
  await phone.connect("saved-test-token");
  expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBe(
    "saved-test-token",
  );
  const reopened = new GitHubStore(request);
  expect(reopened.authenticated).toBe(true);
  reopened.disconnect();
  expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  expect(new GitHubStore(request).authenticated).toBe(false);
});
it("removes an expired token after a 401 response", async () => {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, "expired-test-token");
  const store = new GitHubStore(
    async () => new Response("{}", { status: 401 }),
  );
  await expect(store.read()).rejects.toThrow("期限切れ");
  expect(store.authenticated).toBe(false);
  expect(window.localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
});
it("does not claim success when credential storage fails", async () => {
  const store = new GitHubStore(request, () => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {},
  }));
  await expect(store.connect("test-token")).rejects.toThrow("保存できません");
  expect(store.authenticated).toBe(false);
});

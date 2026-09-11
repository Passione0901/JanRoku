import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EncryptedVault,
  VAULT_STORAGE_KEY,
  type Envelope,
} from "./EncryptedVault";
import { GitHubStore, TOKEN_STORAGE_KEY } from "./GitHubStore";
import {
  groupInfo,
  groupStorageKey,
  ACTIVE_GROUP_KEY,
  type GroupId,
} from "./groups";
import { unlockGroups } from "./unlockGroups";
import { validateShared, type SharedData } from "./sharedData";
import { entryRules } from "../config/rules";
import { rememberPlayers, previousPlayers } from "./lastPlayers";
import { UnlockPage } from "../pages/UnlockPage";
import { fixture } from "../test/fixtures";
import { players } from "../config/players";

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  localStorage.clear();
  window.location.hash = "/";
});
afterEach(() => vi.unstubAllGlobals());
async function setup() {
  const vaults = {
    main: await EncryptedVault.create("test group one", "first secret"),
    second: await EncryptedVault.create("test group two", "second secret"),
  };
  const data: Record<GroupId, SharedData> = {
    main: {
      version: 1,
      players,
      games: [fixture("main-record", "2026-09-09")],
      rules: entryRules,
    },
    second: {
      version: 1,
      players: [],
      games: [],
      rules: { ...entryRules, startingPoints: 30000 },
    },
  };
  const blobs: Record<GroupId, Envelope> = {
    main: await vaults.main.encode(data.main),
    second: await vaults.second.encode(data.second),
  };
  const writes: string[] = [];
  let conflict = false;
  let revision = 1;
  const request = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/JanRoku"))
      return Response.json({ permissions: { push: true } });
    const id: GroupId = url.includes(groupInfo("second").path)
      ? "second"
      : "main";
    if (init?.method === "PUT") {
      writes.push(url);
      if (conflict) {
        conflict = false;
        const latest = await vaults[id].decode(blobs[id]);
        latest.players.push({
          id: "concurrent",
          name: "同時登録",
          color: "#123456",
        });
        blobs[id] = await vaults[id].encode(latest);
        revision++;
        return new Response(null, { status: 409 });
      }
      const body = JSON.parse(String(init.body));
      if (body.sha !== `sha-${revision}`)
        return new Response(null, { status: 409 });
      const value = JSON.parse(Buffer.from(body.content, "base64").toString());
      await vaults[id].decode(value);
      expect(JSON.stringify(value)).not.toContain("追加メンバー");
      blobs[id] = value;
      revision++;
      return Response.json({ content: { sha: `sha-${revision}` } });
    }
    if (url.includes("raw.githubusercontent.com"))
      return Response.json(blobs[id]);
    return Response.json({
      sha: `sha-${revision}`,
      content: Buffer.from(JSON.stringify(blobs[id])).toString("base64"),
    });
  });
  return {
    vaults,
    blobs,
    writes,
    request,
    collide: () => {
      conflict = true;
    },
  };
}

it("2組の鍵・salt・ブラウザー保存を独立させ、別の組の復号を拒否する", async () => {
  const { vaults, blobs } = await setup();
  expect(blobs.main.salt).not.toBe(blobs.second.salt);
  await expect(vaults.main.decode(blobs.second)).rejects.toThrow();
  await expect(
    EncryptedVault.unlock(blobs.second, "test group one", "first secret"),
  ).rejects.toThrow();
  await vaults.main.remember(localStorage);
  const secondKey = groupStorageKey(VAULT_STORAGE_KEY, "second");
  await vaults.second.remember(localStorage, secondKey);
  expect(await EncryptedVault.restore(blobs.main, localStorage)).not.toBeNull();
  expect(
    await EncryptedVault.restore(blobs.second, localStorage, secondKey),
  ).not.toBeNull();
  localStorage.removeItem(secondKey);
  expect(await EncryptedVault.restore(blobs.main, localStorage)).not.toBeNull();
});

it("2組目の追加・削除・ルール保存は既存組の暗号文を一切変更しない", async () => {
  const { vaults, blobs, writes, request } = await setup();
  const original = JSON.stringify(blobs.main);
  const second = new GitHubStore(
    request,
    () => localStorage,
    vaults.second,
    "second",
  );
  await second.connect("test-token");
  const member = await second.playerRepository.addPlayer("追加メンバー");
  await second.mutate((data) => ({
    ...data,
    rules: { ...entryRules, startingPoints: 35000 },
  }));
  await second.playerRepository.deletePlayer!(member.id);
  expect(JSON.stringify(blobs.main)).toBe(original);
  expect((await vaults.second.decode(blobs.second)).rules?.startingPoints).toBe(
    35000,
  );
  expect(writes.every((url) => url.endsWith("data/groups/second.json"))).toBe(
    true,
  );
});

it("同じ対局IDでも2組目の登録・編集・削除は1組目の履歴に触れない", async () => {
  const { vaults, blobs, request } = await setup();
  const original = JSON.stringify(blobs.main);
  const store = new GitHubStore(
    request,
    () => localStorage,
    vaults.second,
    "second",
  );
  await store.connect("test-token");
  await store.mutate((data) => ({
    ...data,
    players: structuredClone(players),
  }));
  await store.gameRepository.addGame(fixture("main-record", "2026-08-06"));
  const [game] = await store.gameRepository.getGames();
  await store.gameRepository.updateGame({ ...game, date: "2026-08-07" });
  const [updated] = await store.gameRepository.getGames();
  expect(updated.date).toBe("2026-08-07");
  await store.gameRepository.deleteGame(updated.id, updated.syncRevision);
  expect(await store.gameRepository.getGames()).toHaveLength(0);
  expect(JSON.stringify(blobs.main)).toBe(original);
});

it("同時保存の競合を再取得して解消し、2組目の両者の追加を残す", async () => {
  const { vaults, blobs, request, collide } = await setup();
  const original = JSON.stringify(blobs.main);
  const store = new GitHubStore(
    request,
    () => localStorage,
    vaults.second,
    "second",
  );
  await store.connect("test-token");
  collide();
  await store.playerRepository.addPlayer("追加メンバー");
  expect(
    (await vaults.second.decode(blobs.second)).players.map((p) => p.name),
  ).toEqual(["同時登録", "追加メンバー"]);
  expect(JSON.stringify(blobs.main)).toBe(original);
});

it("別の組の鍵を組み合わせた書き込みは復号時点で止まり、PUTしない", async () => {
  const { vaults, request, writes } = await setup();
  localStorage.setItem(TOKEN_STORAGE_KEY, "test-token");
  const wrong = new GitHubStore(
    request,
    () => localStorage,
    vaults.main,
    "second",
  );
  await expect(
    wrong.playerRepository.addPlayer("追加メンバー"),
  ).rejects.toThrow();
  expect(writes).toHaveLength(0);
});

it("前回の4人を組ごとに保持し、不正な共有ルールは保存しない", () => {
  const ids = players.slice(0, 4).map((p) => p.id);
  rememberPlayers(ids, "main");
  rememberPlayers([...ids].reverse(), "second");
  expect(previousPlayers(players, "main")).toEqual(ids);
  expect(previousPlayers(players, "second")).toEqual([...ids].reverse());
  expect(() =>
    validateShared({
      version: 1,
      players: [],
      games: [],
      rules: { ...entryRules, startingPoints: -1 },
    }),
  ).toThrow();
});

it("合言葉だけで2組目を開き、選択UIや前の組の名前を表示しない", async () => {
  const { vaults, request } = await setup();
  vi.stubGlobal("fetch", request);
  await vaults.main.remember(localStorage);
  const user = userEvent.setup();
  render(<UnlockPage />);
  await screen.findByRole("heading", { name: "戦績ランキング" });
  await user.click(screen.getByRole("button", { name: "ロック" }));
  expect(screen.queryByRole("combobox")).toBeNull();
  await user.type(screen.getByLabelText("合言葉1"), "test group two");
  await user.type(screen.getByLabelText("合言葉2"), "second secret");
  await user.click(screen.getByRole("button", { name: "戦績を開く" }));
  await screen.findByRole("heading", { name: "戦績ランキング" });
  expect(screen.queryAllByText(players[0].name)).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "麻雀会を切り替え" })).toBeNull();
  expect(screen.queryByText(/麻雀会[12]/)).toBeNull();
  expect(
    localStorage.getItem(groupStorageKey(VAULT_STORAGE_KEY, "second")),
  ).toBeTruthy();
  expect(localStorage.getItem(ACTIVE_GROUP_KEY)).toBe("second");
});

it("合言葉の組に一致した保存先だけを返し、混ぜた合言葉は実記録を開かない", async () => {
  const { blobs } = await setup();
  expect(
    (await unlockGroups(blobs, "test group one", "first secret"))?.id,
  ).toBe("main");
  expect(
    (await unlockGroups(blobs, "test group two", "second secret"))?.id,
  ).toBe("second");
  expect(
    await unlockGroups(blobs, "test group one", "second secret"),
  ).toBeNull();
});

it("2組分の鍵が保存されていても、最後に開いた組だけを自動復元する", async () => {
  const { vaults, request } = await setup();
  vi.stubGlobal("fetch", request);
  await vaults.main.remember(localStorage);
  await vaults.second.remember(
    localStorage,
    groupStorageKey(VAULT_STORAGE_KEY, "second"),
  );
  localStorage.setItem(ACTIVE_GROUP_KEY, "second");
  render(<UnlockPage />);
  await screen.findByRole("heading", { name: "戦績ランキング" });
  expect(screen.queryAllByText(players[0].name)).toHaveLength(0);
  expect(screen.queryByRole("combobox", { name: "麻雀会" })).toBeNull();
});

it("一部の取得に失敗したときは合言葉を誤判定せず、再読み込みを案内する", async () => {
  const { request } = await setup();
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).includes("groups/second.json")
      ? Promise.resolve(new Response(null, { status: 503 }))
      : request(input, init),
  );
  render(<UnlockPage />);
  await screen.findByRole("button", { name: "もう一度読み込む" });
  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "戦績を開く" })).toBeNull();
});

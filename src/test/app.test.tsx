import { LAST_PLAYERS_KEY } from "../data/lastPlayers";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import {
  LocalStorageGameRepository,
  STORAGE_KEY,
} from "../data/LocalStorageGameRepository";
import { fixture, MemoryStorage } from "./fixtures";
import { calculatePlayerStats } from "../domain/stats";

// 最終更新: 2026-09-10 — 保存先だけをメモリに置換し、実コンポーネントを操作して統合検証。
function navigate(route: string) {
  act(() => {
    window.location.hash = route;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
}
async function fillForm(scores = ["400", "300", "200", "100"]) {
  const user = userEvent.setup();
  for (let i = 0; i < 4; i++) {
    await user.selectOptions(
      document.getElementById(`player-${i}`) as HTMLSelectElement,
      ["sample01", "sample02", "sample03", "sample04"][i],
    );
    await user.type(
      document.getElementById(`score-${i}`) as HTMLInputElement,
      scores[i],
    );
  }
  return user;
}
function start(empty = false) {
  const storage = new MemoryStorage();
  if (empty)
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, games: [] }));
  const repository = new LocalStorageGameRepository(() => storage);
  return {
    storage,
    repository,
    view: render(<App gameRepository={repository} />),
  };
}
beforeEach(() => {
  window.localStorage.removeItem(LAST_PLAYERS_KEY);
  window.location.hash = "/";
});
describe("実画面の入力・閲覧・保存", () => {
  it("持ち点と収支は切替表示し、各下書きを保持して直接収支を保存・編集できる", async () => {
    const { repository } = start(true);
    await screen.findByRole("heading", { name: "戦績ランキング" });
    navigate("/input");
    await screen.findByRole("heading", { name: "半荘を記録" });
    await fillForm();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "収支入力" }));
    expect(screen.queryByRole("heading", { name: "今回のルール" })).toBeNull();
    expect((document.getElementById("score-0") as HTMLInputElement).value).toBe(
      "",
    );
    for (const [i, value] of ["35.4", "5", "-15", "-25.4"].entries())
      await user.type(document.getElementById(`score-${i}`)!, value);
    await user.click(screen.getByRole("button", { name: "持ち点入力" }));
    expect((document.getElementById("score-0") as HTMLInputElement).value).toBe(
      "400",
    );
    await user.click(screen.getByRole("button", { name: "収支入力" }));
    expect((document.getElementById("score-0") as HTMLInputElement).value).toBe(
      "35.4",
    );
    await user.click(screen.getByRole("button", { name: "この半荘を登録" }));
    await screen.findByRole("heading", { name: "戦績ランキング" });
    const [g] = await repository.getGames();
    expect(g.inputMode).toBe("results");
    expect(g.players.map((p) => p.result)).toEqual([35.4, 5, -15, -25.4]);
    expect(g.players.every((p) => p.rawScore === null)).toBe(true);
    navigate(`/edit/${g.id}`);
    await screen.findByRole("heading", { name: "半荘を編集" });
    expect(
      screen
        .getByRole("button", { name: "収支入力" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    const first = document.getElementById("score-0")!;
    await user.clear(first);
    await user.type(first, "36.4");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    await user.click(screen.getByRole("button", { name: "この収支で保存" }));
    await screen.findByRole("heading", { name: "戦績ランキング" });
    expect((await repository.getGames())[0].players[0].result).toBe(36.4);
  });
  it("初回48半荘を表示し、9人・並び替え・詳細展開が操作可能", async () => {
    start();
    await screen.findByRole("heading", { name: "戦績ランキング" });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(10);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("並び替え"), "averageRank");
    expect(
      screen.getByRole("button", { name: "昇順。降順に切り替え" }),
    ).toBeTruthy();
    await user.click(within(table).getAllByRole("button")[0]);
    expect(within(table).getByText("最高持ち点")).toBeTruthy();
    expect(within(table).getByText("箱割れ率")).toBeTruthy();
  });
  it("登録→全統計更新→再読み込み→個人詳細→日別表示", async () => {
    const { repository, view } = start(true);
    await screen.findByRole("heading", { name: "戦績ランキング" });
    navigate("/input");
    await screen.findByRole("heading", { name: "半荘を記録" });
    const user = await fillForm();
    expect(screen.getByText("40,000点")).toBeTruthy();
    expect(
      (
        within(document.getElementById("player-1")!).getByRole("option", {
          name: "メンバーA",
        }) as HTMLOptionElement
      ).disabled,
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "この半荘を登録" }));
    await screen.findByRole("heading", { name: "戦績ランキング" });
    expect(await repository.getGames()).toHaveLength(1);
    const stats = calculatePlayerStats("sample01", await repository.getGames());
    expect(stats).toMatchObject({
      gamesPlayed: 1,
      totalResult: 40,
      averageRank: 1,
      rankCounts: [1, 0, 0, 0],
      rankRates: [100, 0, 0, 0],
      topTwoRate: 100,
      bustRate: 0,
      highestRawScore: 40000,
      lowestRawScore: 40000,
      bestDailyResult: 40,
      worstDailyResult: 40,
    });
    expect(stats.recentGames).toHaveLength(1);
    view.unmount();
    render(<App gameRepository={repository} />);
    await screen.findByRole("heading", { name: "戦績ランキング" });
    navigate("/players/sample01");
    await screen.findByRole("heading", { name: "メンバーAの個人戦績" });
    expect(screen.getByRole("img", { name: /累計収支の推移/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /全対局履歴/ })).toBeTruthy();
    navigate("/daily");
    await screen.findByRole("heading", { name: "日別の記録" });
    expect(screen.getByText("第1戦")).toBeTruthy();
  });
  it("空欄で登録できず、不一致はキャンセルか明示承認が必要", async () => {
    const { repository } = start(true);
    await screen.findByRole("heading", { name: "戦績ランキング" });
    navigate("/input");
    await screen.findByRole("heading", { name: "半荘を記録" });
    await userEvent.click(
      screen.getByRole("button", { name: "この半荘を登録" }),
    );
    expect(screen.getByRole("alert").textContent).toContain("4人選択");
    const user = await fillForm(["401", "300", "200", "100"]);
    await user.click(screen.getByRole("button", { name: "この半荘を登録" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("100,100点");
    await user.click(
      within(dialog).getByRole("button", { name: "キャンセル" }),
    );
    expect(await repository.getGames()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "この半荘を登録" }));
    await user.click(screen.getByRole("button", { name: "この点数で保存" }));
    await screen.findByRole("heading", { name: "戦績ランキング" });
    expect((await repository.getGames())[0].totalMismatchAccepted).toBe(true);
  });
  it("マイナス切替と保存失敗時の入力保持", async () => {
    const { repository } = start(true);
    await screen.findByRole("heading", { name: "戦績ランキング" });
    navigate("/input");
    await screen.findByRole("heading", { name: "半荘を記録" });
    const user = await fillForm(["12", "412", "350", "250"]);
    await user.click(
      screen.getByRole("button", {
        name: "1人目の点数のプラス・マイナスを切り替え",
      }),
    );
    expect(screen.getByText("-1,200点")).toBeTruthy();
    vi.spyOn(repository, "addGame").mockRejectedValueOnce(
      new Error("保存できませんでした。"),
    );
    await user.click(screen.getByRole("button", { name: "この半荘を登録" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((document.getElementById("score-0") as HTMLInputElement).value).toBe(
      "-12",
    );
    expect(await repository.getGames()).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "この半荘を登録" }));
    await screen.findByRole("heading", { name: "戦績ランキング" });
    expect(
      calculatePlayerStats("sample01", await repository.getGames()).bustRate,
    ).toBe(100);
  });
  it("編集して再集計し、確認後の削除で空状態になる", async () => {
    const { repository } = start(true);
    await repository.addGame(fixture("editable", "2026-09-10"));
    await screen.findByRole("heading", { name: "戦績ランキング" });
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    await waitFor(() =>
      expect(screen.getAllByText("+40.0").length).toBeGreaterThan(0),
    );
    navigate("/edit/editable");
    await screen.findByRole("heading", { name: "半荘を編集" });
    const user = userEvent.setup();
    await user.clear(document.getElementById("score-0") as HTMLInputElement);
    await user.type(
      document.getElementById("score-0") as HTMLInputElement,
      "500",
    );
    await user.clear(document.getElementById("score-3") as HTMLInputElement);
    await user.type(
      document.getElementById("score-3") as HTMLInputElement,
      "0",
    );
    await user.click(screen.getByRole("button", { name: "変更を保存" }));
    await screen.findByRole("heading", { name: "戦績ランキング" });
    expect(
      calculatePlayerStats("sample01", await repository.getGames()).totalResult,
    ).toBe(50);
    navigate("/history");
    await screen.findByRole("heading", { name: "対局履歴" });
    await user.click(screen.getByRole("button", { name: "記録 1を削除" }));
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(await repository.getGames()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "記録 1を削除" }));
    await user.click(screen.getByRole("button", { name: "削除する" }));
    await screen.findByText("まだ対局がありません。");
    expect(await repository.getGames()).toHaveLength(0);
  });
  it("サンプル初期化は確認が必要で、確定後48半荘に復元", async () => {
    const { repository } = start(true);
    await screen.findByRole("heading", { name: "戦績ランキング" });
    navigate("/settings");
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "サンプルデータに戻す" }),
    );
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(await repository.getGames()).toHaveLength(0);
    await user.click(
      screen.getByRole("button", { name: "サンプルデータに戻す" }),
    );
    await user.click(
      screen.getByRole("button", { name: "48半荘のサンプルに戻す" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await repository.getGames()).toHaveLength(48);
  });
  it("破損データでも設定画面から復旧できる", async () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "broken");
    const repository = new LocalStorageGameRepository(() => storage);
    render(<App gameRepository={repository} />);
    await screen.findByRole("alert");
    await userEvent.click(
      screen.getByRole("link", { name: "データ設定を開く" }),
    );
    await screen.findByRole("heading", { name: "ルール・データ設定" });
    await userEvent.click(
      screen.getByRole("button", { name: "サンプルデータに戻す" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "48半荘のサンプルに戻す" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await repository.getGames()).toHaveLength(48);
  });
});

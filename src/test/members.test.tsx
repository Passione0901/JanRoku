import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect } from "vitest";
import App from "../App";
import { LocalStoragePlayerRepository } from "../data/PlayerRepository";
import { LocalStorageGameRepository } from "../data/LocalStorageGameRepository";
import { MemoryStorage } from "./fixtures";
// 最終更新: 2026-09-10 — 追加から画面間反映・再読込まで実UIで確認する。
it("adds a member without changing games and exposes them in input and rankings", async () => {
  window.location.hash = "/members";
  const playerRepository = new LocalStoragePlayerRepository(
    () => playerStorage,
  );
  const playerStorage = new MemoryStorage();
  const gameStorage = new MemoryStorage();
  const gameRepository = new LocalStorageGameRepository(() => gameStorage);
  const before = await gameRepository.getGames();
  const app = (
    <App gameRepository={gameRepository} playerRepository={playerRepository} />
  );
  const view = render(app);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("メンバー名"), "田中");
  await user.click(screen.getByRole("button", { name: "メンバーを追加" }));
  expect(
    await screen.findByText("田中さんを追加しました。対局入力で選択できます。"),
  ).toBeTruthy();
  expect(await gameRepository.getGames()).toEqual(before);
  const added = (await playerRepository.getPlayers()).find(
    (p) => p.name === "田中",
  )!;
  act(() => {
    window.location.hash = "/input";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  const select = document.getElementById("player-0") as HTMLSelectElement;
  expect(
    (within(select).getByRole("option", { name: "田中" }) as HTMLOptionElement)
      .value,
  ).toBe(added.id);
  act(() => {
    window.location.hash = "/";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  expect((await screen.findAllByText("田中")).length).toBeGreaterThan(0);
  view.unmount();
  render(app);
  expect((await screen.findAllByText("田中")).length).toBeGreaterThan(0);
});

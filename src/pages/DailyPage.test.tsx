import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DailyPage } from "./DailyPage";
import { PlayersProvider } from "../hooks/usePlayers";
import { players } from "../config/players";
import { fixture } from "../test/fixtures";
import { calculateDailySummaries } from "../domain/stats";

vi.mock("./DailyNewsPage", () => ({
  default: () => <h1>テスト用ニュース</h1>,
}));
const games = [fixture("g", "2026-09-12")];
const repo = { getPlayers: async () => players, addPlayer: vi.fn() };
const props = {
  days: calculateDailySummaries(games),
  selectedDate: "2026-09-12",
  onDelete: vi.fn(),
  busy: false,
  games,
  newsEnabled: true,
};
afterEach(() => vi.useRealTimers());

// 最終更新: 2026-09-12 — 当日のボタンと直接URLを公開し、未来日だけ午前0時を待つ。
it("reveals the adjacent news link when the event day starts without reload", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T23:59:59+09:00"));
  render(
    <PlayersProvider repository={repo}>
      <DailyPage {...props} />
    </PlayersProvider>,
  );
  await act(async () => {});
  expect(screen.queryByRole("link", { name: "ニュース" })).toBeNull();
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  expect(
    screen.getByRole("link", { name: "ニュース" }).getAttribute("href"),
  ).toBe("#/daily/2026-09-12/news");
});
it("opens direct links during the event day and still blocks preview data", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-12T23:00:00+09:00"));
  const view = render(
    <PlayersProvider repository={repo}>
      <DailyPage {...props} newsRequested />
    </PlayersProvider>,
  );
  await act(async () => {});
  expect(screen.getByText("テスト用ニュース")).toBeTruthy();
  vi.setSystemTime(new Date("2026-09-13T01:00:00+09:00"));
  view.rerender(
    <PlayersProvider repository={repo}>
      <DailyPage {...props} newsRequested newsEnabled={false} />
    </PlayersProvider>,
  );
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(screen.queryByText("テスト用ニュース")).toBeNull();
  expect(
    screen.getByText("ニュースは実際の記録から閲覧できます。"),
  ).toBeTruthy();
});

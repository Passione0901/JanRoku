import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { StatsDetails } from "./StatsDetails";
import { calculatePlayerStats } from "../domain/stats";
import { fixture } from "../test/fixtures";
// 最終更新: 2026-09-11 — 日別合計の最高・最低の日付と、日内の対局収支を別々に表示する。
it("最高・最低の日付を残し、選択日の各対局の最高・最低も表示する", async () => {
  const games = [
    ["2026-09-10", 40],
    ["2026-09-10", -10],
    ["2026-09-11", 5],
  ].map(([date, value], i) => {
    const game = fixture(String(i), String(date));
    game.players[0].result = Number(value);
    return game;
  });
  render(
    <StatsDetails
      stats={calculatePlayerStats("sample01", games)}
      showRecent={false}
    />,
  );
  expect(screen.getByText("最高の1日").nextElementSibling?.textContent).toBe(
    "2026/09/10",
  );
  expect(screen.getByText("最低の1日").nextElementSibling?.textContent).toBe(
    "2026/09/11",
  );
  expect(
    screen.getByText("その日の最高収支").nextElementSibling?.textContent,
  ).toBe("+5.0 pt");
  expect(screen.queryByText("その日の最低収支")).toBeNull();
  await userEvent.selectOptions(screen.getByLabelText("対局日"), "2026-09-10");
  expect(
    screen.getByText("その日の最高収支").nextElementSibling?.textContent,
  ).toBe("+40.0 pt");
  expect(
    screen.getByText("その日の最低収支").nextElementSibling?.textContent,
  ).toBe("-10.0 pt");
  expect(screen.getByText("最低の1日").nextElementSibling?.textContent).toBe(
    "2026/09/11",
  );
});

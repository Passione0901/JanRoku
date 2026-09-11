import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { DailyResultRange } from "./DailyResultRange";
import { dailyResultRanges } from "../domain/dailyResultRanges";
import { calculatePlayerStats } from "../domain/stats";
import { fixture } from "../test/fixtures";
function history(rows: [string, number][]) {
  return calculatePlayerStats(
    "sample01",
    rows.map(([date, value], i) => {
      const game = fixture(String(i), date);
      game.players[0].result = value;
      return game;
    }),
  ).history;
}
// 最終更新: 2026-09-11 — 合計値との混同、1対局、負数・ゼロ、日付切替を検証する。
it("日別合計でなく、その日の各対局の最大・最小を返す", () => {
  expect(
    dailyResultRanges(
      history([
        ["2026-09-10", 20],
        ["2026-09-10", -10],
        ["2026-09-10", 30],
        ["2026-09-11", -5],
      ]),
    ),
  ).toEqual([
    { date: "2026-09-11", gamesPlayed: 1, highest: -5, lowest: null },
    { date: "2026-09-10", gamesPlayed: 3, highest: 30, lowest: -10 },
  ]);
});
it("全敗・ゼロも0へ補正せず比較する", () => {
  expect(
    dailyResultRanges(
      history([
        ["2026-09-10", -5],
        ["2026-09-10", -20],
      ]),
    )[0],
  ).toMatchObject({ highest: -5, lowest: -20 });
  expect(
    dailyResultRanges(
      history([
        ["2026-09-10", 0],
        ["2026-09-10", 10],
      ]),
    )[0],
  ).toMatchObject({ highest: 10, lowest: 0 });
  expect(dailyResultRanges([])).toEqual([]);
});
it("1対局は最高だけ表示し、日付を変えるとその日の両方を表示する", async () => {
  const user = userEvent.setup();
  render(
    <DailyResultRange
      history={history([
        ["2026-09-10", 20],
        ["2026-09-10", -10],
        ["2026-09-11", -5],
      ])}
    />,
  );
  expect(
    screen.getByText("その日の最高収支").nextElementSibling?.textContent,
  ).toBe("-5.0 pt");
  expect(screen.queryByText("その日の最低収支")).toBeNull();
  await user.selectOptions(screen.getByLabelText("対局日"), "2026-09-10");
  expect(
    screen.getByText("その日の最高収支").nextElementSibling?.textContent,
  ).toBe("+20.0 pt");
  expect(
    screen.getByText("その日の最低収支").nextElementSibling?.textContent,
  ).toBe("-10.0 pt");
});
it("選択した日の記録が消えたら残った日へ切り替える", async () => {
  const rows = history([
    ["2026-09-10", 20],
    ["2026-09-11", 10],
  ]);
  const view = render(<DailyResultRange history={rows} />);
  await userEvent.selectOptions(screen.getByLabelText("対局日"), "2026-09-10");
  view.rerender(
    <DailyResultRange
      history={rows.filter((row) => row.date !== "2026-09-10")}
    />,
  );
  expect((screen.getByLabelText("対局日") as HTMLSelectElement).value).toBe(
    "2026-09-11",
  );
});

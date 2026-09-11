import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { StatsDetails } from "./StatsDetails";
import { calculatePlayerStats } from "../domain/stats";
import { fixture } from "../test/fixtures";

// 最終更新: 2026-09-11 — 1日分は当日の合計、複数日は最高・最低として表示する。
it("同日の複数対局でも日付と収支を一組だけ表示する", () => {
  const stats = calculatePlayerStats("sample01", [
    fixture("a", "2026-09-10"),
    fixture("b", "2026-09-10"),
  ]);
  render(<StatsDetails stats={stats} showRecent={false} />);
  expect(screen.getByText("その日の収支").nextElementSibling?.textContent).toBe(
    `+${stats.totalResult.toFixed(1)}`,
  );
  expect(screen.getAllByText("2026/09/10")).toHaveLength(1);
  expect(screen.queryByText("1日の最低収支")).toBeNull();
  expect(screen.queryByText("1日の最高収支")).toBeNull();
});
it("複数日なら最高と最低を表示する", () => {
  render(
    <StatsDetails
      stats={calculatePlayerStats("sample01", [
        fixture("a", "2026-09-10"),
        fixture("b", "2026-09-11"),
      ])}
      showRecent={false}
    />,
  );
  expect(screen.getByText("1日の最低収支")).toBeTruthy();
  expect(screen.getByText("1日の最高収支")).toBeTruthy();
  expect(screen.queryByText("その日の収支")).toBeNull();
});
it("未対局は日付を生成せず未記録の表示を保つ", () => {
  render(
    <StatsDetails
      stats={calculatePlayerStats("sample01", [])}
      showRecent={false}
    />,
  );
  expect(
    screen.getByText("1日の最高収支").nextElementSibling?.textContent,
  ).toBe("—");
  expect(screen.queryByText("その日の収支")).toBeNull();
});

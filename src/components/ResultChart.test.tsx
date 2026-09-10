import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { ResultChart } from "./ResultChart";
import { calculatePlayerStats } from "../domain/stats";
import { fixture } from "../test/fixtures";
// 最終更新: 2026-09-10 — 日付順の描画と対局選択を確認する。
it("plots older games to the left and shows selected results", () => {
  const stats = calculatePlayerStats("sample01", [
    fixture("new", "2026-09-10"),
    fixture("old", "2026-09-01"),
  ]);
  render(<ResultChart history={stats.history} />);
  const points = screen.getAllByRole("button", { name: /戦目/ });
  expect(points[0].getAttribute("aria-label")).toContain("2026/09/01");
  expect(Number(points[0].getAttribute("cx"))).toBeLessThan(
    Number(points[1].getAttribute("cx")),
  );
  fireEvent.click(points[0]);
  expect(screen.getByRole("status").textContent).toContain("2026/09/01");
});
it("explains an empty history", () => {
  render(<ResultChart history={[]} />);
  expect(
    screen.getByText("対局を登録すると、累計収支の推移が表示されます。"),
  ).toBeTruthy();
});

it("zooms horizontally, reveals dated ticks, and resets", () => {
  const history = calculatePlayerStats(
    "sample01",
    Array.from({ length: 20 }, (_, i) =>
      fixture(`g${i}`, `2026-09-${String(i + 1).padStart(2, "0")}`),
    ),
  ).history;
  const { container } = render(<ResultChart history={history} />);
  const svg = screen.getByRole("img");
  const datesBefore = container.querySelectorAll("svg text").length;
  fireEvent.click(screen.getByRole("button", { name: "グラフを拡大" }));
  expect(svg.getAttribute("viewBox")).toBe("0 0 1520 280");
  expect(container.querySelectorAll("svg text").length).toBeGreaterThan(
    datesBefore,
  );
  expect(screen.getByText("2026/09/20")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "表示をリセット" }));
  expect(svg.getAttribute("viewBox")).toBe("0 0 760 280");
});

import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect } from "vitest";
import { PlayersProvider } from "../hooks/usePlayers";
import { LocalStoragePlayerRepository } from "../data/PlayerRepository";
import { MemoryStorage, fixture } from "../test/fixtures";
import { calculatePlayerStats } from "../domain/stats";
import { PlayerCharts } from "./PlayerCharts";

// 最終更新: 2026-09-12 — 複数選択、全解除、非表示の詳細、比較軸と拡大率の維持を確認する。
it("shows checked members together and preserves the comparison when toggled", async () => {
  const storage = new MemoryStorage();
  const stats = ["sample01", "sample02"].map((id) =>
    calculatePlayerStats(id, [fixture("g", "2026-09-10")]),
  );
  const { container } = render(
    <PlayersProvider
      repository={new LocalStoragePlayerRepository(() => storage)}
    >
      <PlayerCharts stats={stats} />
    </PlayersProvider>,
  );
  const first = await screen.findByRole("checkbox", { name: "メンバーA" });
  const second = screen.getByRole("checkbox", { name: "メンバーB" });
  expect((first as HTMLInputElement).checked).toBe(true);
  expect((second as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(container.querySelector('path[stroke="#d6b773"]')).toBeTruthy();
  expect(container.querySelector('path[stroke="#a6b8df"]')).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "グラフを拡大" }));
  const secondPath = container
    .querySelector('path[stroke="#a6b8df"]')!
    .getAttribute("d");
  fireEvent.click(screen.getByRole("button", { name: /メンバーA ·/ }));
  expect(screen.getByRole("status").textContent).toContain("メンバーA");
  fireEvent.click(first);
  expect(container.querySelector('path[stroke="#d6b773"]')).toBeNull();
  expect(
    container.querySelector('path[stroke="#a6b8df"]')!.getAttribute("d"),
  ).toBe(secondPath);
  expect(screen.getByText("2倍")).toBeTruthy();
  expect(screen.getByRole("status").textContent).not.toContain("メンバーA");
  expect(container.querySelector(".chart-legend")!.textContent).not.toContain(
    "メンバーA",
  );
  fireEvent.click(screen.getByRole("button", { name: "全員解除" }));
  expect(container.querySelector('svg[role="img"]')).toBeNull();
  expect(
    screen.getByText("表示するメンバーにチェックを入れてください。"),
  ).toBeTruthy();
  fireEvent.click(second);
  expect(container.querySelector('path[stroke="#a6b8df"]')).toBeTruthy();
  expect(container.querySelector('path[stroke="#d6b773"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "全員選択" }));
  expect(container.querySelector('path[stroke="#d6b773"]')).toBeTruthy();
  expect(container.querySelector('path[stroke="#a6b8df"]')).toBeTruthy();
});

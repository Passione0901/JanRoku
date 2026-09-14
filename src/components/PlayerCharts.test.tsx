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
  expect(container.querySelector('path[data-player-id="sample01"]')).toBeTruthy();
  expect(container.querySelector('path[data-player-id="sample02"]')).toBeTruthy();
  fireEvent.mouseMove(container.querySelector('path[data-player-id="sample01"]')!, { clientX: 120, clientY: 180 });
  expect(screen.getByRole('tooltip').textContent).toBe('メンバーA');
  fireEvent.mouseLeave(container.querySelector('path[data-player-id="sample01"]')!.parentElement!);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "グラフを拡大" }));
  const secondPath = container
    .querySelector('path[data-player-id="sample02"]')!
    .getAttribute("d");
  fireEvent.click(screen.getByRole("button", { name: /メンバーA ·/ }));
  expect(screen.getByRole("status").textContent).toContain("メンバーA");
  fireEvent.click(first);
  expect(container.querySelector('path[data-player-id="sample01"]')).toBeNull();
  expect(
    container.querySelector('path[data-player-id="sample02"]')!.getAttribute("d"),
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
  expect(container.querySelector('path[data-player-id="sample02"]')).toBeTruthy();
  expect(container.querySelector('path[data-player-id="sample01"]')).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "全員選択" }));
  expect(container.querySelector('path[data-player-id="sample01"]')).toBeTruthy();
  expect(container.querySelector('path[data-player-id="sample02"]')).toBeTruthy();
});
it('starts each line at the first game the player actually joined', async () => {
  const early = fixture('early', '2026-09-01');
  early.players[1].playerId = 'sample05';
  const late = fixture('late', '2026-09-02');
  const stats = ['sample01', 'sample02'].map(id => calculatePlayerStats(id, [early, late]));
  const { container } = render(<PlayersProvider repository={new LocalStoragePlayerRepository(() => new MemoryStorage())}><PlayerCharts stats={stats}/></PlayersProvider>);
  await screen.findByRole('checkbox', { name: 'メンバーB' });
  const firstPoint = screen.getByRole('button', { name: /メンバーB ·/ });
  const path = container.querySelector('path[data-player-id="sample02"]')!;
  expect(path.getAttribute('d')).toBe(`M${firstPoint.getAttribute('cx')},${firstPoint.getAttribute('cy')}`);
  expect(Number(firstPoint.getAttribute('cx'))).toBeGreaterThan(Number(screen.getAllByRole('button', { name: /メンバーA ·/ })[0].getAttribute('cx')));
});

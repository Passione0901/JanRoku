import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { CompatibilityPanel } from "./CompatibilityPanel";
import { PlayersProvider } from "../hooks/usePlayers";
import { players } from "../config/players";
// 最終更新: 2026-09-11 — 相手へのリンクと判定の根拠を表示し、該当なしではメンバーを並べない。
it("相性のある相手だけ表示し、個人戦績へのリンクと収支を付ける", async () => {
  render(
    <PlayersProvider
      repository={{
        getPlayers: async () => players,
        addPlayer: async () => players[0],
      }}
    >
      <CompatibilityPanel
        entries={[
          {
            playerId: players[1].id,
            gamesPlayed: 7,
            totalResult: 140,
            averageResult: 20,
            difference: 10,
            rating: "good",
          },
        ]}
      />
    </PlayersProvider>,
  );
  expect(await screen.findByText("相性が良い")).toBeTruthy();
  expect(screen.getByRole("link").getAttribute("href")).toBe(
    `#/players/${players[1].id}`,
  );
  expect(screen.getByText("同卓 7戦")).toBeTruthy();
  expect(screen.getByText("+20.0")).toBeTruthy();
  expect(screen.queryByText(players[0].name)).toBeNull();
});
it("相性に目立った傾向がない時には相手を表示しない", () => {
  render(<CompatibilityPanel entries={[]} />);
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(
    screen.getByText("現時点では、相性に目立った傾向がある相手はいません。"),
  ).toBeTruthy();
});

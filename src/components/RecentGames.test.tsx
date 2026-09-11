import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlayerGame } from "../domain/types";
import { RecentGames } from "./RecentGames";

const games: PlayerGame[] = [
  {
    gameId: "old",
    playerId: "test",
    date: "2026-08-06",
    createdAt: "2026-08-06T12:00:00Z",
    rank: 4,
    result: -25,
    rawScore: 15000,
    cumulativeResult: -25,
    busted: false,
  },
  {
    gameId: "new",
    playerId: "test",
    date: "2026-09-09",
    createdAt: "2026-09-09T12:00:00Z",
    rank: 1,
    result: 45,
    rawScore: 45000,
    cumulativeResult: 20,
    busted: false,
  },
];
it("古い対局から並べ、初期表示は最新の詳細。タップで過去の収支も読める", async () => {
  const user = userEvent.setup();
  const { container } = render(<RecentGames games={games} />);
  const buttons = screen.getAllByRole("button");
  expect(buttons[0].getAttribute("aria-label")).toBe(
    "2026/08/06 · 4位 · -25.0pt",
  );
  expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
  expect(container.querySelector("time")?.dateTime).toBe("2026-09-09");
  await user.click(buttons[0]);
  expect(container.querySelector("time")?.dateTime).toBe("2026-08-06");
  expect(
    container.querySelector(".recent-form__detail")?.textContent,
  ).toContain("-25.0pt");
  await user.tab();
  expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
});
it("選択した対局が消えたら最新に戻り、1戦・0戦でも壊れない", async () => {
  const user = userEvent.setup();
  const { rerender, container } = render(<RecentGames games={games} />);
  await user.click(screen.getAllByRole("button")[0]);
  rerender(<RecentGames games={[games[1]]} />);
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(container.querySelector("time")?.dateTime).toBe("2026-09-09");
  rerender(<RecentGames games={[]} />);
  expect(screen.getByText("まだ対局がありません")).toBeTruthy();
});

import { expect, it } from "vitest";
import { calculateCompatibility } from "./compatibility";
import { calculatePlayerStats } from "./stats";
import { fixture } from "../test/fixtures";
import type { Rank } from "./types";
// 最終更新: 2026-09-11 — 収支でなく順位を使い、同卓の分母と5段階の境界を検証する。
function games(wins: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const game = fixture(String(i), "2026-09-11");
    game.players[0].rank = (i < wins ? 2 : 3) as Rank;
    game.players[1].rank = (i < wins ? 3 : 2) as Rank;
    game.players[2].rank = 1;
    game.players[3].rank = 4;
    return game;
  });
}
function against(wins: number, count: number) {
  return calculateCompatibility("sample01", games(wins, count)).find(
    (x) => x.playerId === "sample02",
  );
}
it("5回同卓して3回上位なら60%と判定する", () => {
  const row = calculatePlayerStats("sample01", games(3, 5)).compatibility.find(
    (x) => x.playerId === "sample02",
  );
  expect(row).toMatchObject({
    gamesPlayed: 5,
    wins: 3,
    winRate: 60,
    rating: "slightlyGood",
  });
  expect(
    calculateCompatibility("sample02", games(3, 5)).find(
      (x) => x.playerId === "sample01",
    ),
  ).toMatchObject({ wins: 2, winRate: 40, rating: "slightlyBad" });
});
it("70・55・45・30%の境界と普通を区別する", () => {
  for (const [wins, rating] of [
    [14, "good"],
    [13, "slightlyGood"],
    [11, "slightlyGood"],
    [10, null],
    [9, "slightlyBad"],
    [7, "slightlyBad"],
    [6, "bad"],
  ] as const) {
    expect(against(wins, 20)?.rating ?? null).toBe(rating);
  }
});
it("対局数不足は非表示、3・4戦では強い判定をしない", () => {
  expect(against(2, 2)).toBeUndefined();
  expect(against(3, 3)?.rating).toBe("slightlyGood");
  expect(against(0, 4)?.rating).toBe("slightlyBad");
  expect(against(5, 5)?.rating).toBe("good");
  expect(against(0, 5)?.rating).toBe("bad");
});
it("別卓と自分を除外し、収支変更に影響されない", () => {
  const source = games(4, 5),
    changed = structuredClone(source);
  changed.forEach((g) => g.players.forEach((p) => (p.result = -999)));
  const other = fixture("other", "2026-09-11");
  other.players[0].playerId = "other";
  expect(calculateCompatibility("sample01", [...changed, other])).toEqual(
    calculateCompatibility("sample01", source),
  );
  expect(
    calculateCompatibility("sample01", source).some(
      (x) => x.playerId === "sample01",
    ),
  ).toBe(false);
  expect(calculateCompatibility("absent", source)).toEqual([]);
});
it("同順位は上回った回数に含めず、削除・順位編集を再集計する", () => {
  const source = games(4, 5);
  source[0].players[1].rank = source[0].players[0].rank;
  expect(
    calculateCompatibility("sample01", source).find(
      (x) => x.playerId === "sample02",
    ),
  ).toMatchObject({ gamesPlayed: 5, wins: 3, winRate: 60 });
  expect(calculateCompatibility("sample01", source.slice(0, 2))).toEqual([]);
  source[0].players[1].rank = 4;
  expect(
    calculateCompatibility("sample01", source).find(
      (x) => x.playerId === "sample02",
    ),
  ).toMatchObject({ wins: 4, winRate: 80, rating: "good" });
});

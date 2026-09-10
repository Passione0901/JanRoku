import { describe, it, expect } from "vitest";
import { calculateCompatibility } from "./compatibility";
import { calculatePlayerStats } from "./stats";
import { fixture } from "../test/fixtures";

// 最終更新: 2026-09-11 — 同卓条件・通常範囲・少数対局・更新後の再集計を確認する。
function group(opponent: string, value: number, count = 5) {
  return Array.from({ length: count }, (_, i) => {
    const game = fixture(`${opponent}-${i}`, "2026-09-10");
    game.inputMode = "results";
    game.players.forEach((p, index) => {
      p.rawScore = null;
      p.result = index === 0 ? value : index === 1 ? -value : 0;
    });
    game.players[1].playerId = opponent;
    return game;
  });
}
describe("同卓相性", () => {
  it("本人の収支を使い、通常範囲と自分自身を表示しない", () => {
    const games = [
      ...group("good", 20),
      ...group("bad", -20),
      ...group("normal", 0),
    ];
    const result = calculatePlayerStats("sample01", games).compatibility;
    expect(result.map((x) => x.playerId).sort()).toEqual(["bad", "good"]);
    expect(result.find((x) => x.playerId === "good")).toMatchObject({
      rating: "good",
      gamesPlayed: 5,
      averageResult: 20,
      difference: 20,
      totalResult: 100,
    });
    expect(result.find((x) => x.playerId === "bad")).toMatchObject({
      rating: "bad",
      averageResult: -20,
    });
  });
  it("5戦と5pt差を境界にし、表示用丸めでは判定しない", () => {
    expect(
      calculateCompatibility("sample01", [...group("a", 5), ...group("b", -5)]),
    ).toHaveLength(2);
    expect(
      calculateCompatibility("sample01", [
        ...group("a", 4.9),
        ...group("b", -4.9),
      ]),
    ).toEqual([]);
    expect(
      calculateCompatibility("sample01", [
        ...group("a", 50, 4),
        ...group("b", -50, 4),
      ]),
    ).toEqual([]);
  });
  it("全体より高くても赤字なら良い相性とは判定しない", () => {
    const result = calculateCompatibility("sample01", [
      ...group("a", -5),
      ...group("b", -25),
    ]);
    expect(result.map((x) => x.playerId)).toEqual(["b"]);
  });
  it("同じ相手とだけ対局している場合と未対局は表示しない", () => {
    expect(calculateCompatibility("sample01", group("a", 30))).toEqual([]);
    expect(calculateCompatibility("absent", group("a", 30))).toEqual([]);
    expect(calculateCompatibility("sample01", [])).toEqual([]);
  });
  it("別卓は集計せず、削除すると対局数と判定も変わる", () => {
    const games = [...group("a", 20), ...group("b", -20)];
    const other = fixture("other", "2026-09-10");
    other.players[0].playerId = "other";
    expect(calculateCompatibility("sample01", [...games, other])).toEqual(
      calculateCompatibility("sample01", games),
    );
    expect(
      calculateCompatibility("sample01", games.slice(1)).some(
        (x) => x.playerId === "a",
      ),
    ).toBe(false);
  });
});

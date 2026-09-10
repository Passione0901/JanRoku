import { describe, expect, it } from "vitest";
import {
  calculateDailySummaries,
  calculatePlayerStats,
  sortPlayerStats,
  sortOptions,
} from "./stats";

import { fixture, statFixtures } from "../test/fixtures";
import { generateSampleGames } from "../data/sampleGames";
import { players } from "../config/players";

// 最終更新: 2026-09-10 — 指定された全統計を手計算の期待値で検証。
describe("戦績集計", () => {
  const stats = calculatePlayerStats("sample01", statFixtures());
  it("回数と累計収支", () => {
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.totalResult).toBe(48.8);
  });
  it("平均順位と各順位回数", () => {
    expect(stats.averageRank).toBe(2);
    expect(stats.rankCounts).toEqual([2, 0, 0, 1]);
  });
  it("各順位率、連対率、箱割れ率", () => {
    expect(stats.rankRates[0]).toBeCloseTo(200 / 3);
    expect(stats.rankRates[1]).toBe(0);
    expect(stats.rankRates[2]).toBe(0);
    expect(stats.rankRates[3]).toBeCloseTo(100 / 3);
    expect(stats.topTwoRate).toBeCloseTo(200 / 3);
    expect(stats.bustRate).toBeCloseTo(100 / 3);
  });
  it("半荘の最高・最低は収支でなく素点", () => {
    expect(stats.highestRawScore).toBe(50000);
    expect(stats.lowestRawScore).toBe(-1200);
  });
  it("同日全半荘を合算した最高の日・最低の日", () => {
    expect(stats.bestDay).toBe("2026-09-10");
    expect(stats.bestDailyResult).toBe(50);
    expect(stats.worstDay).toBe("2026-09-09");
    expect(stats.worstDailyResult).toBe(-1.2);
  });
  it("日別結果を全参加者分返す", () => {
    const days = calculateDailySummaries(statFixtures());
    expect(days).toHaveLength(2);
    expect(days[1].games).toHaveLength(2);
    expect(
      days[1].results.find((entry) => entry.playerId === "sample01"),
    ).toMatchObject({ gamesPlayed: 2, totalResult: -1.2 });
    for (const day of days)
      expect(
        day.results.reduce(
          (sum, entry) => sum + Math.round(entry.totalResult * 10),
          0,
        ),
      ).toBe(0);
  });
  it("累計推移と直近10戦は古い順で、入力配列の順序に依存しない", () => {
    const reordered = calculatePlayerStats("sample01", statFixtures().reverse());
    expect(reordered.history.map((game) => game.cumulativeResult)).toEqual([
      40, -1.2, 48.8,
    ]);
    expect(reordered.recentGames.map((game) => game.gameId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
  it("直近10戦は自分が参加した最新10戦に限定", () => {
    const games = Array.from({ length: 12 }, (_, i) => ({
      ...fixture(`g-${i}`, "2026-09-10"),
      createdAt: `2026-09-10T${String(i).padStart(2, "0")}:00:00Z`,
    }));
    const other = fixture("other", "2026-09-11");
    other.players[0].playerId = "other-player";
    const recent = calculatePlayerStats("sample01", [
      ...games,
      other,
    ]).recentGames;
    expect(recent).toHaveLength(10);
    expect(recent[0].gameId).toBe("g-2");
    expect(recent[9].gameId).toBe("g-11");
  });
  it("日時の小数桁やタイムゾーン表記が異なっても実際の時刻順に並ぶ", () => {
    const early = {
      ...fixture("early", "2026-08-06"),
      createdAt: "2026-09-10T10:30:35.68Z",
    };
    const later = {
      ...fixture("later", "2026-08-06"),
      createdAt: "2026-09-10T19:30:35.681+09:00",
    };
    const newerDate = {
      ...fixture("newer-date", "2026-09-09"),
      createdAt: "2026-09-09T01:00:00Z",
    };
    expect(
      calculatePlayerStats("sample01", [
        later,
        newerDate,
        early,
      ]).recentGames.map((g) => g.gameId),
    ).toEqual(["early", "later", "newer-date"]);
  });
  it("未対局はnullの記録と0の率でNaNを出さない", () => {
    expect(calculatePlayerStats("absent", statFixtures())).toMatchObject({
      gamesPlayed: 0,
      totalResult: 0,
      averageRank: null,
      highestRawScore: null,
      lowestRawScore: null,
      bestDay: null,
      worstDay: null,
      bestDailyResult: null,
      worstDailyResult: null,
      topTwoRate: 0,
      bustRate: 0,
      strengthPoint: 50,
      title: "未対局",
    });
  });
  it("日別最高・最低が同値なら早い日を採用", () => {
    const tied = calculatePlayerStats("sample01", [
      fixture("a", "2026-09-10"),
      fixture("b", "2026-09-09"),
    ]);
    expect(tied.bestDay).toBe("2026-09-09");
    expect(tied.worstDay).toBe("2026-09-09");
  });
  it("全マイナスの日の最高、全プラスの日の最低を0扱いしない", () => {
    const negative = calculatePlayerStats("sample04", statFixtures());
    expect(negative.bestDailyResult).toBe(-40);
    expect(negative.worstDailyResult).toBe(-40);
    const positive = calculatePlayerStats("sample02", statFixtures());
    expect(positive.worstDailyResult).toBe(5);
  });
  it("削除と編集後に過去の最高・順位・累計も更新", () => {
    const games = statFixtures();
    games.pop();
    const deleted = calculatePlayerStats("sample01", games);
    expect(deleted.totalResult).toBe(-1.2);
    expect(deleted.highestRawScore).toBe(40000);
    games[0] = fixture("a", "2026-09-09", [10000, 20000, 30000, 40000]);
    const edited = calculatePlayerStats("sample01", games);
    expect(edited.totalResult).toBe(-71.2);
    expect(edited.rankCounts).toEqual([0, 0, 0, 2]);
  });
  it("9つの並び替えキーで昇降順が逆転し、未対局の順位は末尾", () => {
    const all = players.map((p) =>
      calculatePlayerStats(p.id, generateSampleGames()),
    );
    for (const [key] of sortOptions) {
      const asc = sortPlayerStats(all, key, "asc");
      const desc = sortPlayerStats(all, key, "desc");
      const value = (s: typeof stats) =>
        key === "firstRate" ? s.rankRates[0] : s[key];
      expect(value(asc[0])!).toBeLessThanOrEqual(value(asc.at(-1)!)!);
      expect(value(desc[0])!).toBeGreaterThanOrEqual(value(desc.at(-1)!)!);
    }
    expect(
      sortPlayerStats(
        [calculatePlayerStats("absent", []), stats],
        "averageRank",
        "asc",
      ).at(-1)?.playerId,
    ).toBe("absent");
  });
});
describe("サンプルデータ", () => {
  it("設定のメンバー増減にも追随する", () => {
    for (const roster of [
      players.slice(0, 4),
      players.slice(0, 7),
      [...players, { id: "new", name: "追加", color: "#ffffff" }],
    ]) {
      const games = generateSampleGames(roster);
      expect(games).toHaveLength(48);
      expect(
        games.every((game) =>
          game.players.every((entry) =>
            roster.some((player) => player.id === entry.playerId),
          ),
        ),
      ).toBe(true);
    }
    expect(generateSampleGames(players.slice(0, 3))).toEqual([]);
  });
  it("48半荘を同じseedで再現し、9人の参加回数がすべて異なる", () => {
    const games = generateSampleGames();
    expect(games).toHaveLength(48);
    expect(games).toEqual(generateSampleGames());
    const all = players.map((p) => calculatePlayerStats(p.id, games));
    expect(all.map((s) => s.gamesPlayed)).toEqual([
      38, 34, 30, 26, 23, 18, 14, 7, 2,
    ]);
    expect(all.some((s) => (s.bustRate ?? 0) > 0)).toBe(true);
    expect(all.some((s) => s.totalResult > 100)).toBe(true);
    expect(all.some((s) => s.totalResult < -100)).toBe(true);
    expect(all.every((s) => Number.isFinite(s.strengthPoint))).toBe(true);
    expect(
      calculateDailySummaries(games).every((day) => day.games.length === 4),
    ).toBe(true);
    for (const game of games) {
      expect(new Set(game.players.map((p) => p.playerId)).size).toBe(4);
      expect(game.players.reduce((sum, p) => sum + p.rawScore!, 0)).toBe(
        100000,
      );
    }
  });
});

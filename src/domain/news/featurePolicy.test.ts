import { describe, expect, it } from "vitest";
import { matchupImportance } from "./featurePolicy";
import { describePairResult } from "./relationships";
import { createNewsEdition } from "./edition";
import { fixture } from "../../test/fixtures";
import { players } from "../../config/players";
import type { Facts, NewsSubject } from "./facts";
import type { Four, GameResult } from "../types";

const subjects: NewsSubject[] = [100, 80, 40, -220].map((total, i) => ({
  id: String(i), name: `選手${i}`, color: "#000", facts: { "player.totalResult": total },
}));
const pair = (wins: number, losses: number, extra: Facts = {}): Facts => ({
  "player.id": "0", "opponent.id": "1", "pair.games": wins + losses,
  "pair.wins": wins, "pair.losses": losses, "pair.priorGames": 0, "pair.priorWins": 0, ...extra,
});

describe("newsworthiness before copy rotation", () => {
  it("excludes tiny samples, one-result margins and small tied matchups from every feature slot", () => {
    for (const [wins, losses] of [[1, 0], [2, 0], [2, 1], [1, 1], [2, 2], [3, 2]]) {
      for (const slot of ["headline", "news", "article"] as const) {
        expect(matchupImportance(pair(wins, losses, { "pair.priorGames": 10, "pair.priorWins": 0 }), subjects, slot)).toBe(0);
      }
    }
  });
  it("reserves pair headlines for sustained reversals or decisive clashes between positive daily contenders", () => {
    expect(matchupImportance(pair(3, 0), subjects, "headline")).toBe(0);
    expect(matchupImportance(pair(3, 0), subjects, "article")).toBeGreaterThan(0);
    expect(matchupImportance(pair(4, 0), subjects, "headline")).toBe(86);
    expect(matchupImportance(pair(4, 1), subjects, "headline")).toBe(86);
    expect(matchupImportance(pair(4, 0, { "opponent.id": "3", "pair.titleGap": -10 }), subjects, "headline")).toBe(0);
    expect(matchupImportance(pair(3, 0, { "pair.priorGames": 4, "pair.priorWins": 0 }), subjects, "headline")).toBe(0);
    expect(matchupImportance(pair(3, 0, { "pair.priorGames": 5, "pair.priorWins": 1 }), subjects, "headline")).toBe(90);
    expect(matchupImportance(pair(3, 0, { "pair.priorGames": 10, "pair.priorWins": 3 }), subjects, "headline")).toBe(90);
    expect(matchupImportance(pair(3, 0, { "pair.priorGames": 10, "pair.priorWins": 4 }), subjects, "headline")).toBe(0);
    // 同じ対戦を負けた側から評価しても、重要度は同じ。
    expect(matchupImportance(pair(0, 3, { "pair.priorGames": 5, "pair.priorWins": 4 }), subjects, "headline")).toBe(90);
    expect(matchupImportance(pair(3, 3), subjects, "article")).toBe(60);
    expect(matchupImportance(pair(3, 3), subjects, "headline")).toBe(0);
    expect(matchupImportance(pair(3, 3, { "opponent.id": "2" }), subjects, "article")).toBe(0);
  });
  it("describes sweeps and split results without a zero-count sentence or implying table wins", () => {
    expect(describePairResult("A", "B", 3, 0)).toBe("同卓した3戦すべてでA選手がB選手より上位となった。");
    expect(describePairResult("A", "B", 0, 3)).toBe("同卓した3戦すべてでB選手がA選手より上位となった。");
    expect(describePairResult("A", "B", 3, 1)).toBe("同卓4戦のうち3戦でA選手がB選手より上位となった。");
    expect(describePairResult("A", "B", 3, 3)).toContain("それぞれ3戦ずつ");
  });
  it("features the narrow daily leader instead of a peripheral 1–0 and stays stable after future games", () => {
    const roster = Array.from({ length: 9 }, (_, i) => ({ ...players[0], id: `p${i}`, name: `テスト${i}` }));
    const rounds = [
      [[0,1,2,3], [52,-44,21,-29]], [[0,1,2,3], [43,-48,-6,11]],
      [[0,1,2,3], [-3,5,28,-30]], [[4,5,6,7], [33,5,-11,-27]],
      [[8,5,2,7], [41,-8,0,-33]], [[4,0,1,6], [62,-21,-37,-4]],
      [[4,5,6,2], [-24,31,7,-14]], [[8,0,3,7], [37,12,-18,-31]],
    ];
    const games = rounds.map(([ids, values], i) => {
      const game = fixture(`day-${i}`, "2026-06-01");
      game.createdAt = `2026-09-11T00:00:00+09:00`;
      game.inputMode = "results";
      game.players = game.players.map((p, j) => ({ ...p, playerId: roster[ids[j]].id, result: values[j],
        rawScore: null, rank: 1 + values.filter(v => v > values[j]).length })) as Four<GameResult>;
      return game;
    });
    const source = { date: "2026-06-01", groupId: "test", realRecords: true, games, players: roster };
    const now = Date.parse("2026-10-02T00:00:00+09:00");
    const edition = createNewsEdition(source, now)!;
    expect(edition.headline).toContain("テスト0");
    expect(edition.headline).toContain("5pt");
    expect(edition.paragraphs[0]).toContain("テスト0");
    expect(edition.paragraphs.join("")).toContain("+83.0pt");
    expect(edition.paragraphs.join("")).not.toMatch(/同卓(?:した)?[12]戦|上回ったのは0回|選手は0回/);
    expect(edition.paragraphs.join("").length).toBeGreaterThanOrEqual(800);
    expect(edition.paragraphs.join("").length).toBeLessThanOrEqual(1550);
    const future = { ...games[0], id: "future", date: "2026-10-01" };
    expect(createNewsEdition({ ...source, games: [...games, future] }, now)).toEqual(edition);
  });
});

import { describe, expect, it } from "vitest";
import { rules } from "../config/rules";
import {
  assignRanks,
  calculateGameResults,
  createGame,
  isBusted,
} from "./scoring";
import { parseScoreUnits, validateGameInput, type DraftEntry } from "./input";
import type { Four, GameEntry } from "./types";
import { fixture, testPlayers } from "../test/fixtures";
import { isValidDate } from "../utils/date";

const entries = (scores: Four<number>) =>
  scores.map((rawScore, i) => ({
    playerId: testPlayers[i],
    rawScore,
  })) as Four<GameEntry>;

// 最終更新: 2026-09-10 — 順位、ウマ・オカ、入力境界とルール差し替えを検証。
describe("順位・半荘収支", () => {
  it("素点順の順位を元の席順で返す", () =>
    expect(assignRanks(entries([20000, 40000, 10000, 30000]))).toEqual([
      3, 1, 4, 2,
    ]));
  it("同点は入力順。4人同点も順位が重複しない", () => {
    expect(assignRanks(entries([30000, 30000, 20000, 20000]))).toEqual([
      1, 2, 3, 4,
    ]);
    expect(assignRanks(entries([25000, 25000, 25000, 25000]))).toEqual([
      1, 2, 3, 4,
    ]);
  });
  it("30000点返し、5-10、オカ20を小数まで計算", () => {
    const values = calculateGameResults(
      entries([40100, 29300, 20600, 10000]),
    ).map((entry) => entry.result);
    expect(values).toEqual([40.1, 4.3, -14.4, -30]);
    expect(values.reduce((sum, value) => sum + Math.round(value * 10), 0)).toBe(
      0,
    );
  });
  it("30000点持ち・オカなしの別ルールを適用", () => {
    expect(
      calculateGameResults(entries([45000, 35000, 25000, 15000]), {
        ...rules,
        startingPoints: 30000,
        oka: "none",
      }).map((entry) => entry.result),
    ).toEqual([25, 10, -10, -25]);
  });
  it("マイナスは箱割れ、0点は箱割れでない。設定で境界変更可能", () => {
    expect(isBusted(-100)).toBe(true);
    expect(isBusted(0)).toBe(false);
    expect(isBusted(100)).toBe(false);
    expect(isBusted(0, { ...rules, bustIncludesZero: true })).toBe(true);
  });
  it("ルールのスナップショットを保存して外部変更を隔離", () => {
    const config = structuredClone(rules);
    const game = createGame({
      id: "snapshot",
      date: "2026-09-10",
      createdAt: "2026-09-10T00:00:00Z",
      entries: entries([40000, 30000, 20000, 10000]),
      config,
    });
    config.uma[0] = 999;
    expect(game.rules.uma[0]).toBe(10);
  });
  it("総点不一致は明示承認が必要で、登録後にもフラグを残す", () => {
    const input = {
      id: "forced",
      date: "2026-09-10",
      createdAt: "2026-09-10T00:00:00Z",
      entries: entries([40100, 30000, 20000, 10000]),
    };
    expect(() => createGame(input)).toThrow("合計点");
    expect(
      createGame({ ...input, acceptMismatch: true }).totalMismatchAccepted,
    ).toBe(true);
    expect(fixture("normal", "2026-09-10").totalMismatchAccepted).toBe(false);
  });
  it("登録関数も重複、空欄、非100点単位を拒否", () => {
    const input = {
      id: "invalid",
      date: "2026-09-10",
      createdAt: "2026-09-10T00:00:00Z",
      entries: entries([40000, 30000, 20000, 10000]),
    };
    expect(() =>
      createGame({ ...input, entries: entries([40001, 30000, 20000, 9999]) }),
    ).toThrow("単位");
    input.entries[1].playerId = input.entries[0].playerId;
    expect(() => createGame(input)).toThrow("異なる4人");
  });
});
describe("入力値・日付", () => {
  it.each([
    ["293", 29300],
    ["-12", -1200],
    ["0", 0],
    [" 123 ", 12300],
  ])("%sを点数に変換", (value, expected) =>
    expect(parseScoreUnits(value, 100)).toBe(expected),
  );
  it.each([
    "",
    "-",
    "abc",
    "1.5",
    "1e3",
    "Infinity",
    "12abc",
    "9007199254740991",
  ])("%sを数値として受理しない", (value) =>
    expect(parseScoreUnits(value, 100)).toBeNull(),
  );
  it("4人、重複、4つの点数、数値、総点をチェック", () => {
    const draft: Four<DraftEntry> = [
      { playerId: "sample01", units: "400" },
      { playerId: "sample02", units: "300" },
      { playerId: "sample03", units: "200" },
      { playerId: "sample04", units: "100" },
    ];
    expect(
      validateGameInput("2026-09-10", draft, rules, testPlayers),
    ).toMatchObject({ errors: [], total: 100000, mismatch: false });
    draft[3] = { playerId: "sample01", units: "10x" };
    const invalid = validateGameInput("2026-09-10", draft, rules, testPlayers);
    expect(invalid.entries).toBeNull();
    expect(invalid.errors.join(" ")).toContain("同じメンバー");
    expect(invalid.errors.join(" ")).toContain("整数");
    draft[3] = { playerId: "", units: "" };
    expect(
      validateGameInput("2026-09-10", draft, rules, testPlayers).errors,
    ).toHaveLength(2);
  });
  it.each([
    ["2026-02-29", false],
    ["2024-02-29", true],
    ["2026-09-31", false],
    ["2026-09-10", true],
    ["", false],
  ])("暦日%sの妥当性", (date, valid) => expect(isValidDate(date)).toBe(valid));
});

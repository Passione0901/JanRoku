import { describe, expect, it } from "vitest";
import { fixture } from "../../test/fixtures";
import { players } from "../../config/players";
import type { Four, GameResult } from "../types";
import { collectNewsFacts, type NewsSource } from "./facts";
import { createNewsEdition } from "./edition";
import { isNewsAvailable, newsAvailableAt } from "./availability";
import { createCopyDesk } from "./editorial";

// 最終更新: 2026-09-12 — 境界日時、当日/後日入力、訂正、比較履歴、会の分離を実際の集計・文案で確認する。
function game(
  id: string,
  date = "2026-09-12",
  hour = 10,
  values = [40, 10, -10, -40],
) {
  const g = fixture(id, date);
  g.createdAt = `${date}T${String(hour).padStart(2, "0")}:00:00+09:00`;
  const ordered = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  g.players = g.players.map((p, i) => ({
    ...p,
    result: values[i],
    rawScore: null,
    rank: ordered.findIndex((r) => r.i === i) + 1,
  })) as Four<GameResult>;
  g.inputMode = "results";
  return g;
}
const source = (games = [game("a")]): NewsSource => ({
  date: "2026-09-12",
  games,
  players: players.slice(0, 4),
  groupId: "main",
  realRecords: true,
});
const published = Date.parse("2026-09-12T15:00:00Z");
describe("news release in Japan", () => {
  it("unlocks exactly at the next midnight including month and leap-year boundaries", () => {
    expect(isNewsAvailable("2026-09-12", published - 1)).toBe(false);
    expect(isNewsAvailable("2026-09-12", published)).toBe(true);
    expect(newsAvailableAt("2026-12-31")).toBe(
      Date.parse("2027-01-01T00:00:00+09:00"),
    );
    expect(newsAvailableAt("2028-02-29")).toBe(
      Date.parse("2028-03-01T00:00:00+09:00"),
    );
    expect(isNewsAvailable("2026-02-30", published)).toBe(false);
    expect(createNewsEdition(source(), published - 1)).toBeNull();
  });
});
describe("daily news facts and editions", () => {
  it("replays historical selections consistently across view order, data corrections and isolated groups", () => {
    const dates = Array.from({ length: 13 }, (_, i) =>
      new Date(Date.UTC(2026, 5, 1 + i * 7)).toISOString().slice(0, 10),
    );
    const games = dates.flatMap((date, i) => [
      game(`weekly-${i}-a`, date, 10, [40, 10, -10, -40]),
      game(`weekly-${i}-b`, date, 11, [40, 10, -10, -40]),
    ]);
    const full = { ...source(games), date: dates.at(-1)! };
    const latest = createNewsEdition(full, published)!;
    const earlier = { ...full, date: dates[5] };
    const archive = createNewsEdition(earlier, published)!;
    expect(
      createNewsEdition(
        { ...earlier, games: games.filter((g) => g.date <= earlier.date) },
        published,
      ),
    ).toEqual(archive);
    expect(createNewsEdition(full, published)).toEqual(latest);
    const normalizedAnswers = dates
      .slice(-10)
      .map(
        (date) =>
          createNewsEdition({ ...full, date }, published)!.members.find(
            (m) => m.id === players[0].id,
          )!.answer,
      );
    expect(new Set(normalizedAnswers).size).toBe(10);
    createNewsEdition(
      {
        ...full,
        groupId: "other",
        players: full.players.map((p) => ({ ...p, name: "別会" + p.id })),
      },
      published,
    );
    expect(createNewsEdition(full, published)).toEqual(latest);
    // 過去の訂正も再現し直す。閲覧履歴や端末に保持した古い文案に依存しない。
    const corrected = {
      ...full,
      games: games.map((g) =>
        g.date === dates[2]
          ? {
              ...g,
              players: g.players.map((p) => ({
                ...p,
                result: -p.result,
                rank: 5 - p.rank,
              })) as Four<GameResult>,
            }
          : g,
      ),
    };
    expect(createNewsEdition(corrected, published)).toEqual(
      createNewsEdition(
        { ...corrected, games: [...corrected.games].reverse() },
        published,
      ),
    );
  });
  it("rotates editorial forms on later editions, consumes each form once, and repeats the same edition", () => {
    const options = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      text: `copy${i}`,
    }));
    const first = createCopyDesk("main", 0);
    const selected = players
      .slice(0, 5)
      .map((p) => first("summary", p.id, options)!.id);
    expect(new Set(selected).size).toBe(5);
    expect(first("summary", "extra", options)).toBeUndefined();
    const acrossDays = Array.from(
      { length: 5 },
      (_, day) =>
        createCopyDesk("main", day)("summary", "same-player", options)!.id,
    );
    expect(new Set(acrossDays).size).toBe(5);
    expect(
      createCopyDesk("main", 0)("summary", players[0].id, options)!.id,
    ).toBe(selected[0]);
  });
  it("avoids repeated fallback interviews and groups similar losses into a single story", () => {
    const a = game("a", "2026-09-12", 10, [120, -30, -40, -50]);
    const b = game("b", "2026-09-12", 11, [120, -30, -40, -50]);
    a.createdAt = b.createdAt = "2026-09-13T01:00:00+09:00";
    const edition = createNewsEdition(source([a, b]), published)!;
    expect(new Set(edition.members.map((m) => m.answer)).size).toBe(4);
    expect(
      edition.paragraphs.some((p) =>
        players.slice(1, 4).every((s) => p.includes(s.name)),
      ),
    ).toBe(true);
    const normalize = (text: string) =>
      players
        .reduce((t, p) => t.replaceAll(p.name, "選手"), text)
        .replace(/[+\-]?\d+(?:\.\d+)?/g, "N");
    expect(new Set(edition.members.map((m) => normalize(m.summary))).size).toBe(
      4,
    );
    expect(new Set(edition.paragraphs.map(normalize)).size).toBe(
      edition.paragraphs.length,
    );
    expect(JSON.stringify(edition)).not.toMatch(
      /収支欄|合計欄|スクロール|表の一番上|保存ボタン/,
    );
  });
  it("uses different copy on successive dates with identical results, without changing archived editions", () => {
    const games = [game("a"), game("b", "2026-09-12", 11)];
    const first = createNewsEdition(source(games), published)!;
    const next = games.map((g) => ({
      ...g,
      id: g.id + "next",
      date: "2026-09-13",
      createdAt: g.createdAt.replaceAll("2026-09-12", "2026-09-13"),
    }));
    const later = { ...source([...games, ...next]), date: "2026-09-13" };
    const second = createNewsEdition(later, published + 86400000)!;
    expect(second.members[0].summary).not.toBe(first.members[0].summary);
    expect(second.members[0].answer).not.toBe(first.members[0].answer);
    const stripDates = (text: string) =>
      text.replace(/2026\/09\/\d{2}/g, "対象日");
    expect(stripDates(second.paragraphs[0])).not.toBe(
      stripDates(first.paragraphs[0]),
    );
    expect(second.paragraphs[1]).not.toBe(first.paragraphs[1]);
    expect(
      createNewsEdition({ ...later, date: "2026-09-12" }, published + 86400000),
    ).toEqual(first);
  });
  it("reports shared win leaders and the actual largest single-game result without needing input order", () => {
    const s = source([
      game("a", "2026-09-12", 10, [40, 10, -10, -40]),
      game("b", "2026-09-12", 11, [10, 40, -10, -40]),
      game("c", "2026-09-12", 12, [40, 10, -10, -40]),
      game("d", "2026-09-12", 13, [10, 40, -10, -40]),
    ]);
    s.games.forEach((g) => {
      g.createdAt = "2026-09-14T00:00:00+09:00";
    });
    const prose = createNewsEdition(s, published)!.paragraphs.join("\n");
    expect(prose).toMatch(/最多|勝利数/);
    expect(prose).toMatch(/一対局|一戦/);
    expect(prose).toContain("+40.0pt");
    expect(prose).not.toMatch(/連勝|直近戦/);
  });
  it("recognizes an ordered same-day comeback and avoids cumulative career totals", () => {
    const s = source([
      game("before", "2026-09-11", 10, [500, 10, -10, -500]),
      game("b", "2026-09-12", 11, [60, 5, -20, -45]),
      game("a", "2026-09-12", 10, [-40, 30, 20, -10]),
    ]);
    const f = collectNewsFacts(s)[0].facts;
    expect(f["player.totalResult"]).toBe(20);
    expect(f["player.minCumulative"]).toBe(-40);
    expect(f["player.recovery"]).toBe(60);
    expect(f["player.beforeLatestResult"]).toBe(-40);
    expect(f["context.orderVerified"]).toBe(true);
    const news = createNewsEdition(s, published)!;
    expect(news.headline).toMatch(/プラス|回復|帰還|符号/);
    expect(news.members).toHaveLength(4);
  });
  it("keeps aggregate facts but omits order claims for backdated input and tied timestamps", () => {
    const a = game("a", "2026-09-12", 10, [-40, 30, 20, -10]);
    const b = game("b", "2026-09-12", 11, [60, 5, -20, -45]);
    a.createdAt = "2026-09-13T01:00:00+09:00";
    const f = collectNewsFacts(source([a, b]))[0].facts;
    expect(f["context.orderVerified"]).toBe(false);
    expect(f["player.totalResult"]).toBe(20);
    expect(f["player.minCumulative"]).toBeUndefined();
    expect(f["player.maxTopStreak"]).toBeUndefined();
    a.createdAt = b.createdAt;
    expect(
      collectNewsFacts(source([a, b]))[0].facts["context.orderVerified"],
    ).toBe(false);
    a.createdAt = "2026-09-12T14:00:00Z";
    b.createdAt = "2026-09-12T14:30:00Z";
    expect(
      collectNewsFacts(source([a, b]))[0].facts["context.orderVerified"],
    ).toBe(true);
  });
  it("does not turn tied leaders into a sole leader and distinguishes tenths from zero", () => {
    const f = collectNewsFacts(
      source([game("a", "2026-09-12", 10, [0.1, 0.1, -0.1, -0.1])]),
    )[0].facts;
    expect(f["player.isSoleDailyLeader"]).toBe(false);
    expect(f["day.leadGap"]).toBe(0);
    expect(f["player.totalResult"]).toBe(0.1);
    const edition = createNewsEdition(
      source([game("a", "2026-09-12", 10, [0.1, 0.1, -0.1, -0.1])]),
      published,
    )!;
    expect(edition.headline).not.toContain("単独首位");
  });
  it("compares prior dates only and requires matching score rules", () => {
    const past = [
      game("a", "2026-09-08"),
      game("b", "2026-09-09"),
      game("c", "2026-09-10"),
    ];
    const current = [
      game("d"),
      game("e", "2026-09-12", 11),
      game("f", "2026-09-12", 12),
    ];
    const s = source([
      ...past,
      ...current,
      game("future", "2026-09-14", 10, [1000, 0, 0, -1000]),
    ]);
    expect(collectNewsFacts(s)[0].facts["player.previousBestDaily"]).toBe(40);
    expect(collectNewsFacts(s)[0].facts["player.previousComparableDays"]).toBe(
      3,
    );
    expect(createNewsEdition(s, published)!.headline).toContain("自己記録");
    past[0].rules = { ...past[0].rules, uma: [20, 10, -10, -20] };
    expect(collectNewsFacts(s)[0].facts["player.previousComparableDays"]).toBe(
      2,
    );
    expect(createNewsEdition(s, published)!.headline).not.toContain("自己記録");
  });
  it("is repeatable across input array order and later dates, updates with corrections, and never uses preview records", () => {
    const s = source([game("a"), game("b", "2026-09-12", 11)]);
    const first = createNewsEdition(s, published)!;
    expect(
      createNewsEdition(
        {
          ...s,
          games: [...s.games].reverse(),
          players: [...s.players].reverse(),
        },
        published + 10000,
      ),
    ).toEqual(first);
    expect(
      createNewsEdition(
        { ...s, games: [...s.games, game("future", "2026-09-15")] },
        published,
      ),
    ).toEqual(first);
    const fixed = source([
      game("a", "2026-09-12", 10, [-40, 10, 0, 30]),
      s.games[1],
    ]);
    expect(createNewsEdition(fixed, published)).not.toEqual(first);
    expect(
      createNewsEdition({ ...s, realRecords: false }, published),
    ).toBeNull();
    const second = source([game("different")]);
    second.groupId = "second";
    second.players = second.players.map((p) => ({ ...p, name: `別会${p.id}` }));
    const text = JSON.stringify(createNewsEdition(second, published));
    expect(text).not.toContain("メンバーA");
    expect(JSON.stringify(first)).not.toMatch(/\{player\.|\{day\./);
  });
  it("rejects malformed current data and handles no games or no matching special event", () => {
    expect(createNewsEdition(source([]), published)).toBeNull();
    const malformed = game("bad");
    malformed.players[0].result = NaN;
    expect(() => createNewsEdition(source([malformed]), published)).toThrow();
    const s = source([
      game("a", "2026-09-12", 10, [10, 9, -9, -10]),
      game("b", "2026-09-12", 11, [9, 10, -10, -9]),
    ]);
    const e = createNewsEdition(s, published)!;
    expect(e.members.every((m) => m.summary && m.question && m.answer)).toBe(
      true,
    );
    expect(e.paragraphs.join("").length).toBeGreaterThan(150);
    expect(e.comments.length).toBeGreaterThan(0);
    expect(e.ticker.length).toBeGreaterThan(0);
  });
  it("generates about twenty reader comments when valid templates are available", () => {
    const s = source([game("a"), game("b", "2026-09-12", 11)]);
    const e = createNewsEdition(s, published)!;
    expect(e.comments.length).toBeGreaterThanOrEqual(18);
    expect(e.comments.length).toBeLessThanOrEqual(22);
  });
});

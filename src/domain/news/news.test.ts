import { describe, expect, it } from "vitest";
import { fixture } from "../../test/fixtures";
import { players } from "../../config/players";
import type { Four, GameResult } from "../types";
import { collectNewsFacts, type NewsSource } from "./facts";
import { createNewsEdition } from "./edition";
import { isNewsAvailable, newsAvailableAt } from "./availability";

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
});

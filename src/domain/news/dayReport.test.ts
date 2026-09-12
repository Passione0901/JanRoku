import { describe, expect, it } from "vitest";
import { fixture } from "../../test/fixtures";
import { players } from "../../config/players";
import { createNewsEdition } from "./edition";
import { collectNewsFacts, type NewsSource } from "./facts";
import { recordedBust } from "./busts";
import type { Four, GameResult } from "../types";

const now = Date.parse("2026-09-13T00:00:00+09:00");
// 最終更新: 2026-09-12 — 個人データを使わず、文章量・飛びの境界・後日入力と訂正を集計から確認する。
function game(id: number, results: number[], scores?: number[]) {
  const g = fixture(`report-${id}`, "2026-09-12");
  g.createdAt = `2026-09-12T${String(10 + id).padStart(2, "0")}:00:00+09:00`;
  g.inputMode = scores ? undefined : "results";
  g.players = g.players.map((p, i) => ({ ...p, result: results[i], rawScore: scores?.[i] ?? null,
    rank: results.map((r, j) => ({ r, j })).sort((a, b) => b.r - a.r || a.j - b.j).findIndex(r => r.j === i) + 1 })) as Four<GameResult>;
  return g;
}
const source = (games: ReturnType<typeof game>[]): NewsSource => ({ date: "2026-09-12", games, players: players.slice(0, 4), groupId: "report-test", realRecords: true });
const normal = () => [
  game(0, [50, 15, -20, -45]), game(1, [-20, 55, 10, -45]),
  game(2, [40, -30, 5, -15]), game(3, [-15, 45, -5, -25]),
];

describe("a substantial day report", () => {
  it("writes 800–1200 characters for a normal day, combining real angles rather than weak pairs", () => {
    const edition = createNewsEdition(source(normal()), now)!;
    const text = edition.paragraphs.join("");
    expect(text.length).toBeGreaterThanOrEqual(800);
    expect(text.length).toBeLessThanOrEqual(1200);
    expect(text).toContain("順位");
    expect(text).toContain("日次首位");
    expect(text).not.toContain("飛び");
    expect(text).not.toMatch(/同卓[12]戦|上回ったのは0回|スクロール|収支欄/);
    expect(new Set(edition.paragraphs).size).toBe(edition.paragraphs.length);
  });
  it("allows approximately 1500 characters when distinct stories are plentiful", () => {
    const extra = [game(4, [-70, 15, 65, -10]), game(5, [90, -80, -5, -5]),
      game(6, [-65, -20, 100, -15]), game(7, [80, 25, -70, -35])];
    const edition = createNewsEdition(source([...normal(), ...extra]), now)!;
    const length = edition.paragraphs.join("").length;
    expect(length).toBeGreaterThanOrEqual(1300);
    expect(length).toBeLessThanOrEqual(1550);
  });
  it("keeps sparse days shorter without inventing matchups or filling up to a rigid minimum", () => {
    const edition = createNewsEdition(source([game(0, [45, 5, -15, -35])]), now)!;
    expect(edition.paragraphs.join("").length).toBeLessThanOrEqual(650);
    expect(edition.paragraphs.join("")).not.toMatch(/雪辱|巻き返し|同卓1戦|連勝/);
  });
});

describe("bust facts and news", () => {
  it("uses each game's zero-point rule, and never infers a bust from negative settlement results", () => {
    const g = game(0, [-50, 40, 20, -10], [0, 42000, 35000, 23000]);
    g.rules = { ...g.rules, bustIncludesZero: false };
    expect(recordedBust(g, g.players[0])).toBe(false);
    g.rules.bustIncludesZero = true;
    expect(recordedBust(g, g.players[0])).toBe(true);
    g.players[0].rawScore = -100;
    g.rules.bustIncludesZero = false;
    expect(recordedBust(g, g.players[0])).toBe(true);
    g.inputMode = "results";
    expect(recordedBust(g, g.players[0])).toBeNull();
    delete g.inputMode;
    g.players[0].rawScore = null;
    expect(recordedBust(g, g.players[0])).toBeNull();
    g.players[0].rawScore = -100;
    for (const note of ["収支から逆算", "推定した持ち点", "一部調整", "仮入力", "記録を復元", "点数に換算"]) {
      g.note = note;
      expect(recordedBust(g, g.players[0])).toBeNull();
    }
  });
  it("mentions a confirmed bust and a verified recovery without naming who caused the bust", () => {
    const bust = game(0, [-55, 45, 20, -10], [-1000, 47000, 32000, 22000]);
    const later = [game(1, [70, -35, -20, -15]), game(2, [35, -10, -5, -20]), game(3, [10, 35, -15, -30])];
    const s = source([bust, ...later]);
    const facts = collectNewsFacts(s).find(p => p.id === players[0].id)!.facts;
    expect(facts["player.bustCount"]).toBe(1);
    expect(facts["player.bustKnownGames"]).toBe(1);
    expect(facts["player.afterBustResult"]).toBe(115);
    const text = createNewsEdition(s, now)!.paragraphs.join("");
    expect(text).toContain("飛び");
    expect(text).toContain("+115.0pt");
    expect(text).toContain("持ち点が残る対局を見ると、");
    expect(text).not.toMatch(/飛ばした|放銃|振り込|直撃|役満/);
    s.games.forEach(g => g.createdAt = "2026-09-14T00:00:00+09:00");
    const backdated = createNewsEdition(s, now)!.paragraphs.join("");
    expect(backdated).toContain("飛び");
    expect(backdated).toContain("日次収支は+60.0pt");
    expect(backdated).not.toMatch(/飛びとなった対局の後|その後の対局/);
  });
  it("refreshes cached stories when raw scores, input mode, or estimation notes are corrected", () => {
    const g = game(0, [-55, 45, 20, -10], [1000, 45000, 32000, 22000]);
    const s = source([g, ...normal().slice(1)]);
    expect(createNewsEdition(s, now)!.paragraphs.join("")).not.toContain("飛び");
    g.players[0].rawScore = -100;
    expect(createNewsEdition(s, now)!.paragraphs.join("")).toContain("飛び");
    g.note = "収支から逆算";
    expect(createNewsEdition(s, now)!.paragraphs.join("")).not.toContain("飛び");
    delete g.note;
    g.inputMode = "results";
    expect(createNewsEdition(s, now)!.paragraphs.join("")).not.toContain("飛び");
  });
});

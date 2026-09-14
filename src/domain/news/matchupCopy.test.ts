import { describe, expect, it } from "vitest";
import { fixture } from "../../test/fixtures";
import { players } from "../../config/players";
import summaries from "../../content/daily-news/member-summaries.json";
import headlines from "../../content/daily-news/headlines.json";
import { collectRelationships } from "./relationships";

// 最終更新: 2026-09-15 — 日次収支が異なる二人でも、同卓の上位回数は同数になり得る。
describe("matchup copy distinguishes finishing order from daily net", () => {
  it("states the comparison explicitly in every short matchup template", () => {
    for (const catalog of [summaries, headlines]) {
      for (const template of catalog.templates.filter((t) => t.topic === "matchup")) {
        expect(template.text, template.id).toMatch(/同卓|卓を囲んだ/);
        expect(template.text, template.id).toMatch(/上位|順位|下位/);
        expect(template.text, template.id).not.toMatch(/並ぶ結果|並ぶ一日|決着は次へ/);
      }
    }
  });

  it("reports two upper finishes each despite unequal daily net", () => {
    const day = [
      fixture("a", "2026-09-15", [60000, 20000, 15000, 5000]),
      fixture("b", "2026-09-15", [25000, 35000, 30000, 10000]),
    ];
    day.push({ ...day[0], id: "c" }, { ...day[1], id: "d" });
    const roster = players.slice(0, 4);
    const own = day[0].players[0].playerId;
    const opponent = day[0].players[1].playerId;
    const net = (id: string) => day.reduce((sum, g) => sum + g.players.find((p) => p.playerId === id)!.result, 0);
    expect(net(own)).not.toBe(net(opponent));
    const pair = collectRelationships(day, [], roster).get(own)!.find((p) => p["opponent.id"] === opponent)!;
    expect(pair["pair.wins"]).toBe(2);
    expect(pair["pair.losses"]).toBe(2);
    expect(pair["pair.resultSummary"]).toContain("同卓4戦で、それぞれ2戦ずつ相手より上位");
    const template = summaries.templates.find((t) => t.id === "summary.duel-even.04")!;
    const facts = { ...pair, "player.name": "伊藤", "opponent.name": "山田" };
    const text = template.text.replace(/\{([\w.]+)\}/g, (_, key: string) => String(facts[key as keyof typeof facts]));
    expect(text).toContain("卓を囲んだ4戦では、伊藤選手が2戦で相手より上位");
  });
});

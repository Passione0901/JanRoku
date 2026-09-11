import { describe, expect, it } from "vitest";
import { CopyHistory, type CopyUsage } from "./repetition";
import { createCopyDesk } from "./editorial";

describe("ten-edition copy history", () => {
  it("recognizes the same wording under different IDs, people and numbers", () => {
    const previous = new CopyHistory([], ["選手甲", "選手乙"]);
    previous.record("first", {
      text: "選手甲は2026/09/01、合計+45.0ptで首位に立った。",
    });
    const next = new CopyHistory(
      [previous.usage("2026-09-01")],
      ["選手甲", "選手乙"],
    );
    expect(
      next.score("different", {
        text: "選手乙は2026/09/08、合計+75.0ptで首位に立った。",
      }),
    ).toBe(0);
    expect(
      next.score("fresh", { text: "全勝を果たし、次の対局にも期待がかかる。" }),
    ).toBe(-1);
  });
  it("checks exactly ten preceding editions and drops older entries", () => {
    const usage: CopyUsage[] = Array.from({ length: 11 }, (_, i) => ({
      date: String(i),
      keys: [`form:story-${i}`],
    }));
    const history = new CopyHistory(usage, []);
    expect(history.score("story-0", {})).toBe(-1);
    expect(history.score("story-1", {})).toBe(0);
    expect(history.score("story-10", {})).toBe(9);
  });
  it("prefers unused copy then least recently used copy when all candidates were used", () => {
    const previous: CopyUsage[] = [
      { date: "1", keys: ["form:closing/b"] },
      { date: "2", keys: ["form:closing/c"] },
      { date: "3", keys: ["form:closing/a"] },
    ];
    const old = [
      { id: "a", text: "甲" },
      { id: "b", text: "乙" },
      { id: "c", text: "丙" },
    ];
    expect(
      createCopyDesk("main", 0, new CopyHistory(previous, []))(
        "closing",
        "edition",
        [...old, { id: "fresh", text: "丁" }],
      )!.id,
    ).toBe("fresh");
    const desk = createCopyDesk("main", 0, new CopyHistory(previous, []));
    expect(desk("closing", "edition", old)!.id).toBe("b");
    expect(desk("closing", "edition", old)!.id).toBe("c");
    expect(desk("closing", "edition", old)!.id).toBe("a");
    expect(desk("closing", "edition", old)).toBeUndefined();
  });
  it("uses eleven available forms without repeating within ten editions", () => {
    const options = Array.from({ length: 11 }, (_, i) => ({
      id: String(i),
      text: "試合を振り返る特集" + String.fromCharCode(0x30a2 + i),
    }));
    const previous: CopyUsage[] = [];
    const chosen: string[] = [];
    for (let day = 0; day < 25; day++) {
      const history = new CopyHistory(previous, []);
      const item = createCopyDesk("main", day, history)(
        "interview",
        "player",
        options,
      )!;
      expect(chosen.slice(-10)).not.toContain(item.id);
      chosen.push(item.id);
      previous.push(history.usage(String(day)));
    }
  });
});

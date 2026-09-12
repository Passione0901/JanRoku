import { describe, expect, it } from "vitest";
import { commentAppeal, createReaderThreads, type CommentSource } from "./discussion";
import { readerVoice } from "./readerVoice";

// 最終更新: 2026-09-12 — 反響の再現性、内容による重み、親に沿った返信と敬称を確認する。
const comment = (event: string, i = 0): CommentSource => ({
  id: `${event}/${i}`, event,
  text: `甲選手が乙選手に勝ち越し。次の対戦も楽しみ。${i}`,
  facts: { "player.name": "甲", "opponent.name": "乙" },
});
describe("fictional reader discussion", () => {
  it("weights the actual topic and wording, not only a random number", () => {
    const ordinary = { ...comment("general"), text: "お疲れさまでした。" };
    expect(commentAppeal(comment("title-upset"))).toBeGreaterThan(commentAppeal(ordinary));
    expect(commentAppeal({ ...ordinary, text: "苦手相手への勝ち越し、次も応援したい。" })).toBeGreaterThan(commentAppeal(ordinary));
    const threads = createReaderThreads([ordinary, comment("title-upset")], "group/date", 0);
    expect(threads[1].likes).toBeGreaterThan(threads[0].likes);
  });
  it("repeats the same reactions on reread and creates replies for only some parents", () => {
    const inputs = Array.from({ length: 20 }, (_, i) => comment(["nemesis-win", "title-upset", "favorite-loss", "duel-win"][i % 4], i));
    const threads = createReaderThreads(inputs, "group/2026-09-12", 0);
    expect(createReaderThreads(inputs, "group/2026-09-12", 0)).toEqual(threads);
    expect(createReaderThreads(inputs, "other/2026-09-12", 0)).not.toEqual(threads);
    expect(threads).toHaveLength(20);
    expect(threads.some(t => t.replies.length)).toBe(true);
    expect(threads.some(t => !t.replies.length)).toBe(true);
    expect(threads.every(t => Number.isInteger(t.likes) && t.likes > 0 && t.replies.length <= 3)).toBe(true);
    const replies = threads.flatMap(t => t.replies);
    expect(new Set(replies.map(r => r.text)).size).toBe(replies.length);
    expect(replies.some(r => /甲(?!選手|さん)|乙(?!選手|さん)/.test(r.text))).toBe(true);
    expect(threads.every(t => t.replies.every(r => r.author !== t.author && r.id.startsWith(t.id + "/")))).toBe(true);
  });
  it("answers a specific parent topic without introducing the opposite result", () => {
    const threads = createReaderThreads([comment("favorite-loss")], "test", 0);
    expect(threads[0].replies.length).toBeGreaterThan(0);
    for (const r of threads[0].replies) {
      expect(r.text).not.toMatch(/甲(?:選手)?が上回|甲(?:選手)?の勝ち越|甲(?:選手)?に拍手/);
    }
    expect(createReaderThreads([], "test", 0)).toEqual([]);
  });
  it("usually uses bare names in reader messages and occasionally adds the player suffix", () => {
    const voices = Array.from({ length: 100 }, (_, i) => readerVoice("{player.name}選手と{opponent.name}さん", `reader-${i}`));
    const formal = voices.filter(v => v.includes("選手")).length;
    expect(formal).toBeGreaterThan(5);
    expect(formal).toBeLessThan(35);
    expect(voices.every(v => !v.includes("さん選手"))).toBe(true);
  });
});

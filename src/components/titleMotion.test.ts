import { describe, expect, it } from "vitest";
import { resolveTitleMotion } from "./titleMotion";

// 最終更新: 2026-09-11 — OSの省モーションが有効でも、明示的な表示選択を止めない。
describe("title animation preference", () => {
  it.each([
    ["on", true, true],
    ["on", false, true],
    ["system", true, false],
    ["system", false, true],
    ["off", true, false],
    ["off", false, false],
  ] as const)("%s with reduced motion %s resolves to %s", (mode, reduced, expected) => {
    expect(resolveTitleMotion(mode, reduced)).toBe(expected);
  });
});

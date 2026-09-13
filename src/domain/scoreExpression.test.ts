import { expect, it } from "vitest";
import { parseScoreUnits } from "./input";

// 最終更新: 2026-09-13 — 負数、優先順位、全角、入力途中、実行コードの拒否を確認する。
it.each([
  ["250-320", -7000], ["２５０−３２０", -7000], ["100+20*3", 16000],
  ["(100+20)×3", 36000], ["300÷2-200", -5000], ["-(-70)", 7000],
  ["10/4*2", 500], ["100--20", 12000],
])("evaluates %s in score units", (expression, points) => expect(parseScoreUnits(String(expression), 100)).toBe(points));
it.each(["1/0", "1/(2-2)", "1/3", "250-", "(10+2", "2(3)", "1 2", "alert(1)", "1;2", "2**3", "9".repeat(201)])(
  "rejects %s", expression => expect(parseScoreUnits(expression, 100)).toBeNull(),
);

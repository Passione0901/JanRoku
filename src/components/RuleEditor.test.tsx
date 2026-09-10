import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { RuleEditor } from "./RuleEditor";
import { rules } from "../config/rules";
import { createGame } from "../domain/scoring";
import { fixture } from "../test/fixtures";
// 最終更新: 2026-09-10 — 変更値が対局の計算・保存へ渡り、未入力や不整合を拒否する。
it("applies customized rules without modifying defaults", () => {
  const change = vi.fn();
  render(<RuleEditor config={rules} onChange={change} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "ルールを変更" }));
  fireEvent.change(screen.getByLabelText("返し点（点）"), {
    target: { value: "25000" },
  });
  fireEvent.click(screen.getByRole("button", { name: "10-20" }));
  fireEvent.click(screen.getByRole("button", { name: "ルールを適用" }));
  const config = change.mock.calls[0][0];
  expect(config.returnPoints).toBe(25000);
  expect(config.uma).toEqual([20, 10, -10, -20]);
  const g = fixture("g", "2026-09-10");
  const next = createGame({
    id: g.id,
    date: g.date,
    createdAt: g.createdAt,
    entries: g.players.map((p) => ({
      playerId: p.playerId,
      rawScore: p.rawScore!,
    })) as import("../domain/types").Four<import("../domain/types").GameEntry>,
    config,
  });
  expect(next.players[0].result).toBe(35);
  expect(next.rules).toEqual(config);
  expect(rules.returnPoints).toBe(30000);
});
it("rejects blank points and unbalanced uma", () => {
  const change = vi.fn();
  render(<RuleEditor config={rules} onChange={change} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "ルールを変更" }));
  fireEvent.change(screen.getByLabelText("開始時の持ち点（点）"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "ルールを適用" }));
  expect(screen.getByRole("alert").textContent).toContain("100点単位");
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("開始時の持ち点（点）"), {
    target: { value: "25000" },
  });
  fireEvent.change(screen.getByLabelText("1位"), { target: { value: "20" } });
  fireEvent.click(screen.getByRole("button", { name: "ルールを適用" }));
  expect(screen.getByRole("alert").textContent).toContain("合計が0");
  expect(change).not.toHaveBeenCalled();
});

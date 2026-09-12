import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { NewsCommentThread } from "./NewsCommentThread";

// 最終更新: 2026-09-12 — 返信の開閉と、架空のいいねが投票ボタンでないことを確認する。
it("shows fictional likes and opens replies beneath their parent", async () => {
  const user = userEvent.setup();
  render(<NewsCommentThread index={0} thread={{
    id: "parent", author: "観戦席の声 01", text: "苦手な相手を上回った一日。", likes: 120,
    replies: [{ id: "parent/reply", author: "観戦席の声 21", text: "次の同卓も楽しみですね。", likes: 24 }],
  }} />);
  expect(screen.getByLabelText("架空のいいね 120件").tagName).toBe("SPAN");
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  const summary = screen.getByText("返信を見る（1件）");
  const details = summary.closest("details")!;
  expect(details.open).toBe(false);
  await user.click(summary);
  expect(details.open).toBe(true);
  expect(screen.getByText("次の同卓も楽しみですね。")).toBeTruthy();
  expect(screen.getByLabelText("架空のいいね 24件")).toBeTruthy();
  await user.click(summary);
  expect(details.open).toBe(false);
});

import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { SyncPage } from "./SyncPage";
import { GitHubStore } from "../data/GitHubStore";
// 最終更新: 2026-09-10 — 接続フォームは認証情報をストアへ渡し、入力欄から消去する。
it("passes the token to the store and clears the input", async () => {
  const store = new GitHubStore();
  const connect = vi.spyOn(store, "connect").mockResolvedValue();
  render(<SyncPage store={store} />);
  const input = screen.getByLabelText("GitHubトークン") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "test-only-token" } });
  fireEvent.click(screen.getByRole("button", { name: "接続する" }));
  expect(
    await screen.findByText("GitHubに接続しました。保存と取り込みができます。"),
  ).toBeTruthy();
  expect(connect).toHaveBeenCalledWith("test-only-token");
  expect(input.value).toBe("");
  expect(JSON.stringify(window.localStorage)).not.toContain("test-only-token");
});

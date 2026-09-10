import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// 最終更新: 2026-09-10 — jsdom未実装のネイティブAPIだけ補完し、Reactの実際の操作経路を試験。
afterEach(() => cleanup());
Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};

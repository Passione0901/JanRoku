import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// 最終更新: 2026-09-10 — jsdom未実装のネイティブAPIだけ補完し、Reactの実際の操作経路を試験。
afterEach(() => cleanup());
// Updated 2026-09-14: Node-only QR decoding tests do not need browser API shims.
if (typeof window !== "undefined") {
Object.defineProperty(window, "scrollTo", { value: vi.fn(), writable: true });
// Updated 2026-09-13: jsdom has neither element scrolling nor a GPU canvas.
Object.defineProperty(HTMLElement.prototype, "scrollTo", { value: vi.fn(), writable: true });
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: vi.fn(() => null), writable: true });
HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
HTMLDialogElement.prototype.close = function () {
  this.open = false;
};

}

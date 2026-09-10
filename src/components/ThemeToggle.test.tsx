import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { applyInitialTheme, THEME_KEY, ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  cleanup();
  localStorage.removeItem(THEME_KEY);
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

it("uses the device preference initially and preserves an explicit choice after remount", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  applyInitialTheme();
  expect(document.documentElement.dataset.theme).toBe("light");
  const view = render(<ThemeToggle />);
  fireEvent.click(
    screen.getByRole("button", { name: "ダークモードに切り替え" }),
  );
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  view.unmount();
  render(<ThemeToggle />);
  expect(
    screen.getByRole("button", { name: "ライトモードに切り替え" }),
  ).toBeTruthy();
});

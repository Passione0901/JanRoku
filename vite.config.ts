import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 最終更新: 2026-09-10 — 相対baseとhash遷移でPagesのサブパス・再読み込みに対応。
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { rollupOptions: { input: { main: 'index.html', shared: 'shared.html' } } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
});

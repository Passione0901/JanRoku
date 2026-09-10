import { it, expect } from "vitest";
import { generateSampleGames } from "./sampleGames";
import { isInitialSample } from "./sampleDetection";
import { mergeLocal } from "./sharedData";
import { players } from "../config/players";
import { fixture } from "../test/fixtures";
// 最終更新: 2026-09-10 — 初期サンプルだけを除外し、実対局や編集済み記録は残す。
it("identifies all initial samples but keeps edited samples", () => {
  const samples = generateSampleGames();
  expect(samples.every(isInitialSample)).toBe(true);
  expect(
    isInitialSample({ ...samples[0], updatedAt: "2026-09-10T12:00:00Z" }),
  ).toBe(false);
  expect(isInitialSample(fixture("real", "2026-09-10"))).toBe(false);
});
it("does not restore samples when importing a device", () => {
  const sample = generateSampleGames()[0];
  const edited = { ...sample, updatedAt: "2026-09-10T12:00:00Z" };
  const real = fixture("real", "2026-09-10");
  const initial = { version: 1 as const, players, games: [] };
  const result = mergeLocal(initial, {
    version: 1,
    players,
    games: [...generateSampleGames().slice(1), edited, real],
  });
  expect(result.games).toEqual([edited, real]);
});

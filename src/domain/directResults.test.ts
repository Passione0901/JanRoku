import { expect, it } from "vitest";
import { createResultGame, validateResultInput } from "./directResults";
import { validGame } from "../data/LocalStorageGameRepository";
import { calculatePlayerStats } from "./stats";
import { fixture } from "../test/fixtures";
const ids = ["sample01", "sample02", "sample03", "sample04"];
const input = {
  id: "direct",
  date: "2026-09-10",
  createdAt: "2026-09-10T10:00:00Z",
  entries: ids.map((playerId, i) => ({
    playerId,
    result: [35.4, 5, -15, -25.4][i],
  })),
};
it("preserves settled decimals through JSON and excludes unknown points from point statistics", () => {
  const g = createResultGame(input);
  expect(validGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  expect(g.players.map((p) => p.result)).toEqual([35.4, 5, -15, -25.4]);
  expect(g.players.every((p) => p.rawScore === null)).toBe(true);
  const stats = calculatePlayerStats("sample01", [g]);
  expect(stats.totalResult).toBe(35.4);
  expect(stats.highestRawScore).toBeNull();
  expect(stats.lowestRawScore).toBeNull();
  expect(stats.bustRate).toBeNull();
  const scored = fixture("scored", "2026-09-09");
  const before = calculatePlayerStats("sample01", [scored]);
  const mixed = calculatePlayerStats("sample01", [scored, g]);
  expect(mixed.bustRate).toBe(before.bustRate);
  expect(mixed.highestRawScore).toBe(before.highestRawScore);
});
it("requires explicit confirmation for a nonzero sum and rejects corrupt modes, ranks and points", () => {
  const changed = {
    ...input,
    entries: input.entries.map((p, i) => ({
      ...p,
      result: p.result + (i === 0 ? 12 : 0),
    })),
  };
  expect(() => createResultGame(changed)).toThrow();
  const g = createResultGame({ ...changed, acceptMismatch: true });
  expect(validGame(g)).toBe(true);
  expect(g.players[0].result).toBe(47.4);
  expect(validGame({ ...g, inputMode: "unexpected" })).toBe(false);
  expect(
    validGame({
      ...g,
      players: g.players.map((p, i) => (i === 0 ? { ...p, rawScore: 0 } : p)),
    }),
  ).toBe(false);
  expect(
    validGame({ ...g, players: g.players.map((p) => ({ ...p, rank: 1 })) }),
  ).toBe(false);
});
it("rejects blank, excessive precision and duplicate members; ties follow entry order", () => {
  expect(
    validateResultInput(
      input.date,
      ids.map((playerId) => ({ playerId, resultUnits: "" })),
      ids,
    ).entries,
  ).toBeNull();
  expect(() =>
    createResultGame({
      ...input,
      entries: input.entries.map((p) => ({ ...p, result: 1.23 })),
    }),
  ).toThrow();
  expect(() =>
    createResultGame({
      ...input,
      entries: input.entries.map((p) => ({ ...p, playerId: "sample01" })),
    }),
  ).toThrow();
  expect(
    createResultGame({
      ...input,
      entries: input.entries.map((p) => ({ ...p, result: 0 })),
    }).players.map((p) => p.rank),
  ).toEqual([1, 2, 3, 4]);
});

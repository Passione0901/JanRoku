import { players } from "../config/players";
import { rules } from "../config/rules";
import { createGame } from "../domain/scoring";
import type { Four, Game, GameEntry, Player } from "../domain/types";

const profiles: Record<string, { appearances: number; power: number }> = {
  sample01: { appearances: 38, power: 1.8 },
  sample02: { appearances: 34, power: 0.95 },
  sample03: { appearances: 30, power: 0.35 },
  sample04: { appearances: 26, power: 0.05 },
  sample05: { appearances: 23, power: -0.2 },
  sample06: { appearances: 18, power: -0.6 },
  sample07: { appearances: 14, power: -0.9 },
  sample08: { appearances: 7, power: -1.6 },
  sample09: { appearances: 2, power: 0.3 },
};

// 最終更新: 2026-09-10 — 固定seedで再現可能な48半荘。参加回数と実力差を独立して設定する。
export function generateSampleGames(
  roster: Player[] = players,
  initialSeed = 20260910,
): Game[] {
  if (roster.length < rules.playerCount) return [];
  let seed = initialSeed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const weightsByPlayer = roster.map(
    (player) => profiles[player.id]?.appearances ?? 16,
  );
  const totalWeight = weightsByPlayer.reduce((sum, weight) => sum + weight, 0);
  const remaining = roster.map(() => 0);
  // メンバーの追加・削除にも対応し、48卓×4席を参加重みに沿って配分する。
  for (let slot = 0; slot < 192; slot++) {
    let selected = -1;
    let largestDeficit = -Infinity;
    remaining.forEach((count, i) => {
      const deficit = (weightsByPlayer[i] / totalWeight) * 192 - count;
      if (count < 48 && deficit > largestDeficit) {
        selected = i;
        largestDeficit = deficit;
      }
    });
    remaining[selected]++;
  }
  const powers = roster.map((player) => profiles[player.id]?.power ?? 0);
  const dates = [
    "2026-08-01",
    "2026-08-05",
    "2026-08-08",
    "2026-08-12",
    "2026-08-15",
    "2026-08-19",
    "2026-08-22",
    "2026-08-26",
    "2026-08-29",
    "2026-09-02",
    "2026-09-05",
    "2026-09-10",
  ];
  return Array.from({ length: 48 }, (_, index) => {
    const gamesLeft = 48 - index;
    const candidates = remaining
      .map((count, player) => ({
        player,
        count,
        priority: count / gamesLeft + random() * 0.7,
      }))
      .filter((entry) => entry.count > 0)
      .sort(
        (a, b) =>
          Number(b.count === gamesLeft) - Number(a.count === gamesLeft) ||
          b.priority - a.priority,
      );
    const seats = candidates.slice(0, 4).map((entry) => entry.player);
    seats.forEach((player) => remaining[player]--);
    const weights = seats.map(
      (player) => powers[player] + (random() - 0.5) * 3.8,
    );
    const mean = weights.reduce((sum, value) => sum + value, 0) / 4;
    const units = weights.map((weight) =>
      Math.round(
        rules.startingPoints / rules.scoreUnit + (weight - mean) * 150,
      ),
    );
    units[3] +=
      (rules.startingPoints * rules.playerCount) / rules.scoreUnit -
      units.reduce((sum, value) => sum + value, 0);
    const date = dates[Math.floor(index / 4)];
    return createGame({
      id: `sample-${String(index + 1).padStart(3, "0")}`,
      date,
      createdAt: `${date}T${String(11 + (index % 4)).padStart(2, "0")}:00:00.000Z`,
      entries: seats.map((player, seat) => ({
        playerId: roster[player].id,
        rawScore: units[seat] * rules.scoreUnit,
      })) as Four<GameEntry>,
    });
  });
}

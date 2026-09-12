import { calculateCompatibility } from "../compatibility";
import { calculatePlayerStats } from "../stats";
import { strengthPopulation } from "../strength";
import { titleConfig } from "../../config/titleConfig";
import type { Game, Player } from "../types";
import type { Facts } from "./facts";

// 最終更新: 2026-09-12 — 相性は開催日前、称号は当日終了時。全参加者の母集団も同じ日付で区切る。
export function collectRelationships(day: Game[], past: Game[], players: Player[], historyKnown = true): Map<string, Facts[]> {
  const editionGames = [...past, ...day];
  const population = strengthPopulation(editionGames);
  const titles = new Map(players.map((p) => {
    const stats = calculatePlayerStats(p.id, editionGames, population);
    return [p.id, { name: stats.title, known: historyKnown && stats.gamesPlayed > 0,
      tier: titleConfig.findIndex((t) => t.name === stats.title) }];
  }));
  const result = new Map<string, Facts[]>();
  for (const player of players) {
    const ratings = new Map(calculateCompatibility(player.id, past).map((r) => [r.playerId, r.rating]));
    const pairs: Facts[] = [];
    for (const opponent of players) {
      if (opponent.id === player.id) continue;
      const shared = day.filter((g) => [player.id, opponent.id].every((id) => g.players.some((p) => p.playerId === id)));
      if (!shared.length) continue;
      const prior = past.filter((g) => [player.id, opponent.id].every((id) => g.players.some((p) => p.playerId === id)));
      const wins = (games: Game[]) => games.filter((g) =>
        g.players.find((p) => p.playerId === player.id)!.rank < g.players.find((p) => p.playerId === opponent.id)!.rank).length;
      const ownTitle = titles.get(player.id)!, otherTitle = titles.get(opponent.id)!;
      const rating = ratings.get(opponent.id);
      pairs.push({
        "opponent.id": opponent.id,
        "opponent.name": opponent.name,
        "pair.games": shared.length,
        "pair.wins": wins(shared),
        "pair.losses": shared.length - wins(shared),
        "pair.priorGames": prior.length,
        "pair.priorWins": wins(prior),
        "pair.affinity": rating === "bad" || rating === "slightlyBad" ? "bad" :
          rating === "good" || rating === "slightlyGood" ? "good" : prior.length >= 3 ? "neutral" : "unknown",
        "pair.titlesKnown": ownTitle.known && otherTitle.known,
        "player.editionTitle": ownTitle.name,
        "opponent.editionTitle": otherTitle.name,
        "pair.titleGap": ownTitle.tier - otherTitle.tier,
      });
      if (!historyKnown) {
        // 過去が読めない場合も当日の順位比較はできるが、「初同卓」とは断定しない。
        delete pairs.at(-1)!["pair.priorGames"];
        delete pairs.at(-1)!["pair.priorWins"];
      }
    }
    result.set(player.id, pairs.sort((a, b) => String(a["opponent.id"]).localeCompare(String(b["opponent.id"]))));
  }
  return result;
}

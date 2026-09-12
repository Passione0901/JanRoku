import type { Facts, NewsSubject } from "./facts";

export type FeatureSlot = "headline" | "news" | "article";

// 最終更新: 2026-09-12 — 一度上回っただけの対戦を主役にしない。順位はその日の収支による同順位込み。
export function matchupImportance(facts: Facts, subjects: NewsSubject[], slot: FeatureSlot): number {
  const games = Number(facts["pair.games"]);
  const wins = Number(facts["pair.wins"]);
  const losses = Number(facts["pair.losses"]);
  const margin = Math.abs(wins - losses);
  if (games < 3) return 0;

  const priorGames = Number(facts["pair.priorGames"]);
  const priorWins = Number(facts["pair.priorWins"]);
  const priorWinnerWins = wins > losses ? priorWins : priorGames - priorWins;
  const reversal = priorGames >= 5 && priorWinnerWins / priorGames <= 0.3;
  const rank = (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return Infinity;
    return 1 + subjects.filter(s => Number(s.facts["player.totalResult"]) > Number(subject.facts["player.totalResult"])).length;
  };
  const isContender = (id: string) => rank(id) <= 3
    && Number(subjects.find(s => s.id === id)?.facts["player.totalResult"]) > 0;
  const topClash = isContender(String(facts["player.id"])) && isContender(String(facts["opponent.id"]));
  if (margin < 2) {
    // 五分を取り上げるのは上位2人が6戦以上競った場合だけ。見出しにはしない。
    return slot !== "headline" && topClash && margin === 0 && games >= 6
      && rank(String(facts["player.id"])) <= 2 && rank(String(facts["opponent.id"])) <= 2 ? 60 : 0;
  }
  // 番狂わせも過去5戦以上の裏付けが必要。称号差だけでは重要度を上げない。
  if (reversal) return 90;
  if (topClash && games >= 4 && margin >= 3) return 86;
  if (slot === "headline") return 0;
  return topClash ? 68 : 58;
}

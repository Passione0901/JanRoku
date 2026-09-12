import type { Facts, NewsSubject } from "./facts";
import type { CopyOption } from "./editorial";
import { result } from "../../utils/format";

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

// 最終更新: 2026-09-12 — 特筆する対戦がなくても、主役の当日成績と他選手の成果で記事を成立させる。
// 同卓していない二人を直接対決とせず、小標本を雪辱や優劣の根拠にしない。
export function dayLeadOptions(subject: NewsSubject, other: NewsSubject): CopyOption[] {
  const own = subject.facts, opponent = other.facts;
  const n = subject.name + "選手", o = other.name + "選手";
  const total = result(Number(own["player.totalResult"])) + "pt";
  const otherTotal = result(Number(opponent["player.totalResult"])) + "pt";
  const games = Number(own["player.gamesPlayed"]), tops = Number(own["player.topCount"]);
  const otherGames = Number(opponent["player.gamesPlayed"]), otherTops = Number(opponent["player.topCount"]);
  const openings = [
    `${n}は${games}戦で${total}。トップを${tops}回取り、この日の対局を終えた。`,
    `${games}戦に出場した${n}。トップ${tops}回、合計${total}という一日だった。`,
    `${n}の一日は${total}で終了。出場した${games}戦のうち、${tops}戦でトップに立った。`,
    `${n}がこの日手にしたトップは${tops}回。${games}戦を打ち、収支は${total}となった。`,
    `この日の${n}は${games}戦でトップ${tops}回。収支を${total}として対局を締めくくった。`,
    `${total}で一日を終えた${n}。${games}戦を戦い、トップ${tops}回を記録した。`,
  ];
  const comparisons = [
    `一方、${o}は${otherGames}戦で${otherTotal}、トップ${otherTops}回だった。`,
    `${o}も${otherGames}戦に出場。トップ${otherTops}回、合計${otherTotal}という成績を残している。`,
  ];
  return openings.flatMap((text, i) => comparisons.map((tail, j) => ({ id: `day-lead-${i}-${j}`, text: text + tail })));
}

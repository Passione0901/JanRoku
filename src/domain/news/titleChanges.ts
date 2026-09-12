import { titleConfig } from "../../config/titleConfig";
import { calculatePlayerStats } from "../stats";
import { strengthPopulation } from "../strength";
import type { Game, Player } from "../types";
import type { NewsSubject } from "./facts";
import type { CopyOption } from "./editorial";

export interface TitleChange {
  before: string;
  after: string;
  steps: number;
  direction: "up" | "down";
}

// 最終更新: 2026-09-12 — 前日までと当日終了時を同じ称号計算で比較。初参加を昇格とは呼ばない。
export function collectTitleChanges(day: Game[], past: Game[], players: Player[]): Map<string, TitleChange> {
  const changes = new Map<string, TitleChange>();
  if (!past.length) return changes;
  const throughDay = [...past, ...day];
  const beforePopulation = strengthPopulation(past);
  const afterPopulation = strengthPopulation(throughDay);
  const participants = new Set(day.flatMap(g => g.players.map(p => p.playerId)));
  for (const player of players) {
    if (!participants.has(player.id)) continue;
    const before = calculatePlayerStats(player.id, past, beforePopulation);
    if (!before.gamesPlayed) continue;
    const after = calculatePlayerStats(player.id, throughDay, afterPopulation);
    const steps = titleConfig.findIndex(t => t.name === after.title) - titleConfig.findIndex(t => t.name === before.title);
    if (!steps) continue;
    changes.set(player.id, { before: before.title, after: after.title, steps, direction: steps > 0 ? "up" : "down" });
  }
  return changes;
}

// 最終更新: 2026-09-12 — 称号変化を対戦記事に添える短い文。勝敗や打ち方を昇降の原因だと決めつけない。
export function titleChangeOptions(subject: NewsSubject): CopyOption[] {
  const change = subject.titleChange;
  if (!change) return [];
  const n = `${subject.name}選手`, old = `「${change.before}」`, next = `「${change.after}」`;
  const texts = change.direction === "up" ? [
    `${n}の称号には、うれしい変化があった。${old}から${next}へ昇格し、次は新しい肩書で卓に向かう。`,
    `この日を終えた${n}は、${old}から${next}に昇格した。一日の振り返りに、新しい肩書という喜びも加わった。`,
    `${n}の称号も${old}から${next}へ上がった。次の対戦では、ひとつ先へ進んだその名前にも注目したい。`,
    `称号に目を向けると、${n}は${old}から${next}に昇格。対戦結果とあわせて伝えたい、うれしい話題となった。`,
    `${n}は${next}としてこの日を終えた。これまでの${old}からの昇格で、次の同卓にも新たな楽しみができた。`,
    `一日を終え、${n}の称号は${old}から${next}へ。新しい肩書を携えて臨む次の対戦にも期待がかかる。`,
    `${old}だった${n}が、この日終了時には${next}に昇格した。次はその肩書でどんな勝負を見せるだろうか。`,
    `${n}に新しい肩書が加わった。称号は${old}から${next}へ昇格しており、この日を思い返す楽しみが一つ増えた。`,
    `対戦を振り返る${n}には、${old}から${next}への昇格という話題もある。次の一日は、新しい肩書から始まる。`,
    `${n}の称号が${next}へ上がった。前日までの${old}から一歩進み、次の勝負を迎えることになる。`,
  ] : [
    `一方、${n}の称号は${old}から${next}へ下がった。こちらは少し残念な変化だが、次に取り戻す楽しみは残っている。`,
    `この日を終えた${n}は、称号が${old}から${next}へ下がった。次の対戦では、また上を目指す姿に期待したい。`,
    `${n}には、称号が${old}から${next}へ下がる変化もあった。次の対戦では、また上を目指す姿に注目したい。`,
    `称号は${old}から${next}へ。${n}には残念な知らせとなったが、ここで勝負が終わるわけではない。次に返す機会を待ちたい。`,
    `${n}は、これまでの${old}から${next}へ称号が下がった。この日の結果を受け、次は再び上がる側に回りたいところだ。`,
    `一日を終えると、${n}の称号は${old}から${next}に。今回は下がる形となったが、再び肩書を取り戻す日も追いかけたい。`,
    `${old}だった${n}は、この日終了時には${next}となった。称号は下がったものの、次の勝負にはまた新しい機会がある。`,
    `${n}の称号が${next}へ下がった。前日までの${old}からの変化は残念だが、次に上がった日の喜びも待っている。`,
    `対戦とは別に、${n}は${old}から${next}へ称号が下がった。次に卓を囲むときは、巻き返しにも期待したい。`,
    `${n}には、${old}から${next}への降格という変化があった。この日の悔しさだけで終わらず、次に取り戻す機会を見届けたい。`,
  ];
  return texts.map((text, i) => ({ id: `${change.direction}-${i}`, text }));
}

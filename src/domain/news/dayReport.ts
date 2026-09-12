import type { Game } from "../types";
import type { NewsSubject } from "./facts";
import { createCopyDesk, type CopyOption } from "./editorial";
import { result } from "../../utils/format";
import { formatDate } from "../../utils/date";

export interface ReportPair { id: string; text: string; subjectId: string; opponentId: string }
interface Story { id: string; priority: number; options: CopyOption[] }
interface ReportInput {
  subjects: NewsSubject[];
  games: Game[];
  date: string;
  focusId: string;
  event: string;
  primaryText?: string;
  pairLead: boolean;
  pairs: ReportPair[];
  titleNotes: { subject: NewsSubject; text: string }[];
  desk: ReturnType<typeof createCopyDesk>;
}
const value = (s: NewsSubject, key: string) => Number(s.facts[`player.${key}`]);
const name = (s: NewsSubject) => `${s.name}選手`;
const points = (n: number) => `${result(n)}pt`;
const options = (id: string, texts: string[]): CopyOption[] => texts.map((text, i) => ({ id: `${id}-${i}`, text }));
const rounded = (n: number) => Math.round(n * 10) / 10;

// 最終更新: 2026-09-12 — 成績の内訳を文章にする。0回の列挙や、順位から打ち筋を推測する説明は避ける。
function profileOptions(s: NewsSubject): CopyOption[] {
  const n = name(s), games = value(s, "gamesPlayed"), tops = value(s, "topCount");
  const rankCounts = [tops, value(s, "secondCount"), value(s, "thirdCount"), value(s, "lastCount")];
  const ranks = rankCounts.flatMap((count, i) => count ? [`${i === 0 ? "トップ" : `${i + 1}位`}${count}回`] : []).join("、");
  const positive = value(s, "positiveGames"), negative = value(s, "negativeGames"), even = games - positive - negative;
  const balance = [positive ? `プラスで終えた対局が${positive}戦` : "", negative ? `マイナスの対局が${negative}戦` : "", even ? `収支ゼロの対局が${even}戦` : ""].filter(Boolean).join("、");
  const interpretations = tops === games && games >= 2
    ? [
      `出場した全${games}戦でトップを取り、勝利の取りこぼしがなかった。`,
      `同卓した選手たちに一度もトップを譲らず、出場した対局をすべて勝ち切った。`,
      `今回は全勝という結果を残した。出場数と合わせて伝えたい、この日の成果だ。`,
      `参加した対局では常に卓の先頭に立った。全勝を持ち帰る一日となった。`,
    ]
    : value(s, "topTwoCount") === games && games >= 3
      ? [
        `全${games}戦で2位以内を確保した。連対を取りこぼさなかったことも成果といえる。`,
        `3位にも4位にも落ちなかった。出場したすべての対局で連対した点に注目したい。`,
        `一日を通して2位以内に入り続けた。複数戦を打ったうえでの全戦連対となった。`,
        `トップか2位で全対局を終えた。この日の順位には3位以下が一度もなかった。`,
      ]
      : value(s, "lastCount") === 0 && games >= 3
        ? [
          `この日は一度もラスを引かなかった。複数戦を通して最下位を避けたことも成果となる。`,
          `出場した${games}戦を、いずれも3位以内で終えた。最後までラスなしの結果を残した。`,
          `4位に沈んだ対局はなかった。全戦で最下位を回避したことは見逃せない。`,
          `一日を通してラスを避けた。トップ回数だけでは伝わらない結果も残っている。`,
        ]
        : tops > 0 && value(s, "lastCount") > 0
          ? [
            `トップとラスの両方があり、勝ち星だけでは語れない一日だった。`,
            `勝利を手にした一方、最下位の対局も経験した。対局ごとの結果には差があった。`,
            `一日の中にトップもラスも含まれていた。上位入賞ばかりの成績ではなかった。`,
            `卓の首位に立った対局もあれば、最下位で終えた対局もある。振幅のある結果が残った。`,
          ]
          : tops === 0 && value(s, "secondCount") > 0
            ? [
              `トップには届かなかったが、2位を取った対局もある。次は一つ上の順位を目指したい。`,
              `この日の最高順位は2位だった。トップへのあと一段は、次の対局へ持ち越した。`,
              `勝ち星こそなかったものの、2位の成果は残した。次回はトップも加えたいところだ。`,
              `2位に入る対局もあったが、今回は勝利に届かなかった。トップ争いへの再挑戦を待ちたい。`,
            ]
            : tops === 0 && value(s, "topTwoCount") === 0 ? [
              `この日は2位以内に届かず、厳しい順位が続いた。次回の上位入賞に期待したい。`,
              `今回は連対を残せなかった。次の対局では、まず2位以内に入る結果を目指したい。`,
              `トップも2位もない一日だった。次に卓を囲むときは上位入賞を期待したい。`,
              `今回は全対局で3位以下となった。次の一日は、また別の勝負として始まる。`,
            ] : [
              `一戦ごとの順位と収支を重ねて、一日の成績が決まった。`,
              `この日の対局では、こうした順位の内訳が残った。`,
              `それぞれの対局結果を積み重ねて一日を終えている。`,
              `次の対局では、また別の順位を争うことになる。`,
            ];
  const starts = [
    `${n}の成績を対局ごとに見ると、${games}戦の内訳は${ranks}。`,
    `この日の${n}は${ranks}という成績だった。出場は${games}戦。`,
    `${games}戦を打った${n}。順位の内訳には${ranks}が並ぶ。`,
    `${n}がこの日残したのは、${ranks}。${games}戦にわたる結果だ。`,
    `${n}については、${games}戦で${ranks}だった点にも触れておきたい。`,
    `合計収支に加えて見ておきたいのが${n}の順位だ。${games}戦で${ranks}となった。`,
    `対局の内訳にも${n}の一日が表れている。${games}戦を終えて${ranks}だった。`,
    `${n}は${games}戦に出場し、${ranks}を記録した。`,
    `この日、${n}に残った順位は${ranks}。出場した${games}戦の成績となる。`,
    `${games}戦に臨んだ${n}の内訳は${ranks}。日次の合計とは別に注目したい結果だ。`,
    `順位から${n}の一日をたどれば、${ranks}。出場数は${games}戦だった。`,
    `${n}の${games}戦は、${ranks}という内訳で終わった。`,
  ];
  return options("profile", starts.flatMap((start, i) => interpretations.map(interpretation => i % 2
    ? `${start}${interpretation}収支では${balance}だった。`
    : `${start}収支では${balance}だった。${interpretation}`)));
}

// 最終更新: 2026-09-12 — 後日入力でも確定している最終順位・出場数だけで上位争いを伝える。
function raceOptions(subjects: NewsSubject[]): CopyOption[] {
  const [a, b] = subjects, an = name(a), bn = name(b);
  const av = value(a, "totalResult"), bv = value(b, "totalResult"), gap = rounded(av - bv);
  const opening = gap === 0
    ? `${an}と${bn}は、ともに${points(av)}で日次首位に並んだ。`
    : `${an}が${points(av)}で日次首位。${bn}は${points(bv)}で、二人の差は${gap}ptだった。`;
  const aGames = value(a, "gamesPlayed"), bGames = value(b, "gamesPlayed");
  const participation = aGames === bGames
    ? `二人はそれぞれ${aGames}戦に出場した。`
    : `出場数は${an}が${aGames}戦、${bn}が${bGames}戦で、同じ対局数を打った二人の比較ではない。`;
  const angle = gap > 0 && gap <= 5
    ? `最終的な収支差は小さく、首位だけでなく追走した側の成績にも目が向く一日となった。`
    : gap >= 50
      ? `最終的な日次収支には大きな差がついた。首位の成果とともに、他の選手がどの対局で結果を残したかも振り返りたい。`
      : aGames === bGames && value(a, "topCount") === value(b, "topCount")
        ? gap > 0 ? `出場数とトップ回数は同じだったが、日次収支では差がついた。` : `出場数とトップ回数も並び、一日の成績には共通する点が多かった。`
        : aGames === bGames ? `出場数は同じだったが、トップ回数には違いがあった。`
          : `出場数の異なる二人が、日次の上位を占めた。`;
  return options("race", [
    `${opening}${participation}${angle}`, `${participation}${opening}${angle}`,
    `日次収支で先頭に立った顔ぶれを確認したい。${opening}${participation}${angle}`,
    `${opening}${angle}${participation}`,
    `この日の上位争いでは、次のような結果が残った。${opening}${participation}${angle}`,
    `${participation}日次収支の結果はどうだったか。${opening}${angle}`,
    `一日の合計では、${opening}${participation}${angle}`,
    `${opening}ここで出場数にも目を向けたい。${participation}${angle}`,
    `首位争いを振り返るなら、この二人の結果は外せない。${opening}${angle}${participation}`,
    `${opening}${participation}同卓時の順位比較とは別に、日次収支ではこの結果となった。${angle}`,
  ]);
}

// 最終更新: 2026-09-12 — 飛ばした相手や放銃を推定しない。順序が確かな場合だけ「その後」を書く。
export function bustStoryOptions(s: NewsSubject): CopyOption[] {
  const count = value(s, "bustCount");
  if (!count) return [];
  const n = name(s), games = value(s, "gamesPlayed"), total = points(value(s, "totalResult"));
  const after = s.facts["player.afterBustResult"];
  const recovery = typeof after === "number" && after > 0
    ? `飛びとなった対局の後は、${value(s, "afterBustGames")}戦で${points(after)}。その後の対局では、収支を積み増す結果を残した。`
    : value(s, "totalResult") > 0
      ? `それでも日次収支は${total}。飛びのあった対局を含めて、一日の合計をプラスにした。`
      : `日次収支は${total}だった。飛びとなった対局も含めて、苦しい一日となった。次に卓を囲む日は、改めて上位を目指すことになる。`;
  const scope = value(s, "bustKnownGames") < games ? "持ち点が残る対局を見ると、" : "";
  return options("bust", [
    `${n}には飛びとなった対局が${count}戦あった。${recovery}`,
    `この日、${n}は${count}戦で飛びを記録した。${recovery}`,
    `${n}の一日には、飛びという厳しい結果も残った。該当する対局は${count}戦。${recovery}`,
    `飛びのあった${n}についても触れておきたい。この日は${count}戦で飛びとなった。${recovery}`,
    `${n}の${games}戦には、飛びとなった${count}戦が含まれる。${recovery}`,
    `一戦の結果と一日の結果は、分けて見ておきたい。${n}には飛びとなった対局が${count}戦ある。${recovery}`,
    `${n}は${count}戦で飛びとなる一日だった。${recovery}`,
    `持ち点が飛びの条件に達した対局は、${n}に${count}戦あった。${recovery}`,
    `${n}には苦しい対局もあった。この日、飛びとなったのは${count}戦。${recovery}`,
    `当日の${n}は、飛びとなった対局を${count}戦経験した。${recovery}`,
  ].map(text => scope + text));
}

// 最終更新: 2026-09-12 — 一日全体の材料を選ぶ。本文量を増やすために小標本の対戦や未確認の展開を足さない。
export function buildDayReport(input: ReportInput): string[] {
  const { subjects, games, date, pairs, desk, titleNotes } = input;
  const focus = subjects.find(s => s.id === input.focusId) ?? subjects[0];
  const stories: Story[] = [];
  const paragraphs: string[] = [];
  const used = new Set<string>();
  const add = (id: string, priority: number, texts: string[]) => stories.push({ id, priority, options: options(id, texts) });
  const pick = (story: Story) => {
    const selected = desk(`report/${story.id}`, "edition", story.options);
    if (selected) { paragraphs.push(selected.text); used.add(story.id); }
  };
  const topNames = subjects.filter(s => value(s, "topCount") > 0).map(name);
  const intro = `${formatDate(date)}の麻雀会は、${subjects.length}人が参加して${games.length}戦を行った。`;
  const leadEvent = input.primaryText ?? `${name(focus)}の結果を軸に、選手たちの一日を振り返る。`;
  const leads = [
    `${intro}${leadEvent}日次の合計だけでなく、各選手の出場数やトップ回数にも、この日を語る材料が残った。`,
    `${leadEvent}${intro}主役の成績に加え、同じ日に卓を囲んだ選手たちの成果にも目を向けたい。`,
    `${intro}${leadEvent}一人の成績だけで終わらせず、他の選手の見せ場とあわせて振り返る。`,
    `${leadEvent}${intro}結果を対局ごとにたどると、日次収支だけでは伝わらない違いも見えてくる。`,
    `${intro}${leadEvent}首位争いから対局の内訳まで、この日に残った成果を追う。`,
    `${leadEvent}${intro}それぞれの出場数と結果を重ねて、一日の輪郭を確かめたい。`,
    `${intro}${leadEvent}上位の選手だけでなく、別の対局で結果を残した顔ぶれにも注目する。`,
    `${leadEvent}${intro}勝利の回数、収支の幅、出場した対局数。いくつかの角度から選手たちの一日を見る。`,
    `${intro}${leadEvent}この結果を中心に、ほかの選手たちの成績も含めて一日を振り返りたい。`,
    `${leadEvent}${intro}日次の結果と一戦ごとの成果には、同じ数字だけでは語れない違いがある。`,
  ];
  pick({ id: "lead", priority: 100, options: options("lead", leads) });
  stories.push({ id: "race", priority: /leader/.test(input.event) ? 97 : 80, options: raceOptions(subjects) });
  const [leader, runner] = subjects;
  if (value(runner, "gamesPlayed") >= 2 && value(runner, "gamesPlayed") < value(leader, "gamesPlayed")
    && value(leader, "totalResult") > value(runner, "totalResult")
    && value(runner, "topCount") === value(runner, "gamesPlayed")) add("short-appearance", 92, [
    `${name(runner)}は、出場した${value(runner, "gamesPlayed")}戦をすべてトップで終えた。${value(leader, "gamesPlayed")}戦に出場した${name(leader)}とは異なる、短い出場での全勝という成果だ。日次の収支では先頭に届かなかったものの、勝利の取りこぼしがなかったことは、この日の見せ場として残る。`,
    `短い出場で結果を残したのは${name(runner)}だった。${value(runner, "gamesPlayed")}戦に出て、そのすべてでトップを獲得。日次首位の${name(leader)}より出場数は少ないが、出た対局はすべて勝ち切っており、合計収支とは別の角度から注目したい。`,
    `${name(leader)}が日次収支で先頭に立つ一方、${name(runner)}には${value(runner, "gamesPlayed")}戦全勝という成果がある。出場した対局では一度もトップを譲らなかった。少ない対局数の好成績として受け止めつつ、この日の見せ場には加えておきたい。`,
    `出場数の違いにも、二人それぞれの成果が見える。${name(leader)}が${value(leader, "gamesPlayed")}戦を打ったのに対し、${name(runner)}は${value(runner, "gamesPlayed")}戦で全勝。日次収支の順位だけでは伝わらない、短い出場で勝利を重ねた一日だった。`,
  ]);
  for (const [i, s] of subjects.entries()) {
    stories.push({ id: `profile/${s.id}`, priority: s.id === focus.id ? 94 : 73 - i, options: profileOptions(s) });
    const best = value(s, "bestGameResult"), worst = value(s, "worstGameResult");
    if (s.id === focus.id && input.event === "latest-turns-positive" && s.facts["context.orderVerified"]
      && value(s, "gamesPlayed") >= 2 && value(s, "beforeLatestResult") <= 0 && value(s, "totalResult") > 0) add(`last-positive/${s.id}`, 98, [
      `${name(s)}は、自身の最後の対局で${points(value(s, "latestResult"))}を獲得した。その直前までの日次収支は${points(value(s, "beforeLatestResult"))}。最後の一戦を経て${points(value(s, "totalResult"))}となり、一日の合計をプラスに変えた。`,
      `自身が最後に出場した対局まで、${name(s)}の累計は${points(value(s, "beforeLatestResult"))}だった。その一戦で${points(value(s, "latestResult"))}を加え、日次${points(value(s, "totalResult"))}へ。最後にプラスへ転じる結果となった。`,
      `日次収支をプラスに変えたのは、${name(s)}自身の最後の対局だった。この一戦は${points(value(s, "latestResult"))}で、直前の累計${points(value(s, "beforeLatestResult"))}から、最終的に${points(value(s, "totalResult"))}へと変わった。`,
      `${name(s)}が最後に出場した一戦には、日次収支の符号を変える意味があった。直前の累計${points(value(s, "beforeLatestResult"))}に${points(value(s, "latestResult"))}を加え、${points(value(s, "totalResult"))}で終えている。`,
    ]);
    if (value(s, "gamesPlayed") >= 3 && best >= 30 && worst <= -30) add(`range/${s.id}`, 65, [
      `${name(s)}の一戦ごとの収支には幅があった。最も高い対局は${points(best)}、最も低い対局は${points(worst)}。その差は${rounded(best - worst)}ptとなる。大きく収支を伸ばした対局と落とした対局の両方があり、日次の合計に至る内訳は平坦ではなかった。`,
      `収支の振れ幅では${name(s)}も目に留まる。一戦の最高は${points(best)}、最低は${points(worst)}で、幅は${rounded(best - worst)}pt。どちらも同じ選手の当日成績であり、良い結果だけでも厳しい結果だけでも、この一日は語り切れない。`,
      `${name(s)}には、${points(best)}を残した対局と、${points(worst)}で終えた対局があった。一戦の最高と最低の差は${rounded(best - worst)}pt。一日の成績の中にも、これほど異なる結果が含まれている。`,
      `一戦単位で見ると、${name(s)}の最高収支は${points(best)}、最低収支は${points(worst)}だった。両者の差は${rounded(best - worst)}pt。合計を作ったのは、一様な結果の積み重ねではなかった。`,
    ]);
    if (!(s.id === focus.id && input.event === "latest-turns-positive") && s.facts["context.orderVerified"] && value(s, "minCumulative") <= -30 && value(s, "totalResult") > 0) add(`recovery/${s.id}`, s.id === focus.id && /positive/.test(input.event) ? 98 : 86, [
      `${name(s)}は一度、当日の累計を${points(value(s, "minCumulative"))}まで落としている。そこから最終的には${points(value(s, "totalResult"))}へ。最も低かった時点から${value(s, "recovery")}ptを戻しており、最終収支だけでは見えない巻き返しがあった。`,
      `途中経過にも触れておきたい。${name(s)}の累計は一時${points(value(s, "minCumulative"))}だったが、最後は${points(value(s, "totalResult"))}。最も低い時点との比較では${value(s, "recovery")}ptを積み戻し、一日をプラスで終えた。`,
      `当日の累計が${points(value(s, "minCumulative"))}となる場面もあった${name(s)}。そのままでは終わらず、日次${points(value(s, "totalResult"))}まで持ち直した。最も低い時点からの回復幅は${value(s, "recovery")}ptとなった。`,
      `${name(s)}の成績は、最終的なプラスだけで片付けられない。一時の累計${points(value(s, "minCumulative"))}から、日次${points(value(s, "totalResult"))}へ回復した。途中の底から${value(s, "recovery")}ptを取り戻している。`,
    ]);
    if (s.facts["context.comparableHistoryComplete"] && value(s, "previousComparableDays") >= 3
      && value(s, "gamesPlayed") >= 3 && value(s, "totalResult") > Math.max(0, value(s, "previousBestDaily"))) add(`record/${s.id}`, s.id === focus.id && input.event === "personal-daily-best" ? 98 : 87, [
      `${name(s)}には自己記録の更新もあった。同じルール構成の過去${value(s, "previousComparableDays")}開催日では、最高の日次収支は${points(value(s, "previousBestDaily"))}。今回は${points(value(s, "totalResult"))}となり、従来の最高を${rounded(value(s, "totalResult") - value(s, "previousBestDaily"))}pt上回った。`,
      `過去の開催日と比べても、${name(s)}の成績は際立った。同じルール構成の過去${value(s, "previousComparableDays")}日での最高${points(value(s, "previousBestDaily"))}を更新し、今回は${points(value(s, "totalResult"))}。本人の日次収支に新しい最高値が刻まれた。`,
      `${name(s)}は、同じルール構成で比べられる過去${value(s, "previousComparableDays")}開催日の自己ベストを更新した。これまでの${points(value(s, "previousBestDaily"))}から、今回は${points(value(s, "totalResult"))}へ。日次収支の最高記録を伸ばす一日となった。`,
      `日次の自己記録にも動きがあった。${name(s)}の${points(value(s, "totalResult"))}は、同じルール構成の過去${value(s, "previousComparableDays")}開催日における最高${points(value(s, "previousBestDaily"))}を超えた。過去の好成績をもう一段上回る成果だ。`,
    ]);
  }
  const bustSubject = subjects.filter(s => value(s, "bustCount") > 0).sort((a, b) =>
    Number(value(b, "totalResult") > 0) - Number(value(a, "totalResult") > 0) || value(b, "bustCount") - value(a, "bustCount"))[0];
  if (bustSubject) stories.push({ id: "bust", priority: 93, options: bustStoryOptions(bustSubject) });
  for (const [i, p] of pairs.entries()) stories.push({ id: `pair/${p.id}`, priority: input.pairLead && i === 0 ? 99 : 82 - i, options: [{ id: p.id, text: p.text }] });
  for (const note of titleNotes) stories.push({ id: `title/${note.subject.id}`, priority: 85, options: [{ id: `title/${note.subject.id}`, text: note.text }] });
  const closings = topNames.length === 1 ? [
    `この日、卓のトップを取ったのは${topNames[0]}だけだった。${games.length}戦の結果に共通するこの事実は、一日を象徴している。追う側にとっては、次の対局でまず一勝を返したいところだ。`,
    `全${games.length}戦のトップは${topNames[0]}が占めた。他の選手にとっては厳しい結果だが、次に同じ顔ぶれで卓を囲んでも結果が決まっているわけではない。再び競う日の成績にも目を向けたい。`,
  ] : [
    `${games.length}戦でトップを分け合ったのは${topNames.length}人。日次収支の先頭と、それぞれの卓で勝利を手にした選手は、必ずしも同じ顔ぶれだけではない。一日の主役に加え、各選手が残した成果も覚えておきたい。`,
    `この日は${games.length}戦の中で${topNames.length}人がトップを獲得した。最終収支で先頭に立った選手にも、別の対局で勝利を残した選手にも、それぞれ語るべき結果がある。次の開催日にも、また違う一日が待っている。`,
    `トップ獲得者は${topNames.length}人となった。${games.length}戦を通した日次成績と、一戦ごとの勝利。その両方を振り返ると、首位の名前だけでは収まらない${subjects.length}人の一日が見えてくる。`,
    `${subjects.length}人が競った${games.length}戦は、${topNames.length}人がトップを持ち帰る結果だった。収支の合計、出場数、対局ごとの順位。それぞれの成果を残して、この日の対局を終えている。`,
  ];
  const rich = games.length >= 8 && stories.length >= 10;
  const target = games.length < 3 ? 450 : games.length < 4 ? 700 : rich ? 1420 : 1000;
  const limit = games.length < 3 ? 650 : games.length < 4 ? 850 : rich ? 1550 : 1200;
  const closing = desk("report/closing", "edition", options("closing", closings))!.text;
  let length = paragraphs.join("").length + closing.length;
  const sorted = stories.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const story of sorted) {
    if (used.has(story.id)) continue;
    // 段落を途中で切らない。重要な話題の後は、字数の目標に達した時点で止める。
    if (length >= target && story.priority < 85) continue;
    const available = story.options.filter(o => length + o.text.length <= limit);
    if (!available.length) continue;
    const before = paragraphs.length;
    pick({ ...story, options: available });
    if (paragraphs.length > before) length += paragraphs.at(-1)!.length;
  }
  paragraphs.push(closing);
  return paragraphs;
}

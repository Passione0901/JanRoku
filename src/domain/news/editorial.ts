import type { NewsSubject } from "./facts";
import { result } from "../../utils/format";

export interface CopyOption {
  id: string;
  text: string;
}
export interface InterviewOption {
  id: string;
  question: string;
  answer: string;
}
export function copyHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// 最終更新: 2026-09-12 — 文型を号内で消費し、開催日ごとに巡回。同じ号の再読では変更しない。
export function createCopyDesk(groupId: string, editionIndex: number) {
  const used = new Set<string>();
  return <T extends { id: string }>(
    section: string,
    subjectId: string,
    options: T[],
  ): T | undefined => {
    if (!options.length) return undefined;
    const offset =
      (copyHash(`${groupId}/${section}/${subjectId}`) + editionIndex) %
      options.length;
    for (let i = 0; i < options.length; i++) {
      const item = options[(offset + i) % options.length];
      const key = `${section}/${item.id}`;
      if (used.has(key)) continue;
      used.add(key);
      return item;
    }
    return undefined;
  };
}

export function playerLineOptions(s: NewsSubject): CopyOption[] {
  const f = s.facts,
    n = s.name,
    games = Number(f["player.gamesPlayed"]),
    top = Number(f["player.topCount"]),
    second = Number(f["player.secondCount"]),
    total = Number(f["player.totalResult"]);
  const pt = result(total);
  const lines: CopyOption[] = [];
  const add = (key: string, texts: string[]) =>
    texts.forEach((text, i) => lines.push({ id: `${key}-${i}`, text }));
  if (top === games && games >= 2)
    add("sweep", [
      `${n}、${games}戦全勝。短い出場でも、主役級の足跡。`,
      `${n}、出場した${games}戦をすべて制す。次は追われる側の楽しみが待つ。`,
      `${n}、${games}戦${top}勝。勝利の取りこぼしはゼロ。`,
      `${n}、全${games}戦でトップ。拍手の独占は今日だけ許されたい。`,
    ]);
  else if (top >= 2)
    add("wins", [
      `${n}、${games}戦で${top}勝。勝利の味を一度で忘れなかった。`,
      `${top}度トップを取った${n}。日次${pt}ptに、主役の出番を刻む。`,
      `${n}、トップ${top}回。相手に譲るばかりでは終わらない。`,
      `${n}、${games}戦で${top}度の一番乗り。勝ち星にも存在感。`,
    ]);
  else if (top === 1)
    add("win", [
      `${n}、${games}戦で一勝を持ち帰る。日次${pt}ptにも勝利の手触り。`,
      `${n}、トップは一度。主役を務めた一戦がある。`,
      `${n}、一勝を手に日次${pt}pt。次は勝利のおかわりを。`,
      `${n}、${games}戦でトップを一つ。次回はもう一度、あの順位へ。`,
    ]);
  else if (second > 0)
    add("runner", [
      `${n}、2位${second}回。次の取材では頂点の話も聞きたい。`,
      `${n}、今回はトップなし、2位${second}回。勝利の順番待ちは次で終えたい。`,
      `${n}、日次${pt}pt。2位${second}回の先に、次は一勝を。`,
      `${n}、2位を${second}回記録。次回の希望色は金。`,
    ]);
  const starts = [
    `${n}、${games}戦で${pt}pt。`,
    `${games}戦を戦った${n}、日次${pt}pt。`,
    `${n}の一日は${pt}pt。`,
    `${n}、今回の収支は${pt}pt。`,
  ];
  const ends =
    total > 0
      ? [
          "プラスを胸に、次の勝負へ。",
          "次も勝利の話題で取材を受けたい。",
          "ごほうびは喜びすぎない程度に。",
          "今日は胸を張ってよし。",
          "次の目標まで小さくする必要はない。",
          "期待される側の準備もしておきたい。",
        ]
      : total < 0
        ? [
            "次は祝福される側を目指したい。",
            "雪辱の理由なら十分にある。",
            "次回作では主役を取りにいく。",
            "この一日で選手評を終わらせたくない。",
            "次は笑える結末を。",
            "反省はほどほどに、次の勝負へ。",
          ]
        : [
            "次はプラス側の話題で登場したい。",
            "成果の続きは次の対局で。",
            "お疲れさまの拍手まではゼロにしない。",
            "次の見せ場をお待ちしています。",
            "勝負の物語はここで終わらない。",
            "次回予告は、まだこれから。",
          ];
  starts.forEach((start, i) =>
    ends.forEach((end, j) =>
      lines.push({ id: `general-${i}-${j}`, text: start + end }),
    ),
  );
  // 先頭の成績固有候補は編集側で優先する。広い候補は人数が多い号の補完に使う。
  return lines;
}

// 架空の回答のみ。実際の戦術・役・発言・時間順は付け足さない。
export function interviewOptions(s: NewsSubject): InterviewOption[] {
  const f = s.facts,
    games = Number(f["player.gamesPlayed"]),
    top = Number(f["player.topCount"]),
    total = Number(f["player.totalResult"]);
  const options: InterviewOption[] = [];
  const add = (key: string, pairs: string[][]) =>
    pairs.forEach(([question, answer], i) =>
      options.push({ id: `${key}-${i}`, question, answer }),
    );
  if (top === games && games >= 2)
    add("all-wins", [
      [
        "出場した全戦でトップでした。",
        "短編でも主演賞は狙える、と証明した気分です。",
      ],
      ["全勝の感想を。", "次回の自分に、とても説明しづらい期待を残しました。"],
      [
        "次はどう戦いますか？",
        "全勝の人、という紹介が恥ずかしくならないように。まずは一戦ずつです。",
      ],
      [
        "相手選手にひとこと。",
        "また対戦してください。今日の結果を忘れず、対策は忘れていただければ。",
      ],
    ]);
  else if (top >= 2)
    add("multi-wins", [
      [
        `トップ${top}回でしたね。`,
        "一度で満足する予定でしたが、勝つと予定が変わりますね。",
      ],
      [
        "複数の勝利をどう評価しますか？",
        "ごほうびを一回にまとめられないか、それだけ少し心配です。",
      ],
      [
        "次も勝利を重ねられますか？",
        "意気込みはあります。保証書の発行はしていません。",
      ],
      [
        "今日の自分に何を？",
        "よく勝った、と。次の自分にも聞こえるくらいの声で。",
      ],
    ]);
  else if (total > 0)
    add("positive", [
      [
        "プラスの成績を残しました。",
        "褒めていただける時間帯に取材してもらえて助かります。",
      ],
      [
        "次の目標は？",
        "勝って謙虚になることです。順番はそのままでお願いします。",
      ],
      ["この成果をどう喜びますか？", "控えめに、何度も喜ぶ予定です。"],
      [
        "次も期待していいですか？",
        "期待は大きく、失敗した時の声は小さくお願いします。",
      ],
    ]);
  else if (total < 0)
    add("negative", [
      [
        "次戦への意気込みを。",
        "今日の分まで、とは言いません。まずは胸を張れる一戦を。",
      ],
      [
        "いま欲しい見出しは？",
        "復活。まだ予約の段階ですが、よろしくお願いします。",
      ],
      [
        "今日の結果を受けてひとこと。",
        "次回、同じ質問を別の意味でしてもらいたいです。",
      ],
      [
        "次はどんな取材に？",
        "励ましをいただく会から、お祝いをいただく会に変えたいですね。",
      ],
    ]);
  add("open", [
    [
      "次回の目標をお願いします。",
      "期待以上、と言えるように。期待の高さは後で相談させてください。",
    ],
    [
      "ライバルにひとこと。",
      "また会いましょう。仲良くするのは勝負の前と後で。",
    ],
    [
      "今後の抱負は？",
      "自分の紹介文が、毎回少し格好よくなるように頑張ります。",
    ],
    [
      "記者にお願いはありますか？",
      "次に活躍したときも、今日くらい熱心に取材してください。",
    ],
    [
      "選手としての目標は？",
      "対戦相手に「またこの人か」と、いい意味で思ってもらいたいです。",
    ],
    [
      "次の対戦相手への言葉を。",
      "手加減は要りません。こちらが先に強くなる予定なので。",
    ],
    [
      "今後の自分にひとこと。",
      "取材で言ったことを、次の対局まで忘れないでください。",
    ],
    [
      "ここからどう進みますか？",
      "大きなことは言えます。実行の方も追いつかせたいですね。",
    ],
    [
      "勝負の前に決めたいことは？",
      "格好いい勝利コメントです。出番が来るように頑張ります。",
    ],
    [
      "応援へのメッセージを。",
      "拍手の準備だけお願いします。使いどころはこちらで作ります。",
    ],
    [
      "どんな選手になりたいですか？",
      "取材が来たときに、反射的に逃げなくていい選手です。",
    ],
    [
      "次は何を見せたいですか？",
      "口だけで終わらないところを。いまは口でしか伝えられませんが。",
    ],
    [
      "これからの楽しみは？",
      "今日とは違う結末を、また同じ相手と作れることです。",
    ],
    [
      "自分の将来に期待していますか？",
      "一番近くで応援しています。注文も少し多めです。",
    ],
    [
      "次に会うときは？",
      "できれば祝福から始めてください。それに合う結果を目指します。",
    ],
    [
      "選手としてひとこと。",
      "話がうまいだけで記事にならないよう、対局の方も頑張ります。",
    ],
    ["自分への課題は？", "目標を語る時の強さを、対局にも持ち込むことです。"],
    ["意気込みを短く。", "次はやります。短くすると、逃げ道も減りますね。"],
    [
      "ライバルを意識しますか？",
      "もちろん。向こうにもこちらを意識させたいです。",
    ],
    [
      "次の出場へ向けて。",
      "期待の分だけ席を温めておいてください。結果は自分で持ってきます。",
    ],
  ]);
  return options;
}

export function playerParagraphOptions(s: NewsSubject): CopyOption[] {
  const f = s.facts,
    n = s.name,
    games = Number(f["player.gamesPlayed"]),
    top = Number(f["player.topCount"]),
    second = Number(f["player.secondCount"]),
    last = Number(f["player.lastCount"]),
    total = result(Number(f["player.totalResult"]));
  const third = games - top - second - last,
    average = ((top + 2 * second + 3 * third + 4 * last) / games).toFixed(2);
  const resultPhrase =
    top === games
      ? `出場した${games}戦をすべて制した。`
      : top
        ? `${games}戦で${top}回のトップを獲得した。`
        : `${games}戦でトップには届かなかった。`;
  return [
    {
      id: "athlete-wins",
      text: `${n}は${resultPhrase}日次収支は${total}pt。${top === games ? "全勝という成果は、出場数の多寡とは別に評価したい。" : `2位は${second}回だった。勝利数と合計収支、その両方から今回の成果を捉えたい。`}`,
    },
    {
      id: "athlete-average",
      text: `平均順位から目を向けると、${n}は${average}位だった。${games}戦で日次${total}pt。1位${top}回、2位${second}回、3位${third}回、4位${last}回という内訳が、この一日の成績を形づくった。`,
    },
    {
      id: "athlete-participation",
      text: `${games}戦に出場した${n}は、日次${total}ptとなった。${resultPhrase}${last === 0 ? "4位は一度もなく、ラスなしという点にも触れておきたい。" : `4位は${last}回。次はどんな順位を重ねるか、引き続き注目したい。`}`,
    },
    {
      id: "athlete-top-two",
      text: `${n}は${games}戦のうち${top + second}戦で2位以内に入った。トップ${top}回、2位${second}回で、日次収支は${total}pt。${top + second === games ? "すべての出場対局で連対したという成果も残った。" : "合計の大小だけでは伝わらない、上位に入った回数にも目を向けたい。"}`,
    },
    {
      id: "athlete-result",
      text: `日次${total}ptの${n}にも触れておきたい。${resultPhrase}平均順位は${average}位。${top > 0 ? "トップを取った成果と一日の収支を合わせて、この日の活躍を振り返りたい。" : "今回は勝利に届かなかったが、次の対局まで評価を決めつける必要はない。"}`,
    },
    {
      id: "athlete-next",
      text: `${n}の成績は、${games}戦で${total}ptだった。トップ${top}回、2位${second}回を記録し、平均順位は${average}位。次回、この戦績にどんな勝負が続くのか。また違った見せ場が生まれることを期待したい。`,
    },
  ];
}

// 最終更新: 2026-09-12 — 順位だけで物語を固定せず、出場数・勝利数・同点の違いを比較へ反映。
export function comparisonOptions(
  a: NewsSubject,
  b: NewsSubject,
): CopyOption[] {
  const af = a.facts,
    bf = b.facts,
    at = result(Number(af["player.totalResult"])),
    bt = result(Number(bf["player.totalResult"]));
  const ag = Number(af["player.gamesPlayed"]),
    bg = Number(bf["player.gamesPlayed"]),
    aw = Number(af["player.topCount"]),
    bw = Number(bf["player.topCount"]);
  const gap =
    (Math.round(Number(af["player.totalResult"]) * 10) -
      Math.round(Number(bf["player.totalResult"]) * 10)) /
    10;
  const ties = gap === 0;
  const outcome = ties
    ? `${a.name}と${b.name}が${at}ptで首位に並んだ。`
    : `日次首位の${a.name}は${at}pt、2番手の${b.name}は${bt}pt。差は${gap}ptだった。`;
  const participation =
    ag === bg
      ? `両者とも${ag}戦を戦い、トップ数は${aw}回と${bw}回。`
      : `出場数はそれぞれ${ag}戦と${bg}戦で、合計の差には対局数の違いもある。`;
  const sweep = [a, b]
    .filter(
      (s) =>
        Number(s.facts["player.gamesPlayed"]) >= 2 &&
        s.facts["player.topCount"] === s.facts["player.gamesPlayed"],
    )
    .map(
      (s) =>
        `${s.name}は出場${s.facts["player.gamesPlayed"]}戦すべてでトップを取った。`,
    )
    .join("");
  return [
    { id: "standing", text: outcome + participation + sweep },
    {
      id: "wins",
      text: `上位二人の勝利数にも目を向けたい。${a.name}は${ag}戦で${aw}勝、${b.name}は${bg}戦で${bw}勝だった。${outcome}${sweep}`,
    },
    {
      id: "challenger",
      text: `${b.name}は${bg}戦で${bt}ptを獲得した。${ties ? `${a.name}も${at}ptで、日次収支では同率の首位となった。` : `${a.name}の${at}ptには${gap}pt届かなかったが、日次収支では2番手に入った。`}${participation}${sweep}`,
    },
    {
      id: "workload",
      text: `${a.name}と${b.name}の成績を、出場数と合わせて振り返る。${a.name}は${ag}戦で${at}pt、${b.name}は${bg}戦で${bt}ptだった。${ties ? "収支は同じでも、それぞれの一日に勝負があった。" : `合計では${a.name}が${gap}pt上回った。`}${sweep}`,
    },
  ];
}

export function strugglingGroupOptions(subjects: NewsSubject[]): CopyOption[] {
  const names = subjects
    .map(
      (s) => `${s.name}（${result(Number(s.facts["player.totalResult"]))}pt）`,
    )
    .join("、");
  const noWins = subjects.every(
    (s) => Number(s.facts["player.topCount"]) === 0,
  );
  const detail = noWins
    ? "今回はいずれもトップに届かなかった。"
    : "勝利数や出場回数も違う、それぞれの苦戦だった。";
  return [
    {
      id: "setback",
      text: `${names}は、大きなマイナスが残る一日となった。${detail}次は誰が巻き返しの主役になるのか。今回の結果を受けた、次の対局にも注目したい。`,
    },
    {
      id: "challenge",
      text: `次戦での雪辱を期待したいのは、${names}。${detail}それぞれ大きなマイナスを残したが、一日の結果だけで選手の評価を閉じる必要はない。次は違う話題を届けてほしい。`,
    },
    {
      id: "contrast",
      text: `勝利の話題の一方で、苦しい成績も残った。${names}は大きく収支を落とした。${detail}次の対局では、この中から巻き返しを見せる選手が現れるかにも注目したい。`,
    },
    {
      id: "return",
      text: `${names}にとっては、厳しい収支の一日となった。${detail}今回の苦戦が次の勝負にどうつながるかは、まだ分からない。今度は活躍する側の記事で取り上げたい選手たちだ。`,
    },
  ];
}

// 対局順に依存しない、日全体の見どころ。後日入力の記録でも一対局の収支と勝利数は比較できる。
export function dayHighlightOptions(
  subjects: NewsSubject[],
  games: import("../types").Game[],
): CopyOption[][] {
  if (games.length < 3) return [];
  const highlights: CopyOption[][] = [];
  const maxWins = Math.max(
    ...subjects.map((s) => Number(s.facts["player.topCount"])),
  );
  const leaders = subjects.filter(
    (s) => Number(s.facts["player.topCount"]) === maxWins,
  );
  if (maxWins >= 2 && leaders.length >= 2 && leaders.length <= 4) {
    const names = leaders.map((s) => s.name).join("、"),
      wins = maxWins * leaders.length;
    const share = ((wins / games.length) * 100).toFixed(1).replace(/\.0$/, "");
    highlights.push([
      {
        id: "win-share",
        text: `勝利数では${names}が${maxWins}勝で最多に並んだ。合わせて${wins}勝となり、全${games.length}戦の${share}％のトップを占めた。日次収支では差がついていても、トップを取った回数では肩を並べた選手たちだ。`,
      },
      {
        id: "wins-and-points",
        text: `日次収支とは別に、勝利数の争いもあった。最多は${maxWins}勝で、${names}が並んだ。この${leaders.length}人で全${games.length}戦のうち${wins}勝を挙げている。合計収支の順位とは違う角度から、今回の主役を捉えられる結果だ。`,
      },
      {
        id: "shared-winners",
        text: `最多勝を分け合ったのは${names}だった。それぞれ${maxWins}回のトップを獲得し、合計${wins}勝。全${games.length}戦に占める割合は${share}％となった。収支に違いはあっても、勝利の回数では互いに譲らなかった。`,
      },
    ]);
  }
  const maximum = Math.max(
    ...games.flatMap((g) => g.players.map((p) => p.result)),
  );
  const ids = new Set(
    games.flatMap((g) =>
      g.players.filter((p) => p.result === maximum).map((p) => p.playerId),
    ),
  );
  const peakPlayers = subjects.filter((s) => ids.has(s.id));
  if (maximum > 0 && peakPlayers.length > 0 && peakPlayers.length <= 3) {
    const names = peakPlayers.map((s) => s.name).join("、"),
      pt = result(maximum);
    highlights.push([
      {
        id: "single-result",
        text: `一対局の収支で最大だったのは${pt}pt。この数字を残したのは${names}だ。一日合計の争いと、一戦で生み出した大きなプラスは別の見どころになる。今回の対局を振り返るうえで、取り上げておきたい成果だ。`,
      },
      {
        id: "big-game",
        text: `一戦の収支にも大きな見せ場があった。${names}が残した${pt}ptは、この日の一対局の収支で最大となった。合計の大きさだけでなく、こうした一戦の成果にも注目すると、活躍の見え方が変わってくる。`,
      },
      {
        id: "largest-gain",
        text: `${names}には、一対局で${pt}ptを獲得した成果もある。この日の一戦あたりの収支では最大の数字だった。日次収支とは違う形で存在感を示した一戦として、今回の話題に加えたい。`,
      },
    ]);
  }
  return highlights;
}

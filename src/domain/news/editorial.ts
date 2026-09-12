import type { NewsSubject } from "./facts";
import { result } from "../../utils/format";
import { CopyHistory, type CopyText } from "./repetition";

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
export function createCopyDesk(
  groupId: string,
  editionIndex: number,
  history?: CopyHistory,
) {
  const used = new Set<string>();
  return <T extends CopyText & { id: string; priority?: number }>(
    section: string,
    subjectId: string,
    options: T[],
  ): T | undefined => {
    if (!options.length) return undefined;
    const offset =
      (copyHash(`${groupId}/${section}/${subjectId}`) + editionIndex) %
      options.length;
    const ordered = options
      .map((item, index) => ({
        item,
        distance: (index - offset + options.length) % options.length,
      }))
      .sort(
        (a, b) =>
          (history?.score(`${section}/${a.item.id}`, a.item) ?? -1) -
            (history?.score(`${section}/${b.item.id}`, b.item) ?? -1) ||
          (b.item.priority ?? 0) - (a.item.priority ?? 0) ||
          a.distance - b.distance,
      );
    for (const { item } of ordered) {
      const key = `${section}/${item.id}`;
      if (used.has(key)) continue;
      used.add(key);
      history?.record(key, item);
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

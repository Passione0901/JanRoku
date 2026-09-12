import { copyHash, createCopyDesk } from "./editorial";
import type { Facts } from "./facts";
import type { CopyHistory } from "./repetition";
import { readerVoice } from "./readerVoice";

export interface CommentSource {
  id: string;
  text: string;
  event: string;
  facts: Facts;
}
export interface ReaderMessage {
  id: string;
  author: string;
  text: string;
  likes: number;
}
export interface ReaderThread extends ReaderMessage {
  replies: ReaderMessage[];
}

// 最終更新: 2026-09-12 — 実際の投票数ではなく、話題性・具体性・共感を呼ぶ表現から架空の反響を作る。
export function commentAppeal(comment: CommentSource): number {
  const weight: Record<string, number> = {
    "nemesis-win": 105, "favorite-loss": 95, "title-upset": 115,
    "title-defense": 68, "rival-even": 62, "first-duel": 48,
    "duel-win": 42, "duel-even": 40, "nemesis-loss": 50, "favorite-win": 55,
    "narrow-leader": 90, "all-tops": 100, "three-tops": 80,
    "personal-daily-best": 100, "back-to-positive": 100,
    "latest-turns-positive": 95, "hundred-plus": 85,
    "consecutive-tops": 82, "consecutive-top-two": 62,
    "daily-leader": 65, "no-last": 60, "all-top-two": 60,
  };
  return (weight[comment.event] ?? 22)
    + (/次|期待|応援|拍手|楽しみ/.test(comment.text) ? 10 : 0)
    + (/相性|称号|苦手|勝ち越し/.test(comment.text) ? 8 : 0)
    + (/予約|保証|おかわり|椅子|座布団/.test(comment.text) ? 7 : 0)
    + (/\d/.test(comment.text) ? 4 : 0);
}

// 最終更新: 2026-09-12 — 親のイベントに応答する。実記録にない戦術や発言は追加せず、読者の口調で返信する。
function replyOptions(comment: CommentSource): { id: string; text: string }[] {
  const banks: Record<string, string[]> = {
  "nemesis-win": [
    "分かる。{player.name}、今日はうれしいだろうな。",
    "次の{opponent.name}も気になるね。また打ってほしい。",
    "{opponent.name}を上回れたのは大きい。今日は喜んでいいと思う。",
    "その次は{opponent.name}が返すかもしれないし、続きが楽しみ。",
    "{player.name}やったね。こういう日があるとうれしい。",
    "自分もそこが気になった。{player.name}の次戦も見たい。"
  ],
  "favorite-loss": [
    "今日は{opponent.name}がやったね。これは拍手。",
    "{player.name}も悔しいだろうけど、また次だね。",
    "そうそう。次はどっちが笑うか分からないから面白い。",
    "{player.name}が次に返すところまで見たいな。",
    "{opponent.name}のこういう結果はうれしいね。",
    "次もこの二人が同卓したら注目する。"
  ],
  "title-upset": [
    "{player.name}、やるじゃん。{opponent.name}相手にこの結果はうれしいはず。",
    "分かる。肩書だけで決まらないところが面白いね。",
    "今日は{player.name}を褒めていいと思う。",
    "{opponent.name}もこのままでは終わらなさそう。次が楽しみ。",
    "どっちにも見せ場があると、また見たくなるね。",
    "{player.name}の次の対戦も追ってみる。"
  ],
  "title-defense": [
    "{player.name}、期待されてちゃんと勝つのはいいね。",
    "自分は{opponent.name}の次の挑戦も見たいな。",
    "そうそう。結局その日に結果を出せるかだよね。",
    "勝って当然、で済ませず褒めたい。{player.name}お疲れさま。",
    "{opponent.name}が次に返したら、それも盛り上がりそう。",
    "{player.name}、今回もやったね。次も楽しみ。"
  ],
  "nemesis-loss": [
    "{player.name}が{opponent.name}に返したときは一緒に喜びたいね。",
    "今日は残念だったけど、{player.name}にはまた次がある。",
    "{opponent.name}との再戦、また見たいね。",
    "分かる。次に{player.name}が笑えるといいな。",
    "今度は{player.name}の番かもしれないしね。",
    "次の対戦も応援する。まずはお疲れさま。"
  ],
  "favorite-win": [
    "{player.name}、今回も結果を出したね。",
    "{opponent.name}を上回ったのは立派。今日は拍手。",
    "でも次は分からないし、また同卓してほしい。",
    "{opponent.name}も次は返したいだろうね。",
    "二人の対戦は続けて見ると面白そう。",
    "次は{player.name}が続くか、{opponent.name}が返すかだね。"
  ],
  "first-duel": [
    "{player.name}と{opponent.name}、これから楽しみだね。",
    "まだ一日分だし、次は違う結果もありそう。",
    "今度は{opponent.name}が上回るかもしれないしね。",
    "この二人、また同じ卓で打ってほしいな。",
    "{player.name}、まずはいい結果だったね。",
    "自分も次の顔合わせを楽しみにしてる。"
  ],
  "duel-win": [
    "{player.name}、{opponent.name}に勝ち越しはうれしいだろうな。",
    "今回は{player.name}だったね。{opponent.name}はまた次だ。",
    "そうそう、誰との対戦かが分かるとまた面白い。",
    "今日は{player.name}に拍手。次も楽しみ。",
    "{opponent.name}が次に返す展開も見たくなる。",
    "この二人がまた打ったら注目する。"
  ],
  "even": [
    "上回った回数は同じだったんだね。いい勝負だ。",
    "{player.name}と{opponent.name}、次はどっちだろう。",
    "分かる。五分で終わると続きが見たくなる。",
    "次は一つ多く上回りたいだろうね。二人とも。",
    "収支だけ見ていたから、そこは気づかなかった。",
    "自分も次の同卓を楽しみにしてる。"
  ],
  "leader": [
    "{player.name}、今日は主役だったね。おめでとう。",
    "次は追う側がどう返すかも楽しみ。",
    "まずは{player.name}に拍手だね。",
    "そうだね。次の首位は誰になるかな。",
    "{player.name}が結果を残したのは素直にうれしい。",
    "今度は別の人の見せ場も見たいな。"
  ],
  "wins": [
    "{player.name}、トップを取ったのはうれしいだろうね。",
    "分かる。一勝の喜びはあるよね。",
    "次も簡単には勝てないからこそ、今日の結果は褒めたい。",
    "{player.name}の次の対戦も楽しみ。",
    "出た回数も見るけど、勝った日は喜んでいいと思う。",
    "次は追う側が返すところも見たいな。"
  ],
  "steady": [
    "{player.name}の順位、そこにも見どころがあったんだね。",
    "派手な結果だけじゃないのがいいよね。",
    "今日はこの結果を褒めていいと思う。",
    "{player.name}の一日の見え方がちょっと変わった。",
    "トップ以外の話もあると面白いね。",
    "次も積み重ねてほしい。{player.name}に期待。"
  ],
  "recovery": [
    "{player.name}、戻してきたのはうれしいだろうな。",
    "途中を知ると、最後の数字の見え方も変わるね。",
    "そこから戻せたのはよかった。今日はお疲れさま。",
    "自分もこの巻き返しは印象に残った。",
    "{player.name}の次の対戦も気になるね。",
    "合計だけ見たときより、ぐっときた。"
  ],
  "record": [
    "{player.name}、記録更新おめでとう。",
    "これは素直にうれしいね。今日は拍手。",
    "こういう日はあとからも読み返したくなる。",
    "{player.name}がいい結果を残したの、うれしい。",
    "次を急がず、まずは今日の分を喜んでほしい。",
    "また更新する日が来るのも楽しみだね。"
  ],
  "general": [
    "分かる。次の対戦も楽しみにしてる。",
    "今日を振り返ると、また打ちたくなりそうだね。",
    "自分もそういう楽しみ方は好き。",
    "次はまた違う人の見せ場がありそう。",
    "見るところが違うと、同じ一日でも印象が変わるね。",
    "まずはみんなお疲れさま。また次が楽しみ。"
  ]
};
  let key = comment.event;
  if (["duel-even", "rival-even"].includes(key)) key = "even";
  else if (["daily-leader", "narrow-leader"].includes(key)) key = "leader";
  else if (["all-tops", "three-tops", "latest-top", "consecutive-tops"].includes(key)) key = "wins";
  else if (["no-last", "all-top-two", "second-specialist", "consecutive-top-two"].includes(key)) key = "steady";
  else if (["back-to-positive", "latest-turns-positive", "recovery-still-negative"].includes(key)) key = "recovery";
  else if (key === "personal-daily-best") key = "record";
  if (!banks[key]) key = "general";
  return banks[key].map((text, i) => ({ id: `${key}-${i}`, text }));
}

// 最終更新: 2026-09-12 — 同じ記事は同じ反響に固定。約3分の1に1〜3件の返信を付け、過去10開催日の返信も重複回避する。
export function createReaderThreads(
  comments: CommentSource[], seed: string, editionIndex: number, history?: CopyHistory,
): ReaderThread[] {
  const desk = createCopyDesk(seed, editionIndex, history);
  const likesFor = (text: string, weight: number) =>
    Math.max(1, Math.round(weight * (0.7 + (copyHash(`${seed}/${text}`) % 71) / 100)));
  const threads: ReaderThread[] = comments.map((c, i) => ({
    id: c.id, author: `観戦席の声 ${String(i + 1).padStart(2, "0")}`,
    text: c.text, likes: likesFor(c.text, commentAppeal(c)), replies: [],
  }));
  const active = threads.map((t, i) => ({ i, likes: t.likes })).sort((a, b) => b.likes - a.likes || a.i - b.i)
    .slice(0, Math.ceil(comments.length / 3));
  for (const { i } of active) {
    const parent = threads[i], source = comments[i];
    const count = 1 + copyHash(`${seed}/${source.id}/replies`) % 3;
    for (let j = 0; j < count; j++) {
      const voiceKey = `${seed}/${source.id}/reply-${j}`;
      const options = replyOptions(source).map(option => ({ ...option,
        text: readerVoice(option.text, voiceKey).replace(/\{((?:player|opponent)\.name)\}/g, (_, key: string) => String(source.facts[key] ?? "あの人")),
      }));
      const reply = desk("reader-reply", source.id, options);
      if (!reply) break;
      parent.replies.push({
        id: `${parent.id}/reply-${j}`, author: `観戦席の声 ${String(comments.length + i * 3 + j + 1).padStart(2, "0")}`,
        text: reply.text, likes: likesFor(reply.text, commentAppeal(source) * (0.2 + j * 0.06)),
      });
    }
  }
  return threads;
}

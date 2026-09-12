import { copyHash, createCopyDesk } from "./editorial";
import type { Facts } from "./facts";
import type { CopyHistory } from "./repetition";

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

// 最終更新: 2026-09-12 — 親のイベントに応答する。実記録にない戦術や発言は追加せず、名前には敬称を付ける。
function replyOptions(comment: CommentSource): { id: string; text: string }[] {
  const player = String(comment.facts["player.name"] ?? "注目") + "選手";
  const opponent = String(comment.facts["opponent.name"] ?? "対戦相手") + "選手";
  const banks: Record<string, string[]> = {
    "nemesis-win": [
      `分かります。${player}にとって、苦手な${opponent}への勝ち越しは数字以上にうれしそう。`,
      `ただ、一日で相性が逆転したとは限らないですよね。次の${opponent}との同卓も見届けたいです。`,
      `その視点はなかった。収支だけでなく、誰を上回ったかで${player}の一日の印象が変わりますね。`,
      `${opponent}も次は返したいはず。二人の再戦まで楽しみになりました。`,
      `苦手な相手に上回れた日は喜んでいいと思う。${player}にはまず拍手を送りたい。`,
      `次も${opponent}に勝ち越せたら、また違う見出しになりそうですね。`,
    ],
    "favorite-loss": [
      `まさにそれ。${player}との相性を考えると、${opponent}が上回ったのは面白い結果です。`,
      `過去の相性は保証書ではないですね。今回の${opponent}には拍手したい。`,
      `とはいえ一日だけで得意不得意が入れ替わったわけではないので、次の同卓にも注目ですね。`,
      `${player}が次にどう返すかまで含めて、この対戦は追いたくなります。`,
      `相性どおりに毎回決まらないから面白い。${opponent}の次の対戦も楽しみです。`,
      `勝ち越した${opponent}と、巻き返したい${player}。次は両方の立場で見てしまいそう。`,
    ],
    "title-upset": [
      `肩書の差を知ると、${player}が${opponent}を上回ったことの味わいが変わりますね。`,
      `同感です。上位称号でも勝利が約束されないのが、この組み合わせの面白いところ。`,
      `一日で実力の上下までは決められないけど、今回の${player}はたたえたいです。`,
      `${opponent}が次に返す展開も見たい。追う側と追われる側、どちらにも物語がありますね。`,
      `称号はこれまでの歩み、今日の順位は今日の勝負。両方を見られるのがいいですね。`,
      `この勝ち越しで${player}を覚えました。次の${opponent}との同卓も気になります。`,
    ],
    "title-defense": [
      `上位称号に結果が伴ったのはいいですね。${player}には次も期待したい。`,
      `むしろ追う${opponent}の次の挑戦が気になりました。返せたらうれしい相手ですね。`,
      `肩書だけでなく当日の対戦結果で語れる、という点に同感です。`,
      `勝って当然と言うのは簡単だけど、${player}が実際に勝ち越したのは立派だと思います。`,
      `${opponent}が次に上回ったら、今日の記事と並べて読みたいです。`,
      `追われる側にも毎回の勝負がある。${player}の結果を素直にたたえたい。`,
    ],
    "nemesis-loss": [
      `${opponent}への苦戦が続くからこそ、${player}が勝ち越した日には大きく取り上げてほしいですね。`,
      `この結果だけで${player}の全部を決めたくない、という気持ちです。次の対戦にも期待しています。`,
      `難敵がいると、次に上回る楽しみもある。${opponent}との再戦は見逃せませんね。`,
      `悔しい結果だけど、${player}の次の見せ場まで追いかけたいです。`,
      `今は${opponent}に分があっても、勝負は続きますからね。`,
      `励ましだけでなく、次に${player}が勝ち越した時のお祝いも用意しておきたい。`,
    ],
    "favorite-win": [
      `今回も${player}が上回りましたね。だからこそ${opponent}が次にどう返すか気になります。`,
      `好相性でも結果を出す必要はあるので、${player}の勝ち越しはたたえたいです。`,
      `同感です。ただ、次も同じ結末とは限らないから再戦が楽しみ。`,
      `${opponent}の立場から読むと、次こそ上回りたい相手ですよね。`,
      `二人の関係を追うと、単発の結果とは違う楽しみ方ができますね。`,
      `${player}の継続と${opponent}の反撃、次は両方に注目してみます。`,
    ],
    "first-duel": [
      `${player}と${opponent}の対戦記録、続きが楽しみという点に同感です。`,
      `まだ相性を決めないのがいいですね。一日目の結果だけで得意不得意は分からないので。`,
      `次に同卓した時、${opponent}がどう返すかまで見たくなりました。`,
      `最初の記録を知っておくと、二人の対戦をあとから振り返るのも楽しそう。`,
      `まずは${player}が勝ち越した一日として拍手。これからの対戦も期待します。`,
      `この麻雀会では新しい対戦記録なんですね。次の組み合わせにも注目します。`,
    ],
    "duel-win": [
      `${player}と${opponent}の上位回数を見ると、収支だけとは別の勝負が見えてきますね。`,
      `今回は${player}が上回ったけど、${opponent}の次の反撃も楽しみ、という点に同感です。`,
      `同卓で相手より上位だった回数なんですね。トップ回数とは違う面白さがあります。`,
      `誰と戦ったかが分かると、${player}の勝ち越しもより身近に感じます。`,
      `日次収支だけでなく、${opponent}との対戦にも注目する読み方はいいですね。`,
      `次に${opponent}が上回ったら、このコメントを思い出しそうです。`,
    ],
    "even": [
      `互いに上回った回数が同じ、ということなんですね。収支と別の接戦があるのが面白いです。`,
      `${player}と${opponent}、次はどちらが勝ち越すのか気になりますね。`,
      `同感。五分で終わると、二人の次の同卓まで見たくなります。`,
      `互角という結果だけでも、次に一つ多く上回りたい理由ができますね。`,
      `日次収支が同じという意味ではない点も含めて、違う見方ができるのがいいですね。`,
      `次の対戦でどちらかに傾いたら、この日の五分も効いてきそうです。`,
    ],
    "leader": [
      `${player}の首位に拍手、という気持ちです。追う選手の次の活躍も見たいですね。`,
      `今回の首位をたたえつつ、次も決まったわけではないところが楽しみです。`,
      `勝った選手が注目されるのはいいですね。${player}には次も見せ場を期待します。`,
      `一日の主役がいると振り返りが面白い。次は誰が首位になるかも気になります。`,
      `結果を残した${player}をまずたたえたい、という点は同感です。`,
      `首位を追う側にも次の機会があるので、続きまで楽しみたいです。`,
    ],
    "wins": [
      `${player}のトップ回数に目を向けると、勝利を重ねたことがよく分かりますね。`,
      `同感です。収支とは別に、一戦を制した結果にも拍手したい。`,
      `今回の勝ち星はうれしいですよね。次も自動的に勝てるわけではない分、たたえたいです。`,
      `勝利の数に注目する読み方もいいですね。${player}の次の対戦も楽しみ。`,
      `出場回数もあわせて見たいけど、今回トップを取った成果は確かですね。`,
      `次に追う側がどう返すかも含めて、勝った選手の記事は気になります。`,
    ],
    "steady": [
      `${player}の順位の内訳に注目するところに共感します。収支だけでは見えない成果ですね。`,
      `派手な数字以外にも見どころがある、という話はうなずけます。`,
      `一日だけで打ち方までは分からないけど、今回の順位はたたえたいです。`,
      `順位の積み重ねを見ると、${player}の一日が少し違って見えますね。`,
      `トップの話題だけで終わらないのがいいですね。こういう結果も追いたい。`,
      `次も同じように積み重ねられるかが気になります。${player}に期待。`,
    ],
    "recovery": [
      `${player}の巻き返しを知ると、一日の結末の見え方が変わりますね。`,
      `途中からどう戻したかが分かるのは面白い。最後の合計だけとは違いますね。`,
      `苦しい場面があった分、今回の回復はうれしいだろうなと思いました。`,
      `同感です。具体的な打ち筋は分からなくても、巻き返した結果はたたえたい。`,
      `こういう一日の振り返りがあると、${player}の次の対戦も気になります。`,
      `合計だけ読んだ時より印象に残りました。経過も含めて見るのはいいですね。`,
    ],
    "record": [
      `${player}の記録更新はうれしい話題ですね。次の自分に追う目標ができた感じがします。`,
      `過去の同じ条件の日と比べているんですね。今回の成果に拍手したいです。`,
      `記録が更新された日の記事は、あとで読み返すのも楽しそう。`,
      `今回の数字を残した${player}をたたえたい、という点に同感です。`,
      `次の更新まで急がず、この日の成果を喜んでいいと思います。`,
      `新しい目標ができたという読み方もいいですね。今後の結果にも期待します。`,
    ],
    "general": [
      `その見方もいいですね。一日の数字だけで選手の評価を決めず、次の対戦も楽しみたいです。`,
      `今回を振り返りつつ、次の勝負にも期待するというところに共感しました。`,
      `結果だけでなく、選手を応援する読み方があるのはいいですね。`,
      `一日で物語が終わらないということですね。次は違う選手の見せ場も見たいです。`,
      `出場回数や対戦相手も違うので、いろいろな角度で読めるのは面白いです。`,
      `今回の成果はたたえ、悔しさは次へ。そういう楽しみ方で追っていきたいです。`,
    ],
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
      const reply = desk("reader-reply", source.id, replyOptions(source));
      if (!reply) break;
      parent.replies.push({
        id: `${parent.id}/reply-${j}`, author: `観戦席の声 ${String(comments.length + i * 3 + j + 1).padStart(2, "0")}`,
        text: reply.text, likes: likesFor(reply.text, commentAppeal(source) * (0.2 + j * 0.06)),
      });
    }
  }
  return threads;
}

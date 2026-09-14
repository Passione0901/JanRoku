import type { HighlightEvent } from './highlights';
import type { NewsEdition } from './edition';
import type { NewsSource, NewsSubject } from './facts';
import type { CommentSource } from './discussion';
import { createCopyDesk } from './editorial';
import type { CopyHistory } from './repetition';

const labels: Record<string,string> = {yakuman:'役満',sanbaiman:'三倍満',baiman:'倍満',haneman:'跳満',mangan:'満貫'};
const questions = [
  '{topics}について、今の感想を聞かせてください。',
  '{topics}を振り返って、どんな一日になりましたか。',
  '{topics}が出ました。この日の和了をどう振り返りますか。',
  '{topics}について、対局を終えた今の気持ちは。',
  '{topics}が印象に残りました。ご自身の言葉で振り返ると。',
  '{topics}があった一日でした。最後にひと言お願いします。',
  '{topics}を決めました。今日をひと言で表すと。',
  '{topics}を持ち帰る一日になりました。次の対局へ向けてひと言。',
  '{topics}について、対局仲間へ伝えたいことは。',
  '{topics}を振り返るなら、どんな言葉が浮かびますか。',
  '{topics}について、喜びのひと言をお願いします。',
  '{topics}があった今日の対局、何と名付けますか。',
];
const answers = [
  'うれしいですね。今日はこの和了を素直に喜びたいです。',
  '忘れられない一日になりました。また卓を囲むのが楽しみです。',
  'いい思い出ができました。次の対局はまた一局ずつ大事にしたいです。',
  '今はうれしさが大きいです。次も同じようにいくとは思わずに打ちたいですね。',
  '今日の和了はしばらく覚えていそうです。次に打つ日も楽しみです。',
  '今日は喜んで帰れます。また皆さんと一緒に打ちたいですね。',
  '「いい一日」ですね。しばらくは話の種にさせてもらいます。',
  '今日の分は今日の分として、次も楽しんで打ちたいです。',
  'また一緒に打ちましょう、と言いたいです。次も楽しみにしています。',
  'まずは「うれしい」です。うまい言葉は帰り道に考えます。',
  '思い出すと顔が緩みますね。今日は少しだけ自慢させてください。',
  '「忘れたくない一日」でお願いします。大切な思い出にします。',
];
const reactions = [
  '{name}、{topics}はすごい。こういう和了が見られるとうれしい。',
  '{topics}を決めた{name}に拍手。これは記憶に残りそう。',
  '{name}の{topics}、その場で見てみたかった。',
  '{name}、{topics}おめでとう。次に会ったら話を聞きたいな。',
  '{topics}が出た{name}の一日、これは忘れられないだろうね。',
  '{name}の{topics}にびっくり。こういう和了は何度でも見たい。',
  '{name}、{topics}とは。今日はその話を聞くだけでも楽しい。',
  '{topics}があった{name}、これは土産話になるね。',
  '{name}選手の{topics}に拍手したい。自分もいつか経験してみたいな。',
  '{topics}の{name}、おめでとう。こういう日があるからまた打ちたくなる。',
  '{name}の{topics}が気になった。次に卓を囲む日も楽しみ。',
  '{name}、{topics}は忘れられそうにないね。いい一日だったんだろうな。',
];

// Updated 2026-09-15: Reserve coverage per player, independently of the rotating optional section slots.
export function coverMajorHighlights(
  events: HighlightEvent[], draft: Pick<NewsEdition,'members'>, source: NewsSource,
  subjects: NewsSubject[], gameNumbers: Map<string,number>, comments: CommentSource[],
  history: CopyHistory, editionIndex: number,
) {
  const groups=new Map<string,HighlightEvent[]>();
  for(const event of events)if(event.editorial==='required'){
    const group=groups.get(event.playerId)??[]; group.push(event); groups.set(event.playerId,group);
  }
  const desk=createCopyDesk(source.groupId,editionIndex,history);
  const reserved:CommentSource[]=[];
  for(const [playerId,group] of groups){
    const member=draft.members.find(m=>m.id===playerId),subject=subjects.find(s=>s.id===playerId);
    if(!member||!subject)continue;
    const topics=[...new Set(group.map(e=>{
      const milestone=e.milestone?e.description.split('。').find(s=>s.startsWith('本人にとって初めて'))?.replace('本人にとって',''):null;
      const label=milestone??labels[e.event]??'和了';
      return `第${gameNumbers.get(e.gameId)}戦の${label}`;
    }))].join('、');
    const fill=(s:string)=>s.replace(/\{(topics|name)\}/g,(_,key:string)=>key==='topics'?topics:subject.name);
    const interviews=questions.map((q,i)=>({id:`major-interview-${i}`,question:fill(q),answer:answers[i]}));
    // Reuse prose only after the bank is exhausted; history rotation must never suppress a major fact.
    const interview=desk('major-interview',playerId,interviews)??interviews[editionIndex%interviews.length];
    member.question=interview.question;member.answer=interview.answer;
    const options=reactions.map((text,i)=>({id:`major-reader-${i}`,text:fill(text)}));
    const reader=desk('major-reader',playerId,options)??options[editionIndex%options.length];
    reserved.push({id:`${reader.id}/${playerId}`,text:reader.text,event:'highlight-major',facts:{...subject.facts,'highlight.points':Math.max(...group.map(e=>e.points))}});
  }
  // Keep the usual comment count, but never replace one reserved player with another.
  comments.splice(0,Math.min(reserved.length,comments.length),...reserved);
}

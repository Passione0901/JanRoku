import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../src/content/daily-news/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name,root),'utf8'));
const write = (name, value) => writeFileSync(new URL(name,root),JSON.stringify(value,null,2)+'\n');
// Updated 2026-09-14: Authored phrase banks combine different editorial angles, not substituted names or scores.
const events = ['yakuman','sanbaiman','baiman','haneman','mangan','double-riichi-ippatsu','riichi-ippatsu','riichi-tsumo','comeback','win'];
const labels = ['役満','三倍満','倍満','跳満','満貫','ダブルリーチ一発ツモ','リーチ一発ツモ','リーチツモ','逆転の和了','和了'];
const headlines = [
  '一撃の見せ場、{player.name}選手の$に注目',
  '{player.name}選手が$、この日の勝負に残した一場面',
  '$で存在感を示した{player.name}選手、その一手を振り返る',
];
const news = [
  '$の場面がこの日の話題に。{highlight.description}。',
  '{highlight.description}。{player.name}選手の$を、一日の見せ場として取り上げたい。',
  '注目の和了を振り返る。{highlight.description}。$という成果が残った。',
];
const summaries = [
  '{player.name}、$で今日の名場面に名乗り。',
  '$を決めた{player.name}。編集部の拍手は少し長め。',
  '{player.name}の$。一日の思い出に、しっかり一席。',
  '$の{player.name}、本日の見せ場に自分の名前を刻む。',
  '{player.name}に$の一幕。振り返りの主役候補に。',
  '$を持ち帰った{player.name}。土産話には困らなそう。',
  '{player.name}の$、次に会うときの話題がひとつ増えた。',
  '$の一手を残した{player.name}。今日の一場面に拍手。',
  '{player.name}、$で印象に残る和了。余韻も立派な戦利品。',
  '$が光った{player.name}。この場面だけでも語りたくなる。',
];
const questions = [
  '$の場面を一言で振り返ると？', '$を決めた自分に声をかけるなら？', '$の一手に見出しを付けるなら？',
  '$の思い出を持ち帰るとしたら？', '$を祝うなら、何を用意しますか？', '$の場面を何度も思い出しそうですか？',
  '$を決めた今日を記念日にするなら？', '$の話を次にするとき、長くなりそうですか？', '$の記念品を作るなら？', '$の場面を楽しんだ読者へ一言。',
];
const answers = [
  '「ここだけもう一回」が許されるなら、お願いしたいですね。',
  'よくやった、でも次の自分に無茶な注文はしないで、と伝えます。',
  '「本日の思い出、ひとつ確保」でお願いします。大きさは編集部に任せます。',
  '荷物には入りませんが、帰り道の話題には持っていけます。',
  'まずは飲み物で。点棒をろうそく代わりにするのはやめておきます。',
  '思い出す権利だけは、しばらく更新し続けたいです。',
  '祝日までは求めません。自分の中で小さく祝います。',
  '短く話す練習はします。成功するかは別の話です。',
  '置き場所に困らないサイズで。気持ちの中では大きく飾ります。',
  '拍手はありがたく受け取ります。次の分まで前借りはしません。',
];
const articles = [
  'この日の$にも目を向けたい。{highlight.description}。一日の合計だけでは伝わりきらない、和了の場面である。半荘全体の結果と、一手の見せ場。その両方を振り返ることで、{player.name}選手の一日がより具体的に見えてくる。',
  '$という見せ場を残したのは{player.name}選手だ。{highlight.description}。対局を振り返る際には、勝敗の結末とともにこうした一手も残しておきたい。ひとつの和了で一日のすべてを評価することはできないが、取り上げる価値のある場面だった。',
  '成績の集計とは別に、$の一幕を紹介する。{highlight.description}。{player.name}選手にとって、この日は具体的な和了の場面を伴う一日となった。最終的な収支と対局中の出来事を分けて読むことで、勝負の見せ場を追うことができる。',
  '{highlight.description}。この$は、{player.name}選手の対局を語るうえで欠かせない一場面だ。もちろん、この和了だけをもって一日全体の勝因とすることはできない。それでも、個々の半荘に目を向ける楽しさが伝わる話題である。',
  '今回の$は、{player.name}選手が残した和了の記録だ。{highlight.description}。一日の総括には合計収支が欠かせないが、選手の名前とともに思い出すのは具体的な一手でもある。結果を支える数多くの場面のうち、今回はこの和了を振り返った。',
  'この日の見せ場をたどると、{player.name}選手の$が挙がる。{highlight.description}。麻雀は一手だけで終わる競技ではない。それでも、振り返りの中にこうした具体的な場面が加われば、一日の勝負を違う角度から楽しむことができる。',
  '{player.name}選手の$を、一日のハイライトとして取り上げる。{highlight.description}。和了に至る打牌や心境までを知ることはできないが、残された出来事は明確だ。ここではその成果に焦点を当て、半荘全体の成績と合わせて振り返りたい。',
  '$という成果が、この日の{player.name}選手に加わった。{highlight.description}。合計収支の大小だけでなく、どのような和了があったのかにも目を向けると、観戦の楽しみは広がる。この一場面は、そのための具体的な手掛かりとなる。',
  '一日の勝負を場面ごとに振り返る。今回は{player.name}選手の$だ。{highlight.description}。和了そのものの価値と、一日を通した成績はそれぞれに見る必要がある。その二つを混同せずに追うことで、この日の対局をより丁寧に味わえる。',
  '{highlight.description}。$の場面を残した{player.name}選手には、この一手に対する拍手を送りたい。一日の成績には複数の対局が関わるが、見せ場はそれぞれの半荘にもある。今回の振り返りには、その一例としてこの和了を加えた。',
  '話題の$は、{player.name}選手によるものだ。{highlight.description}。結果だけを短く並べると通り過ぎてしまう場面にも、対局を振り返る楽しみがある。今回取り上げた和了は、選手の一日を具体的な出来事として伝える材料となった。',
  'この日の$をもう一度振り返っておこう。{highlight.description}。{player.name}選手の一日には、集計された成績とともにこの場面が残る。対局中のすべてを再現するものではないが、見せ場を知ることで結果の読み方にも広がりが生まれる。',
  '{player.name}選手が残した$の一手に注目する。{highlight.description}。好成績の選手だけに見せ場があるわけではなく、ひとつの和了にはそれ自体の価値がある。今回は一日全体の評価から少し視点を移し、この場面を取り上げた。',
  '$をめぐる一幕も、この日の振り返りに加えたい。{highlight.description}。{player.name}選手の名前とともに、具体的な出来事が残った。次の対局を予言する材料ではないが、今回の勝負を思い出すときの話題にはなるだろう。',
  'ここで、{player.name}選手の$にも触れておきたい。{highlight.description}。一日を振り返るうえでは、順位や収支のほかにも残しておきたい場面がある。ここで紹介した和了は、そのひとつとして今回の勝負に彩りを添えている。',
];
const readerOpen = [
  '{player.name}の$、これは拍手したい。', '$を決めた{player.name}、おめでとう。', '{player.name}、$はいい思い出になりそう。',
  '$の場面、{player.name}のところを読み返した。', '{player.name}の$だけでも今日の話題になるね。', '$を残した{player.name}、帰り道でも思い出しそう。',
  '{player.name}の$、自分だったら誰かに話したくなる。', '$の{player.name}に今日は一票。', '{player.name}選手の$に素直に拍手。',
  '$で見せ場を作った{player.name}、記念に何か食べたくなりそう。', '{player.name}の$、こういう話があると対局が身近になる。', '$の話題なら{player.name}にも聞いてみたい。',
  '{player.name}の$を知って、また麻雀を打ちたくなった。', '$を決めた{player.name}の話、ちょっと羨ましい。', '{player.name}の$、記念写真を撮りたくなる種類の思い出。',
  '$の場面を残した{player.name}、今回は覚えておこう。', '{player.name}選手、$の和了おめでとうございます。', '$を決めた{player.name}、今夜の土産話はこれかな。',
  '{player.name}の$。こういう一手を自分も経験したい。', '$の{player.name}、その場面は見てみたかった。',
];
const readerClose = ['次の対局にも見せ場があるといいな。','一日の合計とは別に、この和了には拍手を送りたい。','でも同卓する側になると、なかなか複雑な気持ちになりそう。'];
const plan = [['headlines.json','headline',3],['daily-news.json','news',3],['member-summaries.json','summary',10],['fictional-interviews.json','interview',10],['article-paragraphs.json','article',15],['fictional-reader-comments.json','reader',60]];
const contract = read('fact-contract.json');
Object.assign(contract.facts, {'highlight.valid':{type:'boolean'},'highlight.event':{type:'string'},'highlight.description':{type:'string'},'highlight.points':{type:'number',minimum:0}});
write('fact-contract.json',contract);
const schema=read('template.schema.json');
for(const event of events) if(!schema.$defs.template.properties.event.enum.includes('highlight-'+event)) schema.$defs.template.properties.event.enum.push('highlight-'+event);
if(!schema.$defs.template.properties.topic.enum.includes('highlight'))schema.$defs.template.properties.topic.enum.push('highlight');
write('template.schema.json',schema);
for(const[file,kind,count]of plan){
  const catalog=read(file); catalog.templates=catalog.templates.filter(t=>t.topic!=='highlight');
  for(let e=0;e<events.length;e++)for(let i=0;i<count;i++){
    const event='highlight-'+events[e];
    let text,question,answer;
    if(kind==='interview'){question=questions[i];answer=answers[i];}
    else text=kind==='headline'?headlines[i]:kind==='news'?news[i]:kind==='summary'?summaries[i]:kind==='article'?articles[i]:readerOpen[Math.floor(i/3)]+readerClose[i%3];
    const sub=s=>s?.replaceAll('$',labels[e]);text=sub(text);question=sub(question);answer=sub(answer);
    const holes=[...new Set(((text??'')+(question??'')+(answer??'')).match(/\{[\w.]+\}/g)?.map(x=>x.slice(1,-1))??[])].sort();
    const all=[{fact:'context.dataScope',op:'eq',value:'unlocked-records'},{fact:'context.factsValidated',op:'eq',value:true},{fact:'context.sameGroup',op:'eq',value:true},{fact:'player.gamesPlayed',op:'gte',value:1},{fact:'highlight.valid',op:'eq',value:true},{fact:'highlight.event',op:'eq',value:events[e]},{fact:'highlight.points',op:'gte',value:0}];
    const requiredFacts=[...new Set(['day.date','player.id','player.name',...holes,...all.map(c=>c.fact)])].sort();
    catalog.templates.push({id:`${kind}.${event}.${String(i+1).padStart(2,'0')}`,event,topic:'highlight',priority:80,conditions:{all},requiredFacts,placeholders:holes,...(kind==='article'?{paragraphRole:'feature'}:{}),...(text?{text}:{question,answer})});
  }
  write(file,catalog);
  console.log(`${file}: ${catalog.templates.length}`);
}

import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../src/content/daily-news/', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name,root),'utf8'));
const write = (name, value) => writeFileSync(new URL(name,root),JSON.stringify(value,null,2)+'\n');
// Updated 2026-09-14: Authored phrase banks combine different editorial angles, not substituted names or scores.
const events = ['yakuman','sanbaiman','baiman','haneman','mangan','double-riichi-ippatsu','riichi-ippatsu','riichi-tsumo','comeback','win'];
const labels = ['役満','三倍満','倍満','跳満','満貫','ダブルリーチ一発ツモ','リーチ一発ツモ','リーチツモ','逆転の和了','和了'];
const headlines = [
  '{player.name}選手が$',
  '{player.name}選手、$を決める',
  '$を決めた{player.name}選手',
];
const news = [
  "{highlight.description}。$が光った。",
  "{player.name}選手が$を決めた。{highlight.description}。",
  "{highlight.description}。{player.name}選手が$で見せ場をつくった。"
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
  "{highlight.description}。{player.name}選手が$で見せ場をつくった。",
  "$を決めたのは{player.name}選手。{highlight.description}。",
  "{highlight.description}。この日の{player.name}選手を印象づける$となった。",
  "{player.name}選手に$が出た。{highlight.description}。",
  "{highlight.description}。$を決めた{player.name}選手は、この日{player.gamesPlayed}戦を戦った。",
  "{player.name}選手の$も光った。{highlight.description}。",
  "{highlight.description}。$を決めた{player.name}選手が存在感を示した。",
  "$で見せ場をつくった{player.name}選手。{highlight.description}。",
  "{highlight.description}。$も決めた{player.name}選手は、この日の{player.gamesPlayed}戦を終え、収支を{player.totalResult}ptとした。",
  "この日は{player.gamesPlayed}戦に出場した{player.name}選手に$が出た。{highlight.description}。",
  "{highlight.description}。$が出たこの一戦も、{player.name}選手の見せ場となった。",
  "和了の場面では{player.name}選手が$を決めた。{highlight.description}。",
  "{highlight.description}。{player.name}選手が$で印象を残した。",
  "{player.name}選手の一日に$の見せ場があった。{highlight.description}。",
  "{highlight.description}。$を決めた{player.name}選手の、この日の収支は{player.totalResult}ptだった。"
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
const readerClose = ['次の対局にも見せ場があるといいな。','これは同卓していたら忘れられないな。','でも同卓する側になると、なかなか複雑な気持ちになりそう。'];
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

import { expect,it } from 'vitest';
import {fixture} from '../../test/fixtures';
import {parseHighlight,parseHighlights} from './highlights';
import {createNewsEdition} from './edition';
import corpus from '../../test/colloquial-highlight-corpus.json';
import reversals from '../../content/daily-news/highlight-reversals.json';
const players=['山田','田中','伊藤','斎藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:'#123456'}));
const game=(highlight:string)=>({...fixture('spoken','2026-09-01'),highlight});
it.each(corpus)('checks supplied sample $number',(sample)=>{
  const roster=players.map((p,i)=>({...p,name:'人物'+String.fromCharCode(65+i)}));
  const event=parseHighlight(game(sample.text),roster);
  expect(event!==null).toBe(sample.accepted);
  if('expected' in sample && sample.expected)expect(event).toMatchObject(sample.expected);
  if('notInDescription' in sample && sample.notInDescription)for(const excluded of sample.notInDescription)expect(event?.description).not.toContain(excluded);
});
it('keeps supplementary template IDs unique and uses known variables only',()=>{
  const entries=Object.values(reversals).flat();
  expect(new Set(entries.map(e=>e.id)).size).toBe(entries.length);
  for(const entry of entries)for(const variable of JSON.stringify(entry).matchAll(/\{([\w.]+)\}/g))expect(['player.name','highlight.description']).toContain(variable[1]);
});
it.each(['山田がダブリー一発ツモしてた','山田がダブリー一発ツモってて草','山田がダブリー一発ツモってたw','山田がダブリー一発ツモしていた'])('accepts spoken completion %s',text=>expect(parseHighlight(game(text),players)?.event).toBe('double-riichi-ippatsu'));
it.each(['山田が3回カンからリンシャン決めてて草','山田が3回槓からの嶺上開花してた','山田が大明槓した直後に嶺上開花'])('keeps only the unambiguous win %s',text=>{
  const e=parseHighlight(game(text),players)!;expect(e.description).toContain('嶺上開花');expect(e.description).not.toMatch(/3回|槓した|草/);
});
it.each(['山田が役満狙ってたけど満貫ツモった','山田が役満を狙っていたけど満貫ツモってた','山田が役満じゃなかったけど満貫ツモった'])('keeps a completed event after a failed attempt: %s',text=>{
  const e=parseHighlight(game(text),players)!;expect(e.event).toBe('mangan');expect(e.description).not.toContain('役満');
});
it.each(['山田が田中に倍満振り込んでた','山田が田中の倍満に振り込んだ'])('assigns the winner correctly: %s',text=>{
  const e=parseHighlight(game(text),players)!;expect(e.playerId).toBe('sample02');expect(e.description).toContain('田中選手が山田選手から');
});
it('understands a colloquial direct hit and explicit dealer payment',()=>{
  expect(parseHighlight(game('山田が親倍を田中さんにぶち当ててた'),players)?.points).toBe(24000);
  expect(parseHighlight(game('山田が親で6000オールツモってた'),players)?.points).toBe(18000);
});
it('uses a reversal without inventing a final first place',()=>{
  const e=parseHighlight(game('山田が海底でツモって逆転してた'),players)!;
  expect(e.comeback).toBe(true);expect(e.description).toContain('順位を逆転');expect(e.description).not.toContain('トップ');
});
it('checks bust evidence and invalidates cached facts after correction',()=>{
  const g={...fixture('bust','2026-09-01',[50000,-1000,30000,21000]),highlight:'田中が山田に倍満振り込んで飛んだ'};
  expect(parseHighlight(g,players)?.description).toContain('田中選手が飛び');
  g.players[1].rawScore=100;
  expect(parseHighlight(g,players)).toBeNull();
  g.players[1].rawScore=0;
  g.rules.bustIncludesZero=true;
  expect(parseHighlight(g,players)).not.toBeNull();
  g.rules.bustIncludesZero=false;
  expect(parseHighlight(g,players)).toBeNull();
});
it.each(['山田が四暗刻ツモってたかも','山田がダブリー一発ツモしてない','山田が役満ツモってないけど草','山田が役満だったらツモしてた','山田が国士テンパってたらしい','山田が知らない技から役満ツモってた','山田が田中に役満ツモってた','山田が山田に倍満振り込んだ','山田が役満狙ってたけど満貫ツモってたかも','山田が3回槓からの嶺上開花してない','山田が子で6000オールツモってた','山田が親で6100オールツモってた'])('does not turn ambiguity into a fact: %s',text=>expect(parseHighlight(game(text),players)).toBeNull());
it('keeps only another persons completed win after an attempted hand',()=>{
  const events=parseHighlights(game('山田が役満狙ってたけど田中が満貫ツモった'),players);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({playerId:'sample02',event:'mangan',description:'田中選手が満貫をツモ和了'});
  expect(events[0].description).not.toContain('役満');
});
it('feeds the same event to articles and removes it after an edit',()=>{
  const g=game('山田が親倍を田中にぶち当ててた');
  const source={date:g.date,groupId:'spoken',realRecords:true,players,games:[g]};
  expect(createNewsEdition(source)?.paragraphs.join('')).toContain('山田選手が田中選手から');
  g.highlight='山田が親倍だったかも';
  expect(createNewsEdition(source)?.hasHighlights).toBe(false);
});
it('does not invent a winning hand for a standalone reversal',()=>{
  const g=game('田中がラスから一局でトップになった');
  const event=parseHighlight(g,players)!;
  expect(event.outcomeOnly).toBe(true);expect(event.description).not.toMatch(/和了|ツモ|ロン/);
  const edition=createNewsEdition({date:g.date,groupId:'reversal',realRecords:true,players,games:[g]})!;
  expect(edition.hasHighlights).toBe(true);
  const paragraph=edition.paragraphs.find(p=>p.includes(event.description))!;
  expect(paragraph).toBeTruthy();expect(paragraph).not.toMatch(/ツモ|ロン|和了/);
});
it('accepts corpus busts only when actual points agree',()=>{
  const roster=players.map((p,i)=>({...p,name:'人物'+String.fromCharCode(65+i)}));
  const losingB={...fixture('b9','2026-09-01',[50000,-1000,30000,21000]),highlight:corpus[8].text};
  expect(parseHighlight(losingB,roster)?.playerId).toBe('sample01');
  const losingA={...fixture('b89','2026-09-01',[-1000,50000,30000,21000]),highlight:corpus[88].text};
  expect(parseHighlight(losingA,roster)?.playerId).toBe('sample02');
});

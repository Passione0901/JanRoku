import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { parseHighlight, parseHighlights, rankHighlights } from './highlights';
import { validGame } from '../../data/LocalStorageGameRepository';
import { createNewsEdition } from './edition';
const players=['山田','田中','伊藤','斎藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:'#123456'}));
const game=(highlight:string,id='game')=>({...fixture(id,'2026-09-01'),highlight});
describe('conservative highlight parsing',()=>{
  it.each(['山田が親倍ツモで8000オールでヤバかった','山田が親倍満をツモで８，０００オール','山田が親の倍満を自摸'])('accepts equivalent complete statements: %s',text=>{
    const event=parseHighlight(game(text),players)!;
    expect(event.points).toBe(24000);expect(event.event).toBe('baiman');expect(event.playerId).toBe('sample01');
  });
  it('understands opening double riichi and an explicitly reported reversal',()=>{
    expect(parseHighlight(game('伊藤が東一局で初手ダブリー一発ツモしてすごかった'),players)?.event).toBe('double-riichi-ippatsu');
    expect(parseHighlight(game('田中が役満和了で最下位からトップになった'),players)?.comeback).toBe(true);
    expect(parseHighlight(game('田中が役満和了で最下位からトップで終了した'),players)).toBeNull();
  });
  it.each(['山田が役満を狙った','山田が役満だったかも','山田が役満ではなかった','山田と田中が役満ですごかった','知らない人が役満ツモ','2時間半やったのにまだ東場だった','山田が親倍ツモで4000オール','山田が子の役満をツモで16000オール','山田が宇宙ツモ','山田がダブル役満ツモ','山田が役満ツモだと思った','山田が役満ツモでバカだった','山田が子の役満を親ツモ','山田が役満ツモで本場加算','山田が役満ツモ？'])('rejects ambiguity or unsupported claims: %s',text=>expect(parseHighlight(game(text),players)).toBeNull());
  it('extracts two explicit wins without confusing their participants',()=>{
    const events=parseHighlights(game('山田が役満ツモ。田中も役満ツモ'),players);
    expect(events).toHaveLength(2);
    expect(events.map(e=>[e.playerId,e.event,e.description])).toEqual([
      ['sample01','yakuman','山田選手が役満をツモ和了'],
      ['sample02','yakuman','田中選手が役満をツモ和了'],
    ]);
  });
  it('allows an explicit ron opponent but not a conflicting tsumo',()=>{
    expect(parseHighlight(game('山田が田中さんから満貫ロン'),players)?.description).toContain('田中選手から');
    expect(parseHighlight(game('山田が田中から満貫ツモ'),players)).toBeNull();
  });
  it('rejects duplicate names and does not guess surnames',()=>{
    expect(parseHighlight(game('山田が役満ツモ'),[...players,{...players[1],name:'山田'}])).toBeNull();
    expect(parseHighlight(game('山が役満ツモ'),players)).toBeNull();
  });
  it('ranks dealer sanbaiman above child yakuman, including unknown-role lower bounds',()=>{
    const a=parseHighlight(game('山田が役満ツモ','a'),players)!;
    const b=parseHighlight(game('斎藤が三倍満を親ツモ','b'),players)!;
    const c=parseHighlight(game('田中が子の役満ツモ','c'),players)!;
    expect(a.points).toBe(32000);expect(a.pointsKnown).toBe(false);
    expect(a.description).not.toMatch(/32000|32,000|親|子/);
    expect(rankHighlights([a,c,b])[0]).toBe(b);
  });
  it('validates code-point limits used by the API without breaking legacy games',()=>{
    expect(validGame(game('あ'.repeat(50)))).toBe(true);
    expect(validGame(game('あ'.repeat(51)))).toBe(false);
    expect(validGame(game('😀'.repeat(50)))).toBe(true);
    expect(validGame({...game(''),highlight:42})).toBe(false);
    expect(validGame(fixture('old','2026-09-01'))).toBe(true);
  });
});
it('integrates only parsed highlights, updates on edits and preserves ordinary editions',()=>{
  const g=game('山田が役満ツモ');
  const source={date:g.date,groupId:'test-highlight',realRecords:true,players,games:[g]};
  const a=createNewsEdition(source)!;
  expect(a.hasHighlights).toBe(true);expect(a.headline).toContain('役満');
  expect(a.paragraphs.join('')).toContain('山田選手が役満をツモ和了');
  expect(a.paragraphs.join('')).not.toContain('32,000');
  g.highlight='山田が親の三倍満ツモ';
  expect(createNewsEdition(source)!.headline).toContain('三倍満');
  g.highlight='役満かもしれない';
  const ignored=createNewsEdition(source)!;expect(ignored.hasHighlights).toBe(false);
  g.highlight='';
  expect(createNewsEdition(source)!.paragraphs).toEqual(ignored.paragraphs);
});
it('uses highlight resources across news, member summaries, interviews and reader threads without filling every section',()=>{
  const seen=new Set<string>();
  for(let i=0;i<24;i++){
    const games=[game('山田が役満ツモ','primary'),game('田中が親倍ツモ','secondary-'+i)];
    const edition=createNewsEdition({date:games[0].date,groupId:'sections',realRecords:true,players,games})!;
    expect(edition.headline).toContain('役満');
    expect(edition.paragraphs.join('')).toContain('倍満');
    const member=edition.members.find(m=>m.id==='sample02')!;
    if(edition.news.some(t=>t.includes('倍満')))seen.add('news');
    if(member.summary.includes('倍満'))seen.add('summary');
    if(member.question.includes('倍満'))seen.add('interview');
    if(edition.comments.some(t=>t.includes('倍満')))seen.add('reader');
    expect(edition.commentThreads.map(t=>t.text)).toEqual(edition.comments);
    expect(edition.comments).toHaveLength(20);
    const uses=Number(edition.news.some(t=>t.includes('倍満')))+Number(member.summary.includes('倍満'))+Number(member.question.includes('倍満'))+Number(edition.comments.some(t=>t.includes('倍満')));
    expect(uses).toBe(1);
  }
  expect([...seen].sort()).toEqual(['interview','news','reader','summary']);
});

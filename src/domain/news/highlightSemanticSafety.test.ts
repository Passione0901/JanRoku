import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { analyzeHighlight } from './highlightAnalysis';
import type { StructuredHighlight } from './highlightTypes';

const players=['山田','佐藤','田中','伊藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:'#123456'}));
const inspect=(highlight:string)=>analyzeHighlight({...fixture('safety','2026-09-01'),highlight},players);
const accepted=(highlight:string)=>inspect(highlight).events.filter(e=>e.decision==='accepted' && e.state==='asserted');
const wins=(highlight:string)=>accepted(highlight).filter(e=>e.kind==='win');
const summary=(events:StructuredHighlight[])=>events.map(e=>({winner:e.winnerId,discarder:e.discarderId,method:e.method,level:e.level,roles:e.roles}));

// Updated 2026-09-15: Semantic adversarial cases, not grammar snapshots; avoid publishing the wrong event.
describe('publication safety: denial and reporting scope',()=>{
  it.each([
    '山田が役満ツモ、と思ったら違った',
    '山田が役満ツモ、というのは嘘だった',
    '山田が役満ツモ、ではなかった',
    '山田が役満ツモしたらしい',
    '山田が役満ツモって佐藤が言ってた',
    '山田が役満ツモしたと聞いた',
    '山田が役満ツモ、のはずだった',
    '山田が役満ツモに失敗',
    '山田が役満ツモした夢を見た',
    '山田が役満ツモしたら優勝だった',
    '山田が国士をテンパイしたがアガれず流局した',
  ])('does not publish the alleged win: %s',text=>expect(wins(text),JSON.stringify(summary(wins(text)))).toEqual([]));
  it('does not let a negated attempt suppress an explicitly completed contrasting event',()=>{
    const events=wins('山田が役満を狙ったが佐藤が満貫ツモ');
    expect(events).toHaveLength(1);expect(events[0]).toMatchObject({winnerId:'sample02',level:'満貫'});
  });
});

describe('publication safety: participant and dealer assignment',()=>{
  it.each([
    ['親の山田が佐藤に満貫を放銃','sample02','sample01',undefined],
    ['佐藤が親の山田から満貫ロン','sample02','sample01',undefined],
    ['山田が子で佐藤に満貫放銃','sample02','sample01',undefined],
    ['山田が親で佐藤の満貫に放銃','sample02','sample01',undefined],
    ['佐藤が山田の親満に放銃','sample01','sample02','dealer'],
    ['山田が親の佐藤に満貫放銃','sample02','sample01','dealer'],
  ] as const)('binds the hand to the actual winner: %s',(text,winner,discarder,role)=>{
    const events=wins(text);
    expect(events).toHaveLength(1);expect(events[0]).toMatchObject({winnerId:winner,discarderId:discarder,method:'ron',level:'満貫'});
    expect(events[0].roles[winner]).toBe(role);
    expect(events[0].basicGain).toEqual(role==='dealer'?{value:12000,lowerBound:12000}:{value:null,lowerBound:8000});
  });
  it.each([
    '山田と佐藤が満貫ツモ',
    '山田が佐藤と満貫ツモ',
    '山田が佐藤に満貫ツモ',
    '山田が槓したら、親が役満ツモした',
    '山田が槓して、誰かが役満ツモった',
    '山田が槓、対面が役満ツモ',
  ])('does not guess a subject from proximity: %s',text=>expect(wins(text),JSON.stringify(summary(wins(text)))).toEqual([]));
  it('preserves the prior known win without inheriting it into an unknown person',()=>{
    const events=wins('山田が満貫ツモ、高橋が役満ツモ');
    expect(events).toHaveLength(1);expect(events[0]).toMatchObject({winnerId:'sample01',level:'満貫'});
  });
  it('recognizes an explicit subject after a different persons kan',()=>{
    const events=wins('山田が槓、佐藤が満貫ツモ');
    expect(events).toHaveLength(1);expect(events[0]).toMatchObject({winnerId:'sample02',level:'満貫'});
  });
});

describe('publication safety: time and numeric boundaries',()=>{
  it('does not carry dealer status, hand value or method into the next hand',()=>{
    const events=wins('山田が親満ツモ、次局に佐藤が満貫ロン');
    expect(events).toHaveLength(2);
    expect(summary(events)).toEqual([
      {winner:'sample01',discarder:null,method:'tsumo',level:'満貫',roles:{sample01:'dealer'}},
      {winner:'sample02',discarder:null,method:'ron',level:'満貫',roles:{}},
    ]);
    expect(events[0].time.segment).not.toBe(events[1].time.segment);
  });
  it('does not turn another player into the previous winner in a later scene',()=>{
    const events=wins('山田が満貫ツモ、その後佐藤が子の役満ツモ');
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({winnerId:'sample02',level:'役満',roles:{sample02:'nondealer'}});
    expect(events[0].level).toBe('満貫');
  });
  it('rejects contradictory payment in the following descriptive clause',()=>{
    expect(wins('山田が親三倍満ツモ、8000オールだった')).toEqual([]);
  });
  it('does not attach a balance to the previous hand as its value',()=>{
    const events=wins('山田が親三倍満ツモ、持ち点は8000点');
    expect(events).toHaveLength(1);expect(events[0].basicGain.value).toBe(36000);
    expect(events[0].amounts.some(a=>a.value===8000&&a.meaning==='basic-gain')).toBe(false);
  });
});

describe('publication safety: drawing a tile is not winning a hand',()=>{
  it.each([
    '山田が嶺上牌でドラをツモった',
    '山田が赤五萬をツモった',
    '山田がツモでドラを引いた',
    '山田が佐藤の当たり牌をツモった',
    '山田が国士テンパイ中に一萬をツモった',
    '山田が満貫をテンパイし、最後にドラをツモった',
  ])('does not publish an ordinary draw as a win: %s',text=>expect(wins(text),JSON.stringify(summary(wins(text)))).toEqual([]));
  it('allows a clearly completed tsumo despite a prior draw action',()=>{
    const events=wins('山田が嶺上牌でドラを引き、満貫をツモアガった');
    expect(events).toHaveLength(1);expect(events[0]).toMatchObject({winnerId:'sample01',method:'tsumo',level:'満貫'});
  });
});

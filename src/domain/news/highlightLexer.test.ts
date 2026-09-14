import { describe, expect, it, vi } from 'vitest';
import { HIGHLIGHT_PATH_LIMIT, lexHighlight } from './highlightLexer';
import type { Player } from '../types';

const players:Player[] = [{id:'a',name:'山田',color:'#000'},{id:'b',name:'佐藤',color:'#111'}];
const primary = (source:string)=>lexHighlight(source,players).paths[0];
const present = (source:string,kind:string,value:string)=>primary(source).some(t=>t.kind===kind&&t.value===value);

describe('highlight lexer evidence and token lattice',()=>{
  it('uses a conservative code-point fallback when Intl.Segmenter is unavailable',async()=>{
    const olderIntl=Object.create(Intl);
    Object.defineProperty(olderIntl,'Segmenter',{value:undefined});
    vi.stubGlobal('Intl',olderIntl);
    vi.resetModules();
    try {
      const {lexHighlight:fallbackLex,HIGHLIGHT_LEXER_VERSION}=await import('./highlightLexer');
      expect(HIGHLIGHT_LEXER_VERSION).toMatch(/^6\./);
      const source='😀山田が６０００オールをツモった';
      const result=fallbackLex(source,players);
      expect(result.normalized).toBe('😀山田が6000オールをツモった');
      expect(result.paths[0].find(t=>t.kind==='person')).toMatchObject({start:2,end:4,text:'山田'});
      for(const t of result.tokens) expect(source.slice(t.start,t.end)).toBe(t.text);
      const combining=fallbackLex('山田か\u3099満貫ツモ',players);
      expect(combining.normalized).toBe('山田か\u3099満貫ツモ');
      expect(combining.paths[0].some(t=>t.kind==='unknown'&&t.text.includes('か\u3099'))).toBe(true);
    } finally {vi.unstubAllGlobals();vi.resetModules();}
  });
  it('retains untouched original evidence through normalization and whitespace',()=>{
    const source='　山田 が ６，０００オールをツモった！';
    const result=lexHighlight(source,players);
    expect(result.source).toBe(source);
    expect(result.normalized).toBe('山田が6,000オールをツモった!');
    for(const t of result.tokens) expect(source.slice(t.start,t.end)).toBe(t.text);
    const amount=result.paths[0].find(t=>t.kind==='number');
    expect(amount?.value).toBe('6000');
    expect(amount?.text).toBe('６，０００');
  });
  it('maps combining marks and half-width kana without corrupting original spans',()=>{
    const source='ｻﾄｳか\u3099倍満ツモ';
    const result=lexHighlight(source,[{id:'b',name:'サトウ',color:'#000'}]);
    expect(result.normalized).toBe('サトウが倍満ツモ');
    expect(result.paths[0][0]).toMatchObject({kind:'person',value:'b',text:'ｻﾄｳ',start:0,end:3});
    expect(result.paths[0].find(t=>t.kind==='particle')).toMatchObject({text:'か\u3099',start:3,end:5});
  });
  it('preserves surrogate-pair UTF-16 offsets rather than using the 50-character counter',()=>{
    const source='😀山田が倍満ツモ';
    const result=lexHighlight(source,players);
    expect(result.tokens.find(t=>t.kind==='person')).toMatchObject({start:2,end:4,text:'山田'});
    expect(result.paths[0][0]).toMatchObject({kind:'unknown',text:'😀',start:0,end:2});
  });
  it('protects registered names that contain mahjong terminology',()=>{
    const result=lexHighlight('国士さんが満貫をツモった',[{id:'kokushi',name:'国士',color:'#000'}]);
    expect(result.tokens.filter(t=>t.start<2)).toEqual([expect.objectContaining({kind:'person',value:'kokushi',text:'国士'})]);
  });
  it('retains same-name and prefix-name alternatives for semantic ambiguity checks',()=>{
    const roster=[{id:'a',name:'山田',color:''},{id:'b',name:'山田',color:''},{id:'c',name:'山',color:''}];
    const result=lexHighlight('山田が満貫ツモ',roster);
    expect(result.tokens.filter(t=>t.kind==='person'&&t.start===0).map(t=>t.value).sort()).toEqual(['a','b','c']);
  });
  it('does not force longest matching チートイツ when チートイ + ツモ is viable',()=>{
    const result=lexHighlight('山田がチートイツモ',players);
    expect(result.tokens.some(t=>t.kind==='term'&&t.value==='七対子'&&t.text==='チートイツ')).toBe(true);
    expect(result.paths[0].some(t=>t.kind==='term'&&t.value==='七対子'&&t.text==='チートイ')).toBe(true);
    expect(result.paths[0].some(t=>t.kind==='action'&&t.value==='tsumo')).toBe(true);
  });
  it('retains a compound alias as explicit yaku and action with shared original evidence',()=>{
    const result=lexHighlight('山田がリーヅモ',players);
    expect(result.paths.some(path=>path.some(t=>t.kind==='term'&&t.value==='リーチ')&&path.some(t=>t.kind==='action'&&t.value==='tsumo'))).toBe(true);
    expect(result.paths.every(path=>path.some(t=>t.kind==='action'&&t.value==='tsumo'))).toBe(true);
    expect(result.tokens.some(t=>t.kind==='term'&&t.value==='リーチツモ')).toBe(false);
    expect(result.paths.flat().filter(t=>t.kind==='action'&&t.value==='tsumo').every(t=>t.text==='リーヅモ')).toBe(true);
  });
  it.each(['山田がリーチツモ','山田がリーヅモ'])('never drops the win action from the shortest token path: %s',source=>{
    expect(primary(source).some(t=>t.kind==='action'&&t.value==='tsumo')).toBe(true);
  });
  it('retains inflected noun predicates and success auxiliaries as individual lexical evidence',()=>{
    const path=primary('山田が槍槓し、満貫のロンに成功');
    expect(path.some(t=>t.kind==='unknown')).toBe(false);
    expect(path).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:'term',value:'槍槓',text:'槍槓'}),
      expect.objectContaining({kind:'context',value:'do',text:'し'}),
      expect.objectContaining({kind:'context',value:'do',text:'成功'}),
    ]));
    expect(primary('山田が満貫をツモで').at(-1)).toMatchObject({kind:'particle',value:'で',text:'で'});
  });
  it.each([
    ['山田がツモってて','tsumo'],['山田が決めてて','complete'],
    ['山田が振り込んでて','deal-in'],['山田が親を流した','end'],
  ])('covers registered colloquial predicate conjugations: %s',(source,action)=>{
    expect(primary(source).some(t=>t.kind==='action'&&t.value===action)).toBe(true);
    expect(primary(source).some(t=>t.kind==='unknown')).toBe(false);
  });
  it.each(['山田がラス確のアガリ','山田がラス確定のアガリ'])('preserves last-place rank in %s',source=>{
    expect(primary(source).some(t=>t.kind==='rank'&&t.value==='4')).toBe(true);
    expect(primary(source).some(t=>t.kind==='unknown')).toBe(false);
  });
  it('preserves tile and reaction phrases as separate context evidence',()=>{
    const path=primary('山田が一局で残り一枚の牌をツモってて草');
    expect(path.some(t=>t.kind==='unknown')).toBe(false);
    expect(path.some(t=>t.kind==='context'&&t.text==='一局')).toBe(true);
    expect(path.some(t=>t.kind==='context'&&t.text==='残り一枚')).toBe(true);
    for(const phrase of ['わずか','奇跡の','急','長い','近い']) expect(primary('山田が'+phrase+'逆転').some(t=>t.kind==='context'&&t.value==='reaction'&&t.text===phrase)).toBe(true);
  });
  it('keeps negation outside inflected action tokens',()=>{
    const path=primary('山田が役満をツモれなかった');
    expect(path).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:'action',value:'tsumo',text:'ツモれ'}),
      expect.objectContaining({kind:'modality',value:'negated',text:'なかった'}),
    ]));
  });
  it('retains sentence-final cancellation for later scope checks',()=>{
    const path=primary('山田が役満ツモ、と思ったら違った');
    expect(path).toEqual(expect.arrayContaining([
      expect.objectContaining({kind:'modality',value:'speculative',text:'と思ったら'}),
      expect.objectContaining({kind:'modality',value:'negated',text:'違った'}),
    ]));
  });
  it('does not mistake the embedded tile word in 嶺上牌 for the winning yaku',()=>{
    const path=primary('山田が嶺上牌でドラを引いた');
    expect(path.some(t=>t.kind==='context'&&t.value==='tile'&&t.text==='嶺上牌')).toBe(true);
    expect(path.some(t=>t.kind==='term'&&t.value==='嶺上開花')).toBe(false);
  });
  it('never silently deletes unknown material',()=>{
    const source='山田がムニャムニャ倍満ツモ';
    const result=lexHighlight(source,players);
    expect(result.paths.every(p=>p.some(t=>t.kind==='unknown'&&t.text.includes('ムニャムニャ')))).toBe(true);
  });
  it('preserves newline as a clause boundary',()=>{
    expect(present('山田が満貫ツモ\n佐藤が倍満ロン','connector','sentence')).toBe(true);
  });
  it('keeps exploration bounded',()=>{
    const result=lexHighlight('山田が親倍満をツモしていた、佐藤も親倍満をツモしていた',players);
    expect(result.paths.length).toBeLessThanOrEqual(HIGHLIGHT_PATH_LIMIT);
    expect(result.paths.length).toBeGreaterThan(0);
    expect(result.truncated).toBe(true);
    expect(result.tokens.some(t=>t.kind==='particle'&&t.value==='も')).toBe(true);
  });
  it.each([
    ['山田が満貫ツモり','tsumo'],['山田が満貫ツモってた','tsumo'],['山田が満貫ツモアガった','tsumo'],
    ['山田が佐藤から満貫をロンし','ron'],['山田が佐藤に満貫を放銃し','deal-in'],
    ['山田が佐藤へ倍満振り込んでた','deal-in'],['山田が佐藤に倍満をぶち当ててた','hit'],
    ['山田が嶺上開花を決めた','complete'],['山田が国士をテンパってた','ready'],
    ['山田が国士を狙ってた','aim'],['山田が逆転した','reverse'],
  ])('recognizes action inflection without interpreting the full sentence: %s',(source,value)=>{
    expect(present(source,'action',value)).toBe(true);
  });
});

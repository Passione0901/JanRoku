import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { parseHighlight } from './highlights';
import { createNewsEdition } from './edition';
const players=['山田','田中','伊藤','斎藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:'#123456'}));
const game=(highlight:string,id='g')=>({...fixture(id,'2026-09-01'),highlight});
const edition=(games:ReturnType<typeof game>[])=>createNewsEdition({date:'2026-09-01',groupId:'priority',realRecords:true,players,games})!;

// Updated 2026-09-15: Measure publication separately from successful recognition.
describe('highlight editorial importance',()=>{
  it('recognizes routine mangan but excludes it from all news sections',()=>{
    const g=game('山田が満貫をツモった');
    expect(parseHighlight(g,players)?.editorial).toBe('routine');
    expect(edition([g])).toEqual(edition([{...g,highlight:''}]));
  });
  it.each(['初心者の山田が初めて跳満を和了した','初心者の山田が始めて跳満を和了した','山田が人生初の跳満をツモった','山田が初めて和了した','山田が人生初の満貫をロンした'])(
    'preserves a clearly attributed milestone: %s',text=>{
      const g=game(text);
      expect(parseHighlight(g,players)?.editorial).toBe('required');
      expect(edition([g]).paragraphs.join('')).toContain('本人にとって初めて');
    });
  it.each(['初心者が初めて跳満を和了した','山田が初めて跳満を和了したかも','山田が初めて跳満を和了したかった','山田が初めて跳満を和了しなかった'])(
    'does not promote an uncertain milestone: %s',text=>expect(parseHighlight(game(text),players)).toBeNull());
  it('does not turn first riichi or first deal-in into someone else’s first win',()=>{
    expect(parseHighlight(game('山田が初めてリーチして跳満をツモった'),players)?.milestone).toBe(false);
    expect(parseHighlight(game('山田が初めて田中に満貫を振り込んだ'),players)?.editorial).toBe('routine');
    expect(parseHighlight(game('山田が初めてツモった'),players)?.description).toContain('初めてのツモ和了');
  });
  it('includes three yakuman wins by the same player plus a separate milestone',()=>{
    const games=[game('山田が役満をツモった','a'),game('山田が国士無双をツモった','b'),game('山田が四暗刻をツモった','c'),game('田中が初めて跳満を和了した','d')];
    const text=edition(games).paragraphs.join('');
    for(const g of games)expect(text).toContain(parseHighlight(g,players)!.description);
    expect(text).toContain('第3戦');
    const edited=edition(games.map(g=>g.id==='b'?{...g,highlight:''}:g)).paragraphs.join('');
    expect(edited).not.toContain('山田選手が国士無双をツモ和了');
  });
  it('retains every required event even when article templates are exhausted',()=>{
    const games=Array.from({length:12},(_,i)=>game('山田が役満をツモった',String(i).padStart(2,'0')));
    expect(edition(games).paragraphs.filter(p=>p.includes('山田選手が役満をツモ和了'))).toHaveLength(12);
  });
  it('retains explicit repeated wins without multiplying the basic gain',()=>{
    const e=parseHighlight(game('山田が役満を2回ツモった'),players)!;
    expect(e.description).toContain('（2回）');expect(e.points).toBe(32000);
    expect(parseHighlight(game('山田が3回カンして嶺上開花でツモった'),players)?.description).not.toContain('（3回）');
    expect(parseHighlight(game('山田が3回リーチして満貫をツモった'),players)?.description).not.toContain('（3回）');
  });
  it('does not use unknown final results to verify a claimed first-place finish',()=>{
    const draft={...game('山田が最下位からトップで終了した'),players:players.map(p=>({playerId:p.id,rank:null,rawScore:null}))};
    expect(parseHighlight(draft,players)).toBeNull();
    expect(parseHighlight({...draft,highlight:'山田が役満をツモった'},players)?.editorial).toBe('required');
  });
});

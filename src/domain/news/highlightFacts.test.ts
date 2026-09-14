import {expect,it} from 'vitest';
import {fixture} from '../../test/fixtures';
import {analyzeHighlight} from './highlightAnalysis';
const players=['山田','佐藤','田中','伊藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:'#123456'}));
const game=(highlight:string)=>({...fixture('facts','2026-09-01'),highlight});
const wins=(text:string)=>analyzeHighlight(game(text),players).events.filter(e=>e.kind==='win'&&e.decision==='accepted');
// Updated 2026-09-15: Transfer direction and payment units must survive surface-form changes.
it.each(['山田が佐藤に倍満を振り込んだ','佐藤が山田から倍満をロンした','佐藤が山田に倍満をぶち当てた'])('normalizes the same transfer: %s',text=>{
 expect(wins(text)).toHaveLength(1);expect(wins(text)[0]).toMatchObject({winnerId:'sample02',discarderId:'sample01',method:'ron',level:'倍満',basicGain:{value:null,lowerBound:16000}});
});
it('distinguishes child payments from total winnings',()=>{
 const e=wins('山田が子の役満をツモ、8000・16000だった')[0];
 expect(e.basicGain).toEqual({value:32000,lowerBound:32000});
 expect(e.amounts.map(a=>a.meaning)).toEqual(['individual-payment','individual-payment']);
 expect(wins('山田が親三倍満ツモで8000・16000')).toHaveLength(0);
});
it('never promotes a gap or balance to the score of a win',()=>{
 const e=wins('山田が役満ツモ、持ち点は50000点')[0];expect(e.basicGain).toEqual({value:null,lowerBound:32000});
});
it('invalidates parsed results when roster, raw note, result, rules or mode changes',()=>{
 const g=game('佐藤が最下位からトップで終了');
 const a=analyzeHighlight(g,players);expect(analyzeHighlight(g,players)).toBe(a);
 expect(analyzeHighlight({...g,highlight:'山田が役満ツモ'},players)).not.toBe(a);
 expect(analyzeHighlight({...g,rules:{...g.rules,bustIncludesZero:!g.rules.bustIncludesZero}},players)).not.toBe(a);
 expect(analyzeHighlight(g,players.map(p=>({...p,name:p.name+'さん'})))).not.toBe(a);
 expect(analyzeHighlight({...g,inputMode:'results'},players)).not.toBe(a);
 expect(analyzeHighlight({...g,players:g.players.map(p=>({...p,rawScore:(p.rawScore??0)+100})) as typeof g.players},players)).not.toBe(a);
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HighlightAnalysis, StructuredHighlight } from './highlightTypes';
import { fixture } from '../../test/fixtures';
const { analyze } = vi.hoisted(()=>({analyze:vi.fn()}));
vi.mock('./highlightAnalysis',()=>({analyzeHighlight:analyze}));
import { parseHighlight, parseHighlights, presentHighlightAnalysis, rankHighlights } from './highlights';
import { createNewsEdition } from './edition';

const players=['山田','田中','伊藤','斎藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:'#123456'}));
const game={...fixture('presentation','2026-09-01'),highlight:'山田が田中から満貫ロンして草'};
const span={start:0,end:2,text:'山田'};
const frame=(patch:Partial<StructuredHighlight>={}):StructuredHighlight=>({
  id:'win-1',gameId:game.id,kind:'win',actorId:'sample01',winnerId:'sample01',discarderId:null,targetId:null,
  method:'tsumo',yaku:[],level:'役満',roles:{},amounts:[],basicGain:{value:null,lowerBound:32000},
  time:{segment:0,scope:'unspecified'},finalRank:null,state:'asserted',decision:'accepted',reasons:[],evidence:{action:[span]},...patch,
});
const analysis=(events:StructuredHighlight[]):HighlightAnalysis=>({version:'presentation-fixture',source:game.highlight,lexing:null,events,diagnostics:[]});
const present=(events:StructuredHighlight[])=>presentHighlightAnalysis(analysis(events),game,players);
beforeEach(()=>analyze.mockReset());

describe('structured highlight presentation',()=>{
  it('uses the winner role, never the discarder role, and only approved facts',()=>{
    const event=present([frame({method:'ron',winnerId:'sample02',actorId:'sample01',discarderId:'sample01',roles:{sample01:'dealer'},level:'満貫',basicGain:{value:null,lowerBound:8000}})])[0];
    expect(event.playerId).toBe('sample02');
    expect(event.description).toBe('田中選手が山田選手から満貫をロン和了');
    expect(event.description).not.toMatch(/親|草|8,000/);
  });
  it('keeps unknown-role lower bounds internal and ranks them below dealer sanbaiman',()=>{
    const unknown=present([frame()])[0];
    const dealer=present([frame({id:'win-2',winnerId:'sample02',actorId:'sample02',level:'三倍満',roles:{sample02:'dealer'},basicGain:{value:36000,lowerBound:36000}})])[0];
    expect(unknown.points).toBe(32000);expect(unknown.pointsKnown).toBe(false);
    expect(unknown.description).not.toMatch(/32,000|32000|親|子/);
    expect(rankHighlights([unknown,dealer])[0]).toBe(dealer);
  });
  it('does not turn unknown points into a claimed zero-point win',()=>{
    const event=present([frame({level:null,yaku:['清一色'],basicGain:{value:null,lowerBound:null}})])[0];
    expect(event.description).toBe('山田選手が清一色をツモ和了');
    expect(event.points).toBe(0);expect(event.pointsKnown).toBe(false);
  });
  it('prints explicit verified all-payment but does not print unrelated numeric facts',()=>{
    const event=present([frame({roles:{sample01:'dealer'},level:'倍満',basicGain:{value:24000,lowerBound:24000},amounts:[
      {value:8000,meaning:'all-payment',evidence:[span]},
      {value:50000,meaning:'balance',evidence:[span]},
      {value:100,meaning:'gap',evidence:[span]},
    ]})])[0];
    expect(event.description).toContain('8,000点オール');
    expect(event.description).not.toMatch(/24,000|50,000|100点/);
  });
  it('does not render rejected, uncertain, wrong-game or unsupported standalone bust frames',()=>{
    expect(present([frame({decision:'rejected'}),frame({state:'speculative'}),frame({gameId:'other'}),frame({kind:'bust'})])).toEqual([]);
  });
  it('uses dedicated outcome resources without inventing a winning hand',()=>{
    const event=present([frame({kind:'reversal',winnerId:null,method:null,level:null,basicGain:{value:null,lowerBound:null},finalRank:1,time:{segment:0,scope:'during'}})])[0];
    expect(event.outcomeOnly).toBe(true);expect(event.event).toBe('comeback');
    expect(event.description).toBe('山田選手がトップに浮上');
    expect(event.description).not.toMatch(/和了|ロン|ツモ|最下位|終了/);
  });
  it('preserves final outcomes separately from a temporary lead',()=>{
    const event=present([frame({kind:'reversal',winnerId:null,method:null,level:null,finalRank:2,time:{segment:0,scope:'final'}})])[0];
    expect(event.description).toBe('山田選手が逆転し、2位で終了');
  });
  it('merges an explicitly related reversal even if it arrives before the win',()=>{
    const reversal=frame({id:'reversal-1',kind:'reversal',winnerId:null,method:null,level:null,finalRank:1,time:{segment:0,scope:'during'}});
    const events=present([reversal,frame({relatedEventIds:[reversal.id]})]);
    expect(events).toHaveLength(1);expect(events[0].comeback).toBe(true);
    expect(events[0].description).toContain('役満をツモ和了。山田選手がトップに浮上');
  });
  it('does not merge separate events merely because they share a person and a segment',()=>{
    const reversal=frame({id:'reversal-1',kind:'reversal',winnerId:null,method:null,level:null});
    const events=present([frame(),reversal]);
    expect(events).toHaveLength(2);expect(events[0].comeback).toBe(false);
  });
  it.each(['during','final'] as const)('describes a linked bust with its actual time scope: %s',scope=>{
    const bust=frame({id:'bust-1',kind:'bust',actorId:'sample02',winnerId:null,method:null,level:null,time:{segment:0,scope}});
    const event=present([frame({method:'ron',discarderId:'sample02',relatedEventIds:[bust.id]}),bust])[0];
    expect(event.description).toContain(scope==='final'?'田中選手が飛びとなった':'田中選手が途中で箱下になった');
  });
  it('does not attach the wrong person or a subsequent-hand reversal to a win',()=>{
    const wrongActor=frame({id:'reversal-1',kind:'reversal',actorId:'sample02',winnerId:null,method:null,level:null});
    const nextHand=frame({id:'reversal-2',kind:'reversal',winnerId:null,method:null,level:null,time:{segment:1,scope:'during'}});
    const win=present([frame({relatedEventIds:[wrongActor.id,nextHand.id]}),wrongActor,nextHand]).find(e=>e.id==='win-1')!;
    expect(win.comeback).toBe(false);expect(win.description).not.toContain('逆転');
  });
  it('keeps a ron involving riichi out of a tsumo-specific resource category',()=>{
    const event=present([frame({method:'ron',yaku:['リーチ','一発'],level:null,basicGain:{value:null,lowerBound:null}})])[0];
    expect(event.event).toBe('win');expect(event.description).toContain('ロン和了');
  });
  it('has one analyzer entrypoint and returns the highest-ranked frame to legacy callers',()=>{
    analyze.mockReturnValue(analysis([frame(),frame({id:'sanbaiman',level:'三倍満',winnerId:'sample02',actorId:'sample02',basicGain:{value:36000,lowerBound:36000}})]));
    expect(parseHighlights(game,players)).toHaveLength(2);
    expect(parseHighlight(game,players)?.playerId).toBe('sample02');
  });
});

it('news editions consume multiple frames per memo while maintaining a two-person limit',()=>{
  analyze.mockReturnValue(analysis([
    frame(),
    frame({id:'win-2',actorId:'sample02',winnerId:'sample02',level:'倍満',roles:{sample02:'dealer'},basicGain:{value:24000,lowerBound:24000}}),
    frame({id:'win-3',actorId:'sample03',winnerId:'sample03',level:'満貫',basicGain:{value:null,lowerBound:8000}}),
  ]));
  const edition=createNewsEdition({date:game.date,groupId:'presentation-two',realRecords:true,players,games:[game]})!;
  const text=edition.paragraphs.join('');
  expect(edition.hasHighlights).toBe(true);
  expect(text).toContain('山田選手が役満をツモ和了');
  expect(text).toContain('田中選手が親で倍満をツモ和了');
  expect(text).not.toContain('伊藤選手が満貫をツモ和了');
  expect(edition.comments).toHaveLength(20);
  expect(edition.commentThreads.map(t=>t.text)).toEqual(edition.comments);
});

import { describe, expect, it } from 'vitest';
import { fixture } from '../test/fixtures';
import { isGameEdited, sameGameContent } from './gameEdits';
const game=fixture('edit-state','2026-09-15');
describe('game edit state',()=>{
  it('does not label an old cloud insert as edited, but keeps genuine later edits',()=>{
    expect(isGameEdited(game)).toBe(false);
    expect(isGameEdited({...game,updatedAt:game.createdAt})).toBe(false);
    expect(isGameEdited({...game,updatedAt:new Date(Date.parse(game.createdAt)+1).toISOString()})).toBe(true);
  });
  it('ignores transport metadata, field order and empty optional values',()=>{
    expect(sameGameContent(game,{...game,syncRevision:'new',updatedAt:'2026-09-15T00:00:00Z',highlight:'',note:'',format:game.format??'hanchan',rules:{...game.rules,countNegativePoints:game.rules.countNegativePoints??true}})).toBe(true);
  });
  it('detects changes to scores, members, dates, rules and highlights',()=>{
    for(const changed of [{...game,highlight:'初めての跳満'},{...game,date:'2026-09-16'},{...game,rules:{...game.rules,bustIncludesZero:!game.rules.bustIncludesZero}}])expect(sameGameContent(game,changed)).toBe(false);
    const scores=structuredClone(game);scores.players[0].result+=1;
    expect(sameGameContent(game,scores)).toBe(false);
    const member=structuredClone(game);member.players[0].playerId='other';
    expect(sameGameContent(game,member)).toBe(false);
  });
});

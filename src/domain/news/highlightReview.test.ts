import { describe, expect, it } from 'vitest';
import { fixture } from '../../test/fixtures';
import { analyzeHighlight } from './highlightAnalysis';

const players = ['山田', '佐藤', '田中', '伊藤'].map((name, i) => ({ id: `sample0${i + 1}`, name, color: '#123456' }));
const wins = (highlight: string) => analyzeHighlight({ ...fixture('independent-review', '2026-09-01'), highlight }, players)
  .events.filter(event => event.kind === 'win' && event.decision === 'accepted' && event.state === 'asserted');

// Updated 2026-09-15: Independent review examples check false assertions, not the parser's current implementation shape.
describe('independent semantic review of highlight publication', () => {
  it.each([
    '山田が役満ツモ。嘘だった',
    '山田が役満ツモ！と思ったら違った',
    '山田が役満ツモ、佐藤が満貫ロン、どちらも嘘だった',
  ])('a retrospective correction invalidates the preceding alleged event: %s', text => {
    expect(wins(text)).toEqual([]);
  });

  it('does not assign two dealers to the same winning hand', () => {
    expect(wins('親の山田が佐藤に親満を放銃')).toEqual([]);
  });

  it.each([
    '山田が満貫ロン、供託込みで12000点',
    '山田が親倍満ツモ、本場込みで8000オール',
  ])('supplemental payments cannot confirm the basic hand value: %s', text => {
    const events = wins(text);
    // Conservative rejection is also safe. If kept, inclusive amounts must not become confirmed basic winnings.
    expect(events.some(event => event.amounts.some(amount => amount.meaning === 'basic-gain' || amount.meaning === 'all-payment'))).toBe(false);
  });

  it('a later speculative hand does not negate the previous explicitly completed hand', () => {
    const events = wins('山田が親三倍満ツモ、次局に佐藤が役満を狙った');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ winnerId: 'sample01', method: 'tsumo', level: '三倍満', basicGain: { value: 36000 } });
  });

  it('a name sharing a registered prefix does not inherit that registered identity', () => {
    expect(wins('山田が槓、山田太郎が満貫ツモ')).toEqual([]);
  });

  it('keeps winners and dealer bindings independent across an explicit next hand', () => {
    const events = wins('山田が佐藤に満貫放銃、次局に田中が親倍ツモ');
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ winnerId: 'sample02', discarderId: 'sample01', method: 'ron', level: '満貫' });
    expect(events[0].roles.sample02).toBeUndefined();
    expect(events[1]).toMatchObject({ winnerId: 'sample03', discarderId: null, method: 'tsumo', level: '倍満', roles: { sample03: 'dealer' } });
    expect(events[0].time.segment).not.toBe(events[1].time.segment);
  });

  it('does not transfer a second player correction into the first player winning event', () => {
    const events = wins('山田が満貫ツモ、次局に佐藤が役満ツモ、というのは嘘だった');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ winnerId: 'sample01', level: '満貫' });
  });
});

import { describe, expect, it } from 'vitest';
import { bookmarkHash, routeFromHash, sharedToken } from './sharedNavigation';

describe('group bookmarks', () => {
  const a = 'a'.repeat(64), b = 'b'.repeat(64);
  it('restores the group and standings from the URL alone', () => {
    const hash = bookmarkHash(a, '#/');
    expect(sharedToken(hash)).toBe(a);
    expect(routeFromHash(hash)).toBe('/');
  });
  it('preserves the group while navigating and reopening subpages', () => {
    const hash = bookmarkHash(a, '#/daily/2026-09-14/news');
    expect(sharedToken(hash)).toBe(a);
    expect(routeFromHash(hash)).toBe('/daily/2026-09-14/news');
    expect(bookmarkHash(a, '#/input')).toBe(`#/join/${a}/input`);
    expect(sharedToken(bookmarkHash(b, '#/'))).toBe(b);
  });
  it('keeps public navigation free of group keys and rejects malformed keys', () => {
    expect(bookmarkHash(a, '#/new')).toBe('#/new');
    expect(bookmarkHash(a, '#/about')).toBe('#/about');
    expect(sharedToken(`#/join/${a}f`)).toBe('');
    expect(routeFromHash('#/members')).toBe('/members');
  });
});

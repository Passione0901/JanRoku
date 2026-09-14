import { expect, it } from 'vitest';
import { chartLineStyle } from './ChartLineKey';

it('assigns 24 distinct colors without collisions in a group', () => {
  const ids = Array.from({ length: 24 }, (_, i) => `player-${i}`);
  expect(new Set(ids.map(id => chartLineStyle(id, ids).color)).size).toBe(24);
  for (const id of ids) {
    expect(chartLineStyle(id, ids)).toEqual(chartLineStyle(id, [...ids].reverse()));
  }
});

it('uses a different dash when a large group exhausts the palette', () => {
  const ids = Array.from({ length: 48 }, (_, i) => `p${String(i).padStart(2, '0')}`);
  expect(chartLineStyle(ids[0], ids).color).toBe(chartLineStyle(ids[24], ids).color);
  expect(chartLineStyle(ids[0], ids).dash).not.toBe(chartLineStyle(ids[24], ids).dash);
});

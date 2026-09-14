import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ChartDayGrid, ChartDates } from './ChartZoom';
import { chartTicks } from '../utils/chartTicks';

it('separates days between games and labels each date only once', () => {
  const games = ['2025-12-31', '2025-12-31', '2026-01-01', '2026-01-01'].map(date => ({ date }));
  const { container } = render(<svg><ChartDayGrid games={games} width={760}/><ChartDates games={games} width={760}/></svg>);
  expect(container.querySelectorAll('line').length).toBe(1);
  expect(Number(container.querySelector('line')!.getAttribute('x1'))).toBe(483);
  const labels = [...container.querySelectorAll('text')].map(n => n.textContent);
  expect(labels).toEqual(['12/31', '2025年', '1/1', '2026年']);
});
it('uses evenly spaced readable ticks across negative and positive scores', () => {
  const ticks = chartTicks(-140, 220);
  expect(ticks[0]).toBe(-140);
  expect(ticks.at(-1)).toBe(220);
  expect(ticks.every((tick, i) => !i || tick - ticks[i - 1] === 10)).toBe(true);
  expect(chartTicks(-12, 12)).toEqual([-10, 0, 10]);
});

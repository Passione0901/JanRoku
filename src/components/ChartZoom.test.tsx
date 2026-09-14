import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ChartZoom, ChartValueAxis } from './ChartZoom';

it('pins value labels horizontally without changing vertical grid coordinates', () => {
  const { container } = render(<ChartZoom>{width => <svg viewBox={`0 0 ${width} 464`}><ChartValueAxis ticks={[0, 10]} y={v => 200 - v} height={464} /></svg>}</ChartZoom>);
  const viewport = screen.getByRole('region', { name: 'グラフ表示範囲' });
  fireEvent.click(screen.getByRole('button', { name: 'グラフを拡大' }));
  fireEvent.scroll(viewport, { target: { scrollLeft: 250, scrollTop: 100 } });
  expect(viewport.style.getPropertyValue('--chart-scroll-x')).toBe('250px');
  expect(container.querySelector('.chart-value-axis text')!.getAttribute('y')).toBe('204');
  fireEvent.click(screen.getByRole('button', { name: '表示をリセット' }));
  expect(viewport.style.getPropertyValue('--chart-scroll-x')).toBe('0px');
});

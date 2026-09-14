// Updated 2026-09-14: Use readable, evenly spaced ticks instead of labeling only extrema.
export function chartTicks(low: number, high: number) {
  const raw = (high - low) / 6;
  const unit = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find(n => n * unit >= raw)! * unit;
  const ticks: number[] = [];
  for (let i = Math.ceil(low / step); i <= Math.floor(high / step); i++) ticks.push(Number((i * step).toPrecision(12)));
  return ticks;
}

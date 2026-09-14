// Updated 2026-09-14: Grid lines are always 10pt apart; labels can be spaced separately.
export function chartTicks(low: number, high: number) {
  const step = 10;
  const ticks: number[] = [];
  for (let i = Math.ceil(low / step); i <= Math.floor(high / step); i++) ticks.push(Number((i * step).toPrecision(12)));
  return ticks;
}
export function chartLabelStep(low: number, high: number, height: number) {
  return Math.max(1, Math.ceil((high - low) * 28 / (height * 10))) * 10;
}

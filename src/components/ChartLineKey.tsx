// Updated 2026-09-14: Stable ID-based colors and dash patterns also appear in the selection controls.
export function chartLineStyle(id: string) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const colors = ['#428fca', '#c48835', '#329a83', '#b26daa', '#d16b61', '#7c8dc9', '#8b9d48', '#479ba8'];
  const dashes = [undefined, '10 5', '3 5', '12 4 3 4'];
  return { color: colors[hash % colors.length], dash: dashes[Math.floor(hash / colors.length) % dashes.length] };
}
export function ChartLineKey({ id }: { id: string }) {
  const style = chartLineStyle(id);
  return <svg className="chart-line-key" width="36" height="14" viewBox="0 0 36 14" aria-hidden="true"><path d="M2 7H34" stroke={style.color} strokeWidth="3" strokeDasharray={style.dash} strokeLinecap="round" /></svg>;
}

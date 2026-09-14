import { usePlayers } from '../hooks/usePlayers';
// Updated 2026-09-14: Assign distinct colors from the full roster, independent of ranking or visibility.
export function chartLineStyle(id: string, playerIds: string[] = [id]) {
  const index = [...new Set([...playerIds, id])].sort().indexOf(id);
  const colors = ['#51a7f9', '#f29d38', '#44bc81', '#ea75be', '#b998f5', '#e4c84e',
    '#42c2d1', '#ef7066', '#94ba46', '#8299f2', '#dba17b', '#bd89bd',
    '#8fc9ef', '#d98233', '#74d7ba', '#dca5cc', '#9974d9', '#b4ac68',
    '#5da3a0', '#f3a09a', '#c1d982', '#bac4f5', '#ad8170', '#b6bac4'];
  const dashes = [undefined, '10 5', '3 5', '12 4 3 4'];
  return { color: colors[index % colors.length], dash: dashes[(index + Math.floor(index / colors.length)) % dashes.length] };
}
export function ChartLineKey({ id }: { id: string }) {
  const { players } = usePlayers();
  const style = chartLineStyle(id, players.map(p => p.id));
  return <svg className="chart-line-key" width="36" height="14" viewBox="0 0 36 14" aria-hidden="true"><path d="M2 7H34" stroke={style.color} strokeWidth="2" strokeDasharray={style.dash} strokeLinecap="round" /></svg>;
}

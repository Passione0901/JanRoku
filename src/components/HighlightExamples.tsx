import type { Player } from '../domain/types';
import { highlightLength, HIGHLIGHT_LIMIT } from '../domain/highlightText';

// Updated 2026-09-15: Keep example names stable during typing, with distinct opponents.
export function HighlightExamples({ members, seed }: { members: Player[]; seed: number }) {
  const names = [...new Set(members.map(member => member.name).filter(Boolean))];
  if (!names.length) return null;
  const offset = Math.floor(seed * names.length);
  const examples = Array.from({ length: 10 }, (_, index) => {
    const a = names[(offset + index) % names.length];
    const b = names[(offset + index + 1) % names.length];
    const templates = [
      `${a}が親で6000オールをツモった`,
      names.length > 1 ? `${a}が${b}から満貫をロンした` : `${a}が満貫をロンした`,
      names.length > 1 ? `${a}が${b}に倍満を振り込んだ` : `${a}が倍満をツモった`,
      `${a}が子で跳満をツモった`,
      `${a}がダブリー一発ツモを決めた`,
      `${a}が一局で3回カンして、嶺上開花でツモった`,
      `${a}が海底で満貫をツモった`,
      names.length > 1 ? `${a}が${b}から河底で跳満をロンした` : `${a}が河底で跳満をロンした`,
      `${a}が国士無双をツモった`,
      `${a}が最下位からトップに浮上した`,
    ];
    return templates[index];
  }).filter(example => highlightLength(example) <= HIGHLIGHT_LIMIT);
  if (!examples.length) return null;
  return <details className="highlight-examples">
    <summary>記入例を見る</summary>
    <p>実際にあった出来事を、メンバーの名前と一緒に記入してください。</p>
    <ul>{examples.map(example => <li key={example}>{example}</li>)}</ul>
  </details>;
}

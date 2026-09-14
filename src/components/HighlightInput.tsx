import { useRef, useState } from 'react';
import { highlightLength, HIGHLIGHT_LIMIT } from '../domain/highlightText';
import type { Player } from '../domain/types';
import { HighlightExamples } from './HighlightExamples';
// Updated 2026-09-14: Delay truncation until IME composition ends, preserving Japanese conversion.
export function HighlightInput({ value, onChange, members = [] }: { value: string; onChange: (value: string) => void; members?: Player[] }) {
  const composing = useRef(false);
  const [exampleSeed] = useState(() => Math.random());
  const limit = (text: string) => Array.from(text).slice(0, HIGHLIGHT_LIMIT).join('');
  return <div className="highlight-input">
    <label htmlFor="game-highlight">ハイライト（任意・50文字まで）</label>
    <textarea id="game-highlight" rows={2} value={value} aria-describedby="highlight-help highlight-count"
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={e => { composing.current = false; onChange(limit(e.currentTarget.value)); }}
      onChange={e => onChange(composing.current ? e.target.value : limit(e.target.value))} />
    <div className="highlight-caption"><small id="highlight-help">内容に応じてニュースに採用されます</small><small id="highlight-count">{highlightLength(value)} / 50</small></div>
    <HighlightExamples members={members} seed={exampleSeed} />
  </div>;
}

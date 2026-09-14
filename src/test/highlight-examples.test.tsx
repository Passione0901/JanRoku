import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HighlightInput } from '../components/HighlightInput';
import { HighlightExamples } from '../components/HighlightExamples';

const members = [{ id: 'a', name: '松信', color: '' }, { id: 'b', name: 'つっちー', color: '' }];
// Updated 2026-09-15: Examples must not change the user's memo or invent opponents.
describe('highlight examples', () => {
  it('uses roster names, stays stable while editing, and starts collapsed', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(<HighlightInput value="" onChange={onChange} members={members} />);
    expect(container.querySelector('details')?.open).toBe(false);
    const before = container.querySelector('ul')!.textContent;
    expect(container.querySelectorAll('li')).toHaveLength(10);
    expect(before).toContain('松信');
    expect(before).toContain('つっちー');
    expect(before).not.toMatch(/山田|佐藤/);
    expect(before).not.toMatch(/松信が松信|つっちーがつっちー/);
    fireEvent.click(screen.getByText('記入例を見る'));
    expect(onChange).not.toHaveBeenCalled();
    rerender(<HighlightInput value="メモを編集中" onChange={onChange} members={[...members]} />);
    expect(container.querySelector('ul')!.textContent).toBe(before);
    rerender(<HighlightInput value="メモを編集中" onChange={onChange} members={[{ id: 'c', name: '服部', color: '' }]} />);
    expect(container.querySelector('ul')!.textContent).not.toMatch(/松信|つっちー/);
  });
  it('avoids invented names with no members and self-discard with one member', () => {
    const { container, rerender } = render(<HighlightExamples members={[]} seed={0.5} />);
    expect(container.querySelector('details')).toBeNull();
    rerender(<HighlightExamples members={[members[0]]} seed={0.5} />);
    expect(container.querySelectorAll('li')).toHaveLength(10);
    expect(container.textContent).not.toContain('松信が松信');
  });
});

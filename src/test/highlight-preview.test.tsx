import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HighlightInput } from '../components/HighlightInput';
import { fixture } from './fixtures';
const members=['山田','田中','伊藤','斎藤'].map((name,i)=>({id:`sample0${i+1}`,name,color:''}));
const game=fixture('preview','2026-09-01');
describe('highlight recognition preview',()=>{
  it('waits for blur and separates recognition from routine publication',async()=>{
    const onChange=vi.fn();
    const {rerender}=render(<HighlightInput value="山田が満貫をツモった" onChange={onChange} members={members} analysisGame={game} />);
    expect(screen.queryByText('読み取れた内容')).toBeNull();
    fireEvent.blur(screen.getByRole('textbox'));
    await screen.findByText('通常の和了のため、ニュースには採用しません。');
    expect(screen.getByText('山田選手が満貫をツモ和了')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByRole('textbox'));
    rerender(<HighlightInput value="山田が初めて跳満を和了した" onChange={onChange} members={members} analysisGame={game} />);
    expect(screen.queryByText('読み取れた内容')).toBeNull();
    fireEvent.blur(screen.getByRole('textbox'));
    await screen.findByText('記事本文に掲載する重要な出来事です。');
    rerender(<HighlightInput value="" onChange={onChange} members={members} analysisGame={game} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('does not preserve another roster’s analysis after a member change',async()=>{
    const {rerender}=render(<HighlightInput value="山田が役満ツモ" onChange={()=>{}} members={members} analysisGame={game} />);
    fireEvent.blur(screen.getByRole('textbox'));
    await screen.findByText('記事本文に掲載する重要な出来事です。');
    rerender(<HighlightInput value="山田が役満ツモ" onChange={()=>{}} members={members.map(p=>({...p,name:p.name+'別'}))} analysisGame={game} />);
    await waitFor(()=>expect(screen.queryByText('山田選手が役満をツモ和了')).toBeNull());
    await screen.findByText(/ニュースに使える出来事を読み取れませんでした/);
  });
  it('waits for IME composition to complete',async()=>{
    render(<HighlightInput value="山田が役満ツモ" onChange={()=>{}} members={members} analysisGame={game} />);
    fireEvent.compositionStart(screen.getByRole('textbox'));
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.compositionEnd(screen.getByRole('textbox'));
    await screen.findByText('読み取れた内容');
  });
});

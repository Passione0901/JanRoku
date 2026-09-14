import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { HighlightInput } from './HighlightInput';
function Harness(){const[value,set]=useState('');return <HighlightInput value={value} onChange={set}/>;}
it('limits paste to 50 code points and waits for Japanese IME confirmation',()=>{
  render(<Harness/>);const input=screen.getByRole('textbox') as HTMLTextAreaElement;
  fireEvent.change(input,{target:{value:'あ'.repeat(51)}});expect(input.value).toHaveLength(50);
  fireEvent.compositionStart(input);
  fireEvent.change(input,{target:{value:'い'.repeat(52)}});expect(input.value).toHaveLength(52);
  fireEvent.compositionEnd(input);expect(input.value).toHaveLength(50);
  fireEvent.change(input,{target:{value:'😀'.repeat(51)}});expect(Array.from(input.value)).toHaveLength(50);
  expect(screen.getByText('50 / 50')).toBeTruthy();
});

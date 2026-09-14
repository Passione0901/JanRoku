import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { GameCard } from './GameCard';
import { PlayersProvider } from '../hooks/usePlayers';
import { LocalStoragePlayerRepository } from '../data/PlayerRepository';
import { fixture, MemoryStorage } from '../test/fixtures';
it('shows unparsed original text below the results safely, and hides empty notes',async()=>{
  const game={...fixture('highlight','2026-09-01'),highlight:'<img src=x onerror=alert(1)>'};
  const repository=new LocalStoragePlayerRepository(()=>new MemoryStorage());
  const view=(value:typeof game)=><PlayersProvider repository={repository}><GameCard game={value} label="第1戦" busy={false} onDelete={()=>{}}/></PlayersProvider>;
  const{container,rerender}=render(view(game));
  expect(await screen.findByText(game.highlight)).toBeTruthy();
  expect(container.querySelector('.game-highlight img')).toBeNull();
  expect(container.querySelector('table')!.nextElementSibling?.className).toBe('game-highlight');
  rerender(view({...game,highlight:''}));expect(container.querySelector('.game-highlight')).toBeNull();
});

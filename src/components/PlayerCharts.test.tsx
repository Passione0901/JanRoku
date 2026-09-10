import {render,screen,fireEvent} from '@testing-library/react';
import {it,expect} from 'vitest';
import {PlayersProvider} from '../hooks/usePlayers';
import {LocalStoragePlayerRepository} from '../data/PlayerRepository';
import {MemoryStorage,fixture} from '../test/fixtures';
import {calculatePlayerStats} from '../domain/stats';
import {PlayerCharts} from './PlayerCharts';
// 最終更新: 2026-09-10 — 選択切替とメンバー色の適用を確認する。
it('switches one member and all mode with member colors', async()=>{
 const storage=new MemoryStorage();
 const stats=['sample01','sample02'].map(id=>calculatePlayerStats(id,[fixture('g','2026-09-10')]));
 const {container}=render(<PlayersProvider repository={new LocalStoragePlayerRepository(()=>storage)}><PlayerCharts stats={stats}/></PlayersProvider>);
 const select=await screen.findByLabelText('表示するメンバー');
 expect(container.querySelectorAll('svg[role="img"]').length).toBe(1);
 fireEvent.change(select,{target:{value:'sample02'}});
 expect(container.querySelector('path[stroke="#a6b8df"]')).toBeTruthy();
 fireEvent.change(select,{target:{value:'all'}});
 expect(container.querySelectorAll('svg[role="img"]').length).toBe(1);
 expect(container.querySelector('path[stroke="#d6b773"]')).toBeTruthy();
 expect(container.querySelector('path[stroke="#a6b8df"]')).toBeTruthy();
});

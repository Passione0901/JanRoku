import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { CreateGroupPage } from './CreateGroupPage';

// Updated 2026-09-13: Test actual form input and response-loss recovery without touching shared records.
beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
afterEach(() => vi.unstubAllGlobals());
test('includes the last typed member, prevents duplicates and separates owner/participant links', async () => {
  const fetcher=vi.fn(async (_url,options) => Response.json({id:JSON.parse(options.body).requestId},{status:201}));
  vi.stubGlobal('fetch',fetcher);
  render(<CreateGroupPage />);
  fireEvent.change(screen.getByLabelText('グループ名'),{target:{value:'週末会'}});
  const field=screen.getByLabelText(/メンバー 後から/);
  fireEvent.change(field,{target:{value:'東さん'}}); fireEvent.click(screen.getByRole('button',{name:'追加'}));
  fireEvent.change(field,{target:{value:'東さん'}}); fireEvent.click(screen.getByRole('button',{name:'追加'}));
  expect(screen.getByRole('alert').textContent).toContain('同じ名前');
  fireEvent.change(field,{target:{value:'南さん'}}); fireEvent.click(screen.getByRole('button',{name:'グループを作成'}));
  await screen.findByText('参加者に送るURL');
  expect(JSON.parse(fetcher.mock.calls[0][1].body).members).toEqual(['東さん','南さん']);
  const participant=(screen.getByLabelText('参加者URL') as HTMLInputElement).value;
  const admin=(screen.getByLabelText('管理者URL') as HTMLInputElement).value;
  expect(participant).not.toBe(admin);
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain(admin.split('/').at(-1));
});
test('reload after response loss retries with the same operation and keys', async () => {
  const fetcher=vi.fn().mockRejectedValueOnce(new Error('通信切断')).mockImplementation(async (_url,options)=>Response.json({id:JSON.parse(options.body).requestId}));
  vi.stubGlobal('fetch',fetcher);
  const first=render(<CreateGroupPage hasGroup />);
  fireEvent.change(screen.getByLabelText('グループ名'),{target:{value:'新しい会'}});
  fireEvent.click(screen.getByRole('button',{name:'グループを作成'}));
  await screen.findByText('通信切断'); first.unmount();
  render(<CreateGroupPage hasGroup />);
  fireEvent.click(screen.getByRole('button',{name:'作成結果を確認・再試行'}));
  await screen.findByText('参加者に送るURL');
  expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
});
test('unfinished rule edits block creation and ordinary validation failures allow correction', async () => {
  const fetcher=vi.fn(async()=>Response.json({error:'入力を確認してください。'},{status:400})); vi.stubGlobal('fetch',fetcher);
  render(<CreateGroupPage />);
  fireEvent.change(screen.getByLabelText('グループ名'),{target:{value:'新しい会'}});
  fireEvent.click(screen.getByText('ルールを確認・変更'));
  fireEvent.click(screen.getByRole('button',{name:'ルールを変更'}));
  expect((screen.getByRole('button',{name:'グループを作成'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'キャンセル'}));
  fireEvent.click(screen.getByRole('button',{name:'グループを作成'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('入力を確認'));
  expect((screen.getByLabelText('グループ名') as HTMLInputElement).closest('fieldset')?.disabled).toBe(false);
});

import { useEffect, useState } from 'react';
import App from '../App';
import { CloudStore, invitationUrl, newToken } from '../data/CloudStore';
import { GroupContext } from '../hooks/useGroup';
import type { Game } from '../domain/types';
import { formatDate } from '../utils/date';
import { CreateGroupPage, createGroupUrl } from './CreateGroupPage';
import { useRoute } from '../hooks/useRoute';
import { CopyInvitationButton } from '../components/CopyInvitationButton';
import { invitationText } from '../utils/invitationText';

const sessionKey = 'janroku.shared-session.v1';
// Updated 2026-09-13: Remove the invitation from visible navigation after storing it in this tab only.
function takeToken() {
  const match = location.hash.match(/^#\/join\/([a-f0-9]{64})$/);
  if (match) {
    try { sessionStorage.setItem(sessionKey, match[1]); } catch { /* The open tab can still be used. */ }
    history.replaceState(null, '', `${location.pathname}${location.search}#/`);
    return match[1];
  }
  try { return sessionStorage.getItem(sessionKey) ?? ''; } catch { return ''; }
}

export function SharedPage() {
  const [store, setStore] = useState(() => { const token = takeToken(); return token ? new CloudStore(token) : null; });
  const route = useRoute();
  const [ready, setReady] = useState(false);
  const [, rerender] = useState(0);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  useEffect(() => {
    const join = () => {
      if (!location.hash.startsWith('#/join/')) return;
      const token = takeToken();
      if (token) { setReady(false); setStore(new CloudStore(token)); }
    };
    window.addEventListener('hashchange', join);
    return () => window.removeEventListener('hashchange', join);
  }, []);
  useEffect(() => {
    if (!store) return;
    let active = true;
    const unsubscribe = store.subscribe(() => { if (active) rerender(x => x + 1); });
    const refresh = () => { void store.sync().then(() => { if (active) setReady(true); }).catch(() => {}); };
    refresh();
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(visible, 30000);
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', visible);
    return () => { active = false; unsubscribe(); clearInterval(timer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [store]);
  if (route === '/new') return <CreateGroupPage hasGroup={!!store && !store.unauthorized} />;
  if (!store || store.unauthorized) return <main className="main-content shared-welcome">
    <span className="brand-mark">雀</span><h1>麻雀会の共有URLを開く</h1>
    <a className="button primary" href={createGroupUrl}>新しいグループをつくる</a>
    <p>{store?.unauthorized ? 'このURLは無効になっています。新しい共有URLを受け取ってください。' : '受け取った共有URLから、記録の閲覧・入力ができます。'}</p>
    <form onSubmit={event => {
      event.preventDefault();
      const token = input.trim().match(/#\/join\/([a-f0-9]{64})$/)?.[1];
      if (!token) { setInputError('共有URLをそのまま貼り付けてください。'); return; }
      location.hash = `/join/${token}`; setInputError('');
    }}><label>共有URL<input type="url" value={input} onChange={e => setInput(e.target.value)} required autoComplete="off" /></label><button className="button primary">開く</button></form>
    {inputError && <p role="alert">{inputError}</p>}
  </main>;
  if (!ready) return <main className="main-content"><p role="status">{store.error || '共有データを読み込み中…'}</p><button className="button subtle" onClick={() => { void store.sync().then(() => setReady(true)).catch(() => {}); }}>再読み込み</button></main>;
  return <GroupContext.Provider value={{ id: `cloud-${store.group.id}`, rules: store.rules, saveRules: store.saveRules }}>
    {store.error && <div className="shared-sync-error" role="alert">同期できていません：{store.error}<button className="button subtle" onClick={() => { void store.sync().catch(() => {}); }}>再接続</button></div>}
    <App key={store.group.id} gameRepository={store.gameRepository} playerRepository={store.playerRepository}
      sharedName={store.group.name} sharedAction={<><CopyInvitationButton key={store.group.id} store={store} /><a className="button subtle" href={createGroupUrl}>＋ グループを作成</a></>} sharedPanel={<SharedSettings store={store} />} />
  </GroupContext.Provider>;
}

// Updated 2026-09-13: Shared participants can recover deleted games; invitation rotation is administrator-only.
function SharedSettings({ store }: { store: CloudStore }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [trash, setTrash] = useState<(Game & { deletedAt: string })[]>([]);
  const [invite, setInvite] = useState(() => { try { const token = sessionStorage.getItem(`janroku.invitation.${store.group.id}`); return token ? invitationUrl(token) : ''; } catch { return ''; } });
  const loadTrash = async () => setTrash((await store.request<{ games: (Game & { deletedAt: string })[] }>('/trash')).games);
  useEffect(() => { void loadTrash().catch(e => setMessage(e.message)); }, [store]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await operation(); } catch (e) { setMessage(e instanceof Error ? e.message : '操作できませんでした。'); } finally { setBusy(false); }
  };
  return <div className="shared-settings">
    <div className="page-heading"><div><h1>共有・保存</h1><p>{store.group.name} · {store.group.role === 'admin' ? '管理者' : '参加者'}</p></div></div>
    <section className="panel settings-card"><h2>同期状況</h2>
      <p>{store.error || `最終同期 ${store.lastSynced ? new Date(store.lastSynced).toLocaleTimeString('ja-JP') : '—'}`}</p>
      <p>入力は保存ボタンで共有されます。ほかの人の変更は、画面を開いている間は約30秒ごとに反映されます。</p>
      <button className="button subtle" disabled={busy} onClick={() => { void run(async () => { await store.sync(); await loadTrash(); setMessage('最新の内容を読み込みました。'); }); }}>今すぐ同期</button>
    </section>
    <section className="panel settings-card"><h2>共有URL</h2>
      <p>参加者URLを知っている人は、記録・メンバー・ルールの閲覧と編集ができます。参加者にこのURLを送ってください。</p>
      {store.group.role === 'participant' ? <button className="button primary" disabled={busy} onClick={() => { void run(async () => { await navigator.clipboard.writeText(invitationText(store.group.name,invitationUrl(store.token))); setMessage('参加者URLをコピーしました。'); }); }}>参加者URLをコピー</button> : <>
        <p>管理者URLはあなた用に保管してください。参加者URLを再発行すると、以前の参加者URLは使えなくなります。</p>
        <button className="button subtle" disabled={busy} onClick={() => { void run(async () => { await navigator.clipboard.writeText(invitationUrl(store.token)); setMessage('管理者URLをコピーしました。'); }); }}>管理者URLをコピー</button>{' '}
        <button className="button subtle" disabled={busy} onClick={() => {
          if (!window.confirm('参加者URLを再発行します。以前の参加者URLは使えなくなります。続けますか？')) return;
          const token = newToken();
          void run(async () => { await store.rotateInvitation(token); setInvite(invitationUrl(token)); try { sessionStorage.setItem(`janroku.invitation.${store.group.id}`,token); } catch { /* Copy from the field. */ } setMessage('参加者URLを再発行しました。下のURLを参加者に送ってください。'); });
        }}>参加者URLを再発行</button>
        {invite && <><label>参加者URL<input readOnly value={invite} onFocus={e => e.currentTarget.select()} /></label><button className="button primary" onClick={() => { void run(async () => { await navigator.clipboard.writeText(invitationText(store.group.name,invite)); setMessage('参加者URLをコピーしました。'); }); }}>参加者URLをコピー</button></>}
      </>}
    </section>
    <section className="panel settings-card"><h2>バックアップ</h2><p>メンバー・対局・ルールをJSONファイルで保存します。名前と戦績が含まれます。</p>
      <button className="button subtle" disabled={busy} onClick={() => { void run(async () => {
        await store.sync();
        const url = URL.createObjectURL(new Blob([JSON.stringify(store.backup(), null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = `janroku-${store.group.id}-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }); }}>バックアップを保存</button>
    </section>
    <section className="panel settings-card"><h2>削除した対局</h2><p>直近100件まで表示します。</p>
      {!trash.length && <p>削除した対局はありません。</p>}
      {trash.map(game => <div className="shared-trash-row" key={game.id}><span>{formatDate(game.date)} · 削除 {new Date(game.deletedAt).toLocaleString('ja-JP')}</span><button className="button subtle" disabled={busy} onClick={() => { void run(async () => { await store.mutate({ kind: 'game', action: 'restore', id: game.id, expected: game.syncRevision }); await loadTrash(); setMessage('対局を復元しました。'); }); }}>復元</button></div>)}
    </section>
    <section className="panel settings-card"><h2>別のメンバーで遊ぶ</h2><p>新しいグループを作ると、メンバー・戦績・ルールを分けて記録できます。</p><a className="button subtle" href={createGroupUrl}>新しいグループをつくる</a></section>
    {message && <p role="status" className="notice">{message}</p>}
  </div>;
}

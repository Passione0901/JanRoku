import { useState } from 'react';
import { RuleEditor } from '../components/RuleEditor';
import { entryRules } from '../config/rules';
import { invitationUrl, newToken } from '../data/CloudStore';
import { normalize } from '../data/PlayerRepository';
import type { RuleConfig } from '../domain/types';
import { invitationText } from '../utils/invitationText';

const draftKey = 'janroku.group-creation.v1';
export const createGroupUrl = import.meta.env.VITE_SHARED_API === '/api' ? '#/new' : 'https://jang-roku.pages.dev/#/new';
type Attempt = { requestId: string; name: string; members: string[]; rules: RuleConfig; participant: string; admin: string; done?: boolean };
// Updated 2026-09-13: Preserve the operation and keys across reloads, including a lost success response.
function savedAttempt(): Attempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    return value && /^[a-f0-9-]{36}$/.test(value.requestId) && [value.participant,value.admin].every(t => /^[a-f0-9]{64}$/.test(t)) &&
      typeof value.name === 'string' && Array.isArray(value.members) && value.rules ? value : null;
  } catch { return null; }
}
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), n => n.toString(16).padStart(2,'0')).join('');

// Updated 2026-09-13: Every new group starts empty; existing group sessions remain intact until explicitly opened.
export function CreateGroupPage({ hasGroup = false }: { hasGroup?: boolean }) {
  const [attempt, setAttempt] = useState(savedAttempt);
  const [name, setName] = useState(() => attempt?.name ?? '');
  const [members, setMembers] = useState<string[]>(() => attempt?.members ?? []);
  const [member, setMember] = useState('');
  const [rules, setRules] = useState(() => attempt?.rules ?? entryRules);
  const [editingRules, setEditingRules] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const addMember = () => {
    try {
      const next = normalize(member);
      if (members.some(n => n.toLowerCase() === next.toLowerCase())) throw new Error('同じ名前のメンバーがいます。');
      if (members.length >= 40) throw new Error('作成時は40人まで追加できます。');
      setMembers([...members,next]); setMember(''); setError('');
    } catch (e) { setError((e as Error).message); }
  };
  const create = async () => {
    if (busy || editingRules) return;
    setError(''); setBusy(true);
    let current = attempt;
    try {
      if (!current) {
        const all = member.trim() ? [...members,normalize(member)] : members;
        if (all.length > 40 || new Set(all.map(n => n.toLowerCase())).size !== all.length) throw new Error('メンバーの重複や人数を確認してください。');
        current = {requestId:crypto.randomUUID(),name:normalize(name),members:all,rules,participant:newToken(),admin:newToken()};
        // Persist before sending so a committed group cannot lose its owner URL on reload.
        sessionStorage.setItem(draftKey,JSON.stringify(current));
        setAttempt(current); setMembers(all); setMember('');
      }
      const response = await fetch('/api/groups', {method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',referrerPolicy:'no-referrer',
        body:JSON.stringify({requestId:current.requestId,name:current.name,members:current.members,rules:current.rules,
          participantHash:await digest(current.participant),adminHash:await digest(current.admin)}),signal:AbortSignal.timeout(20000)});
      const result = await response.json();
      if (!response.ok) {
        if ([400,413,415,429].includes(response.status)) { sessionStorage.removeItem(draftKey); setAttempt(null); }
        throw new Error(result.error || '作成結果を確認できませんでした。同じ内容で再試行してください。');
      }
      if (result.id !== current.requestId) throw new Error('作成結果を確認できませんでした。再試行してください。');
      const completed = {...current,done:true};
      setAttempt(completed); sessionStorage.setItem(draftKey,JSON.stringify(completed));
      try { sessionStorage.setItem(`janroku.invitation.${result.id}`,current.participant); } catch { /* URLs are also shown below. */ }
    } catch (e) { setError(e instanceof Error ? e.message : '通信できませんでした。同じ内容で再試行してください。'); }
    finally { setBusy(false); }
  };
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(attempt && url === invitationUrl(attempt.participant) ? invitationText(attempt.name,url) : url); setMessage('URLをコピーしました。'); }
    catch { setMessage('コピーできませんでした。URLを選択してコピーしてください。'); }
  };
  return <main className="main-content group-create">
    <a className="group-create-brand" href="#/"><span className="brand-mark">雀</span><span>雀録 <small>Jang-roku</small></span></a>
    {attempt?.done ? <>
      <header><p className="group-create-eyebrow">作成完了</p><h1>{attempt.name}</h1><p>グループができました。参加者に共有URLを送って、記録を始めましょう。</p></header>
      <section className="group-link-card"><h2>参加者に送るURL</h2><p>このURLから、メンバー全員が戦績を閲覧・入力できます。</p>
        <label>参加者URL<input readOnly value={invitationUrl(attempt.participant)} onFocus={e => e.currentTarget.select()} /></label>
        <button className="button primary" onClick={() => { void copy(invitationUrl(attempt.participant)); }}>参加者URLをコピー</button></section>
      <section className="group-link-card"><h2>あなた用の管理者URL</h2><p>参加者URLの再発行に使います。ブックマークなどに保存してください。</p>
        <label>管理者URL<input readOnly value={invitationUrl(attempt.admin)} onFocus={e => e.currentTarget.select()} /></label>
        <button className="button subtle" onClick={() => { void copy(invitationUrl(attempt.admin)); }}>管理者URLをコピー</button></section>
      <a className="button primary group-create-submit" href={`#/join/${attempt.admin}`} onClick={() => { sessionStorage.removeItem(draftKey); }}>グループを開く</a>
      {message && <p role="status">{message}</p>}
    </> : <>
      <header><h1>グループをつくる</h1><p>いつもの仲間も、はじめての卓も。<br />グループごとに戦績を残せます。</p></header>
      <form onSubmit={e => { e.preventDefault(); void create(); }}>
        <fieldset disabled={busy || !!attempt} className="group-create-fields">
          <label htmlFor="group-name">グループ名<input id="group-name" autoComplete="off" value={name} maxLength={60} placeholder="週末の麻雀会" onChange={e => setName(e.target.value)} required /></label>
          <div><label htmlFor="group-member">メンバー <span className="group-create-optional">後から追加できます</span></label>
            <div className="group-member-entry"><input id="group-member" value={member} autoComplete="off" maxLength={60} placeholder="名前・ニックネーム" onChange={e => setMember(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) { e.preventDefault(); addMember(); } }} />
              <button type="button" className="button subtle" disabled={!member.trim()} onClick={addMember}>追加</button></div>
            <ul className="group-member-list" aria-label="追加するメンバー">{members.map((n,i) => <li key={n}><span>{n}</span><button type="button" aria-label={`${n}を外す`} onClick={() => setMembers(members.filter((_,j) => j !== i))}>×</button></li>)}</ul>
          </div>
          <details className="group-create-rules"><summary>ルールを確認・変更</summary><RuleEditor config={rules} onChange={setRules} busy={busy || !!attempt} scope="group" onEditingChange={setEditingRules} /></details>
        </fieldset>
        <p className="group-create-note">専用の共有URLを発行します。URLを知っている人が閲覧・編集できます。</p>
        {attempt && <p role="status">前回の作成結果を確認します。同じ内容で再試行しても、グループは重複しません。</p>}
        {editingRules && <p role="status">ルールの変更を適用するか、キャンセルしてから作成してください。</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary group-create-submit" disabled={busy || editingRules}>{busy ? '作成中…' : attempt ? '作成結果を確認・再試行' : 'グループを作成'}</button>
      </form>
      <a className="group-create-back" href="#/">{hasGroup ? '今のグループに戻る' : '共有URLをお持ちの方はこちら'}</a>
    </>}
  </main>;
}

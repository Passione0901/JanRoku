import { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { CloudStore, invitationUrl } from '../data/CloudStore';
import { invitationText } from '../utils/invitationText';

// Updated 2026-09-13: All group pages share one action; an administrator key is never copied as an invitation.
export function CopyInvitationButton({store}:{store:CloudStore}) {
  const [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [fallback,setFallback]=useState('');
  const [fading,setFading]=useState(false);
  // Updated 2026-09-13: Fade successful copy feedback after three seconds; keep recovery instructions readable.
  useEffect(() => {
    setFading(false);
    if(message !== '招待リンクをコピーしました' || fallback || busy) return;
    const fade=window.setTimeout(()=>setFading(true),3000);
    const clear=window.setTimeout(()=>setMessage(''),3400);
    return ()=>{window.clearTimeout(fade);window.clearTimeout(clear);};
  },[message,fallback,busy]);
  async function copy() {
    setBusy(true);setMessage('');setFallback('');
    try {
      let token=store.token;
      if(store.group.role === 'admin') {
        const endpoint=import.meta.env.VITE_SHARED_API === '/api' ? '/api/invitation' : 'https://jang-roku.pages.dev/api/invitation';
        const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${store.token}`},credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
        const data=await response.json();
        if(!response.ok) throw new Error(data.error || '招待リンクを取得できませんでした。');
        if(!/^[a-f0-9]{64}$/.test(data.token) || data.token === store.token) throw new Error('参加者用のリンクを確認できませんでした。');
        token=data.token;
      }
      const url=invitationText(store.group.name,invitationUrl(token));
      try { await navigator.clipboard.writeText(url); setMessage('招待リンクをコピーしました'); }
      catch { setFallback(url);setMessage('下のリンクを選択してコピーしてください'); }
    } catch(e) {setMessage(e instanceof Error ? e.message : 'コピーできませんでした。');}
    finally {setBusy(false);}
  }
  return <div className="invite-copy"><button type="button" className="button subtle" disabled={busy} onClick={()=>{void copy();}}><Copy size={16} aria-hidden="true" />{busy?'取得中…':'招待リンクをコピー'}</button>
    {message && <div className={`invite-copy-feedback${fading?' is-fading':''}`} role="status"><span>{message}</span>{fallback && <textarea rows={6} aria-label="参加者用の招待文" readOnly value={fallback} onFocus={e=>e.currentTarget.select()} />}
      <button type="button" aria-label="通知を閉じる" onClick={()=>{setMessage('');setFallback('');}}>×</button></div>}
  </div>;
}

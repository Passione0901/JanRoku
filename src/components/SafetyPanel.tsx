import { useEffect, useState } from 'react';
import { CloudStore, invitationUrl, newToken } from '../data/CloudStore';
type Controls={paused:boolean;newsEnabled:boolean;revision:number;bytes:number};
type Change={revision:number;entity_type:string;entity_id:string;action:string;created_at:string};
// Updated 2026-09-14: Admin controls and undo use server-side revisions to avoid overwriting a concurrent edit.
export function SafetyPanel({store}:{store:CloudStore}){
 const [controls,setControls]=useState<Controls|null>(null),[changes,setChanges]=useState<Change[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[viewer,setViewer]=useState('');
 const load=async()=>{setControls(await store.request('/management'));setChanges((await store.request<{changes:Change[]}>('/changes')).changes);};
 useEffect(()=>{void load().catch(e=>setMessage(e.message));},[store]);
 const run=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn();await store.sync();await load();}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
 return <section className="panel settings-card"><h2>グループの管理</h2>
 <p>管理者URLを知っている人が操作できます。他の参加者には参加者URLまたは閲覧専用URLを渡してください。</p>
 {controls&&<><p>保存量（記録・変更履歴）：{(controls.bytes/1048576).toFixed(2)} / 20 MB</p>
 <label><input type="checkbox" checked={controls.paused} disabled={busy} onChange={e=>{const paused=e.target.checked;void run(async()=>{await store.request('/management',{action:'controls',...controls,paused,expected:controls.revision});setMessage(paused?'書き込みを停止しました。':'書き込みを再開しました。');});}}/> 書き込みを一時停止</label>
 <label><input type="checkbox" checked={controls.newsEnabled} disabled={busy} onChange={e=>{const newsEnabled=e.target.checked;void run(async()=>{await store.request('/management',{action:'controls',...controls,newsEnabled,expected:controls.revision});setMessage('ニュースの表示設定を変更しました。');});}}/> 架空ニュースを表示</label></>}
 <h3>URLが流出したとき</h3><p>すべての共有URLを無効にして、管理者URLも含めて作り直せます。新しいURLはこのタブに保存してから切り替えます。</p>
 <button className="button subtle" disabled={busy} onClick={()=>{if(!confirm('現在の管理者・参加者・閲覧専用URLをすべて無効にします。続けますか？'))return;void run(async()=>{const admin=newToken(),participant=newToken();const key=`janroku.rotation.${store.group.id}`;sessionStorage.setItem(key,JSON.stringify({admin,participant}));const hash=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t))),n=>n.toString(16).padStart(2,'0')).join('');try{await store.request('/management',{action:'rotate-all',adminHash:await hash(admin),participantHash:await hash(participant)});}catch(e){try{await new CloudStore(admin).request('/version');}catch{throw e;}}sessionStorage.setItem(`janroku.invitation.${store.group.id}`,participant);location.hash=`/join/${admin}`;});}}>すべてのURLを再発行</button>
 <h3>閲覧専用URL</h3><p>記録を変更できないURLです。再発行すると以前の閲覧専用URLは無効になります。</p>
 <button className="button subtle" disabled={busy} onClick={()=>{if(!confirm('閲覧専用URLを発行します。以前の閲覧専用URLは無効になります。'))return;void run(async()=>{const token=newToken();const tokenHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('');sessionStorage.setItem(`janroku.viewer.${store.group.id}`,token);setViewer(invitationUrl(token));await store.request('/management',{action:'viewer',tokenHash});setMessage('閲覧専用URLを発行しました。');});}}>閲覧専用URLを発行</button>
 {viewer&&<label>閲覧専用URL<input readOnly value={viewer} onFocus={e=>e.currentTarget.select()}/></label>}
 <h3>バックアップから復元</h3><p>新しく作った、メンバーも対局もないグループに復元できます。100人・1,000対局・5MBまで。元のグループは変更しません。</p>
 <label>バックアップJSON<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(!file)return;void run(async()=>{if(file.size>5*1024*1024)throw new Error('5MB以内のファイルを選んでください。');const data=JSON.parse(await file.text());if(!confirm('この空のグループにバックアップを復元しますか？'))return;const key=`janroku.restore.${store.group.id}`;let requestId=sessionStorage.getItem(key);if(!requestId){requestId=crypto.randomUUID();sessionStorage.setItem(key,requestId);}await store.request('/management',{action:'import',data,requestId});sessionStorage.removeItem(key);setMessage('復元しました。');});}}/></label>
 <h3>最近の変更</h3><p>直近30件。保存済みの編集を取り消せます。後から変更されている場合は上書きしません。個人ログインはないため、編集者本人の特定はできません。</p>
 {changes.map(c=><div className="shared-trash-row" key={c.revision}><span>{new Date(c.created_at).toLocaleString('ja-JP')} · {{game:'対局',member:'メンバー',rules:'ルール',access_key:'招待URL'}[c.entity_type]||'設定'} · {{save:'編集',add:'追加',delete:'削除',restore:'復元',rotate:'再発行'}[c.action]||c.action}</span>{c.action==='save'&&<button className="button subtle" disabled={busy||controls?.paused} onClick={()=>{if(!confirm('この編集直前の内容に戻しますか？'))return;void run(async()=>{const expected=store.currentRevision(c.entity_type,c.entity_id);if(expected!==String(c.revision))throw new Error('この後に変更されています。最新の編集から確認してください。');await store.request('/management',{action:'undo',revision:c.revision,expected,requestId:crypto.randomUUID()});setMessage('編集を取り消しました。');});}}>編集を取り消す</button>}</div>)}
 {message&&<p role="status">{message}</p>}
 </section>;
}

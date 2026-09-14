import {useEffect,useId,useRef,useState} from 'react';
import {QrCode,Download,X} from 'lucide-react';
import type {CloudStore} from '../data/CloudStore';
import {groupInvitationUrl,invitationQrImage} from '../utils/groupInvitation';
// Updated 2026-09-14: Native dialog traps focus and supports Escape; closing discards the invitation image.
export function InvitationQrButton({store}:{store:CloudStore}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="button subtle" onClick={()=>setOpen(true)}><QrCode size={16} aria-hidden="true"/>QRコード</button>{open&&<InvitationQrDialog store={store} onClose={()=>setOpen(false)}/>}</>;
}
function InvitationQrDialog({store,onClose}:{store:CloudStore;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 const [image,setImage]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const el=dialog.current;el?.showModal();return()=>el?.close();},[]);
 useEffect(()=>{let active=true;setImage('');setError('');void groupInvitationUrl(store).then(invitationQrImage).then(value=>{if(active)setImage(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'QRコードを作成できませんでした。');});return()=>{active=false;};},[store,attempt]);
 return <dialog ref={dialog} className="confirm-dialog invitation-qr-dialog" aria-labelledby={titleId} onCancel={e=>{e.preventDefault();onClose();}}>
 <button type="button" className="button subtle invitation-qr-close" aria-label="QRコードを閉じる" onClick={onClose} autoFocus><X size={20}/></button>
 <h2 id={titleId}>QRコードで招待</h2><p className="invitation-qr-name">{store.group.name}</p>
 <div className="invitation-qr-image">{image?<img src={image} width={256} height={256} alt={`${store.group.name}の招待用QRコード`}/>:error?<div role="alert"><p>{error}</p><button type="button" className="button subtle" onClick={()=>setAttempt(n=>n+1)}>再試行</button></div>:<p role="status">QRコードを作成中…</p>}</div>
 <p>スマートフォンのカメラで読み取ってください。<br/>{store.group.role==='viewer'?'読み取った人は記録を閲覧できます。':'読み取った人はグループの記録を閲覧・編集できます。'}</p>
 {image&&<a className="button primary" href={image} download="janroku-invitation-qr.png"><Download size={16} aria-hidden="true"/>画像を保存</a>}
 </dialog>;
}

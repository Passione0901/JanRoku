import { CloudStore, invitationUrl } from '../data/CloudStore';
// Updated 2026-09-14: Clipboard and QR sharing resolve the same invitation; administrator keys never leave through either action.
export async function groupInvitationUrl(store: CloudStore): Promise<string> {
  let token=store.token;
  if(store.group.role==='admin'){
    const endpoint=import.meta.env.VITE_SHARED_API==='/api'?'/api/invitation':'https://jang-roku.pages.dev/api/invitation';
    const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${store.token}`},credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||'招待リンクを取得できませんでした。');
    if(!/^[a-f0-9]{64}$/.test(data.token)||data.token===store.token)throw new Error('参加者用のリンクを確認できませんでした。');
    token=data.token;
  }
  if(!/^[a-f0-9]{64}$/.test(token))throw new Error('招待リンクを確認できませんでした。');
  return invitationUrl(token);
}
// Updated 2026-09-14: Local PNG generation keeps group keys away from third-party QR services; preserve a four-module quiet zone.
export async function invitationQrImage(url:string):Promise<string>{
  const QRCode=await import('qrcode');
  return QRCode.toDataURL(url,{type:'image/png',width:512,margin:4,errorCorrectionLevel:'M',color:{dark:'#000000',light:'#ffffff'}});
}

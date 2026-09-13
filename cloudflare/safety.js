import schema from './migrations/0004_public_safety.sql';
export const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
// Updated 2026-09-14: Fixed additive migrations run once per database and never accept client SQL.
export async function ensureSafety(db){
  if(await db.prepare('SELECT version FROM schema_versions WHERE version=4').first())return;
  await db.batch(schema.split('-- statement-break').map(s=>s.trim()).filter(Boolean).map(s=>db.prepare(s)));
}
export function safetyError(error){
  const value=String(error);
  if(value.includes('GROUP_PAUSED'))return {status:423,error:'管理者が書き込みを一時停止しています。'};
  if(value.includes('count<=maximum'))return {status:429,error:'保存回数の上限に達しました。時間を置いて再試行してください。'};
  if(value.includes('GROUP_GAME_LIMIT'))return {status:409,error:'このグループの対局数上限（削除済みを含め5,000件）に達しました。'};
  if(value.includes('GROUP_HISTORY_LIMIT'))return {status:409,error:'このグループの変更履歴上限（20,000件）に達しました。バックアップを保存してください。'};
  if(value.includes('bytes<='))return {status:507,error:'保存容量の上限に達しました。バックアップを保存し、管理者にご連絡ください。'};
  if(value.includes('RECORD_SIZE_LIMIT'))return {status:413,error:'1件の記録は8KBまでです。'};
  return {status:error.status??503,error:error.status?error.message:'保存サーバーに接続できませんでした。時間を置いて再試行してください。'};
}
export async function readJson(request,limit=32768){
  const reader=request.body?.getReader();if(!reader)fail('入力がありません。');
  let size=0;const chunks=[];
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>limit){await reader.cancel();fail('入力が大きすぎます。',413);}chunks.push(part.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||typeof data!=='object'||Array.isArray(data))fail('入力が不正です。');return data;}catch{fail('入力が不正です。');}
}
// Updated 2026-09-14: Additional IP limits cover authenticated writes; shared DB triggers bound all group writes.
export async function limitWriteIp(request,db){
  await db.prepare("DELETE FROM write_windows WHERE expires_at<datetime('now')").run();
  const ip=request.headers.get('CF-Connecting-IP');if(!ip)return; // Local tests have no trusted edge IP.
  const bucket=`ip:${new Date().toISOString().slice(0,16)}:${await hash(ip)}`;
  try{await db.prepare("INSERT INTO write_windows VALUES(?,1,60,datetime('now','+2 days')) ON CONFLICT(bucket) DO UPDATE SET count=count+1").bind(bucket).run();}
  catch(e){if(String(e).includes('CHECK constraint'))fail('短時間に操作が集中しています。1分ほど待ってください。',429);throw e;}
}

const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2,'0')).join('');
const json = (value,status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
// Updated 2026-09-13: Issue a stable participant-only alias for administrators without invalidating existing invitations.
export async function invitation(request,env) {
  if(request.method !== 'POST') return json({error:'POSTのみ利用できます。'},405);
  const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(!token || !/^[a-f0-9]{64}$/.test(token)) return json({error:'共有URLを開き直してください。'},401);
  try {
    const adminHash=await digest(token);
    const actor=await env.DB.prepare("SELECT a.group_id,a.role FROM access_keys a JOIN groups g ON g.id=a.group_id WHERE a.token_hash=? AND a.revoked_at IS NULL AND g.deleted_at IS NULL").bind(adminHash).first();
    if(!actor) return json({error:'共有URLが無効です。'},401);
    if(actor.role !== 'admin') return json({token});
    for(let i=0;i<3;i++) {
      const anchor=await env.DB.prepare("SELECT token_hash,created_at FROM access_keys WHERE group_id=? AND role='participant' AND revoked_at IS NULL ORDER BY created_at,token_hash LIMIT 1").bind(actor.group_id).first();
      if(!anchor) return json({error:'共有・保存から参加者URLを再発行してください。'},409);
      const participant=await digest(`janroku-participant-link:v1:${token}:${anchor.token_hash}`), participantHash=await digest(participant);
      // Aliases always sort after their anchor; repeated copies cannot produce an unbounded chain of keys.
      const createdAt=new Date(Math.max(Date.now(),Date.parse(anchor.created_at)+1)).toISOString();
      await env.DB.prepare("INSERT OR IGNORE INTO access_keys(token_hash,group_id,role,created_at) SELECT ?,?,'participant',? WHERE EXISTS(SELECT 1 FROM access_keys WHERE token_hash=? AND group_id=? AND revoked_at IS NULL) AND EXISTS(SELECT 1 FROM access_keys WHERE token_hash=? AND group_id=? AND role='admin' AND revoked_at IS NULL)").bind(participantHash,actor.group_id,createdAt,anchor.token_hash,actor.group_id,adminHash,actor.group_id).run();
      const active=await env.DB.prepare('SELECT token_hash FROM access_keys WHERE token_hash=? AND revoked_at IS NULL').bind(participantHash).first();
      if(active) return json({token:participant});
    }
    return json({error:'URLが更新されています。もう一度お試しください。'},409);
  } catch { return json({error:'招待リンクを取得できませんでした。もう一度お試しください。'},503); }
}

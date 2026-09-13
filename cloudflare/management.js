import {restoreBackup} from './restore.js';
import { fail, readJson } from './safety.js';
// Updated 2026-09-14: Administrative operations stay scoped to the authenticated group.
export async function manage(request,db,actor,mutate){
  if(actor.role!=='admin')fail('管理者URLが必要です。',403);
  if(request.method==='GET'){
    const controls=await db.prepare('SELECT * FROM group_controls WHERE group_id=?').bind(actor.id).first();
    const usage=await db.prepare('SELECT bytes FROM group_usage WHERE group_id=?').bind(actor.id).first();
    return {paused:!!controls?.paused,newsEnabled:controls?.news_enabled!==0,revision:controls?.revision??0,bytes:usage?.bytes??0};
  }
  if(request.method!=='POST')fail('未対応の操作です。',405);
  const b=await readJson(request,5*1024*1024);
  if(b.action==='import')return restoreBackup(db,actor,b);
  if(b.action==='controls'){
    if(typeof b.paused!=='boolean'||typeof b.newsEnabled!=='boolean'||!Number.isSafeInteger(b.expected))fail('設定が不正です。');
    await db.prepare('INSERT OR IGNORE INTO group_controls(group_id) VALUES(?)').bind(actor.id).run();
    const saved=await db.prepare('UPDATE group_controls SET paused=?,news_enabled=?,revision=revision+1 WHERE group_id=? AND revision=? RETURNING revision').bind(+b.paused,+b.newsEnabled,actor.id,b.expected).first();
    if(!saved)fail('設定が更新されています。開き直してください。',409);
    return saved;
  }
  if(b.action==='rotate-all'){
    if(!/^[a-f0-9]{64}$/.test(b.adminHash??'')||!/^[a-f0-9]{64}$/.test(b.participantHash??'')||b.adminHash===b.participantHash)fail('キーが不正です。');
    const now=new Date().toISOString();
    await db.batch([
      db.prepare('UPDATE access_keys SET revoked_at=? WHERE group_id=? AND revoked_at IS NULL AND EXISTS(SELECT 1 FROM access_keys WHERE token_hash=? AND revoked_at IS NULL)').bind(now,actor.id,actor.tokenHash),
      db.prepare('INSERT INTO mutation_guard VALUES(CASE WHEN changes()>0 THEN 1 ELSE 0 END)'),
      db.prepare("INSERT INTO access_keys VALUES(?,?,'admin',?,NULL)").bind(b.adminHash,actor.id,now),
      db.prepare("INSERT INTO access_keys VALUES(?,?,'participant',?,NULL)").bind(b.participantHash,actor.id,now),
      db.prepare('DELETE FROM viewer_keys WHERE group_id=?').bind(actor.id),db.prepare('DELETE FROM mutation_guard')
    ]);return {ok:true};
  }
  if(b.action==='viewer'){
    if(!/^[a-f0-9]{64}$/.test(b.tokenHash??''))fail('キーが不正です。');
    await db.prepare('INSERT INTO viewer_keys VALUES(?,?,?) ON CONFLICT(group_id) DO UPDATE SET token_hash=excluded.token_hash,created_at=excluded.created_at').bind(actor.id,b.tokenHash,new Date().toISOString()).run();
    return {ok:true};
  }
  if(b.action==='undo'){
    if(!Number.isSafeInteger(b.revision))fail('履歴が不正です。');
    const row=await db.prepare("SELECT * FROM change_history WHERE group_id=? AND revision=? AND action='save' AND before_json IS NOT NULL").bind(actor.id,b.revision).first();
    if(!row||!['game','rules','member'].includes(row.entity_type))fail('この履歴は取り消せません。');
    return mutate(db,actor,{requestId:b.requestId,kind:row.entity_type,action:'save',id:row.entity_id,data:JSON.parse(row.before_json),expected:b.expected});
  }
  fail('未対応の操作です。');
}

import {validateShared} from '../src/data/sharedData.ts';
import {fail} from './safety.js';
// Updated 2026-09-14: Restore only to an empty group, in one guarded transaction; never merge over existing records.
export async function restoreBackup(db,actor,b){
 if(!/^[a-f0-9-]{36}$/.test(b.requestId??''))fail('復元IDが不正です。');
 const prior=await db.prepare('SELECT revision FROM change_history WHERE group_id=? AND request_id=?').bind(actor.id,b.requestId).first();if(prior)return prior;
 let data;try{data=validateShared(b.data);}catch(e){fail(e.message);}
 if(!data.rules||data.players.length>100||data.games.length>1000||JSON.stringify(data.rules).length>2048)fail('復元は100人・1,000対局までです。');
 const count=await db.prepare('SELECT (SELECT count(*) FROM members WHERE group_id=?)+(SELECT count(*) FROM games WHERE group_id=?) AS n').bind(actor.id,actor.id).first();
 if(count.n!==0||actor.revision!==0)fail('新しく作った空のグループに復元してください。',409);
 const now=new Date().toISOString();
 const players=data.players.map(({id,name,color})=>({id,name,color})),games=data.games.map(({syncRevision,...g})=>g);
 const events=[...players.map(data=>({kind:'member',id:data.id,data})),...games.map(data=>({kind:'game',id:data.id,data}))].map((e,i)=>({...e,revision:i+1}));
 const rev=events.length+1;
 await db.batch([
  db.prepare('UPDATE groups SET revision=?,updated_at=? WHERE id=? AND revision=0').bind(rev,now,actor.id),
  db.prepare('INSERT INTO mutation_guard VALUES(CASE WHEN changes()=1 THEN 1 ELSE 0 END)'),
  db.prepare('INSERT INTO elevated_transactions VALUES(?)').bind(actor.id),
  db.prepare("INSERT INTO members(group_id,id,profile_json,revision,created_at,updated_at) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.data'),json_extract(value,'$.revision'),?,? FROM json_each(?) WHERE json_extract(value,'$.kind')='member'").bind(actor.id,now,now,JSON.stringify(events)),
  db.prepare("INSERT INTO games(group_id,id,event_date,game_json,revision,created_at,updated_at) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.data.date'),json_extract(value,'$.data'),json_extract(value,'$.revision'),json_extract(value,'$.data.createdAt'),? FROM json_each(?) WHERE json_extract(value,'$.kind')='game'").bind(actor.id,now,JSON.stringify(events)),
  db.prepare("INSERT INTO change_history(group_id,revision,request_id,entity_type,entity_id,action,after_json,created_at) SELECT ?,json_extract(value,'$.revision'),?||'-'||json_extract(value,'$.revision'),json_extract(value,'$.kind'),json_extract(value,'$.id'),'add',json_extract(value,'$.data'),? FROM json_each(?)").bind(actor.id,b.requestId,now,JSON.stringify(events)),
  db.prepare('UPDATE group_rules SET config_json=?,revision=?,updated_at=? WHERE group_id=?').bind(JSON.stringify(data.rules),rev,now,actor.id),
  db.prepare("INSERT INTO change_history(group_id,revision,request_id,entity_type,entity_id,action,after_json,created_at) VALUES(?,?,?,'rules',?,'save',?,?)").bind(actor.id,rev,b.requestId,actor.id,JSON.stringify(data.rules),now),
  db.prepare('DELETE FROM elevated_transactions WHERE group_id=?').bind(actor.id),db.prepare('DELETE FROM mutation_guard')
 ]);
 return {revision:rev};
}

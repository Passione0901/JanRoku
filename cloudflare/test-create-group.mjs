import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Updated 2026-09-13: Real SQL verifies creation rollback, quota races and compatibility with existing sync/edit APIs.
await build({entryPoints:['cloudflare/pages-proxy.js'],bundle:true,format:'esm',platform:'browser',loader:{'.sql':'text'},outfile:'dist-worker/pages-test.mjs'});
await build({entryPoints:['cloudflare/api.js'],bundle:true,format:'esm',platform:'browser',outfile:'dist-worker/api-test.mjs'});
const {default:pages} = await import('../dist-worker/pages-test.mjs');
const {default:api} = await import('../dist-worker/api-test.mjs');
const sql = new DatabaseSync(':memory:');
for (const file of ['0001_initial.sql','0002_mutation_guard.sql']) sql.exec(readFileSync(`cloudflare/migrations/${file}`,'utf8'));
class Statement {
  constructor(text) { this.text=text; this.params=[]; }
  bind(...params) { this.params=params; return this; }
  run() { return {results:sql.prepare(this.text).all(...this.params)}; }
  async first() { return this.run().results[0] ?? null; }
  async all() { return this.run(); }
}
const DB = {prepare:text=>new Statement(text),batch:async statements=>{
  sql.exec('BEGIN'); try {const result=statements.map(s=>s.run()); sql.exec('COMMIT'); return result;}
  catch(e){sql.exec('ROLLBACK');throw e;}
}};
const hash = s=>createHash('sha256').update(s).digest('hex');
const rules={id:'test',playerCount:4,startingPoints:25000,returnPoints:30000,scoreUnit:100,resultDivisor:1000,uma:[10,5,-5,-10],oka:'winner',tieBreak:'seat-order',bustIncludesZero:false};
const fresh = (members=['東さん','南さん','西さん','北さん']) => {
  const admin=hash(crypto.randomUUID()), participant=hash(crypto.randomUUID());
  return {admin,participant,body:{requestId:crypto.randomUUID(),name:'週末の卓',members,rules,adminHash:hash(admin),participantHash:hash(participant)}};
};
const call=async(body,ip='192.0.2.1',extra={})=>{
  const response=await pages.fetch(new Request('https://test.invalid/api/groups',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':ip,...extra},body:JSON.stringify(body)}),{DB});
  return {status:response.status,data:await response.json().catch(()=>null)};
};
const sync=async token=>{
  const r=await api.fetch(new Request('https://api.invalid/sync',{headers:{Authorization:`Bearer ${token}`}}),{DB});return {status:r.status,data:await r.json()};
};
const a=fresh(), b=fresh(['別の人']);
assert.equal((await call({...a.body,name:' '})).status,400);
assert.equal((await call({...a.body,members:['Ａ','A']})).status,400);
assert.equal((await call({...a.body,rules:{...rules,uma:[10,5,-5,-11]}})).status,400);
assert.equal((await call(a.body,'192.0.2.1',{Origin:'https://evil.invalid'})).status,403);
assert.equal((await call({...a.body,name:'x'.repeat(40000)})).status,413);
assert.equal(sql.prepare('SELECT count(*) n FROM groups').get().n,0);
assert.equal((await call(a.body)).status,201);
assert.equal((await call(a.body)).status,200);
assert.equal((await call({...a.body,name:'変更'})).status,409);
assert.equal((await call(b.body)).status,201);
assert.equal(sql.prepare('SELECT count(*) n FROM groups').get().n,2);
const first=await sync(a.participant);
assert.equal(first.data.group.role,'participant');
assert.equal((await sync(a.admin)).data.group.role,'admin');
assert.equal(first.data.changes.length,4);
assert.equal((await sync(b.participant)).data.changes.length,1);
assert.deepEqual(first.data.rules,rules);
const member=first.data.changes[0];
const edit=await api.fetch(new Request('https://api.invalid/mutation',{method:'POST',headers:{Authorization:`Bearer ${a.participant}`},body:JSON.stringify({requestId:crypto.randomUUID(),kind:'member',action:'save',id:member.id,expected:member.revision,data:{name:'変更後'}})}),{DB});
assert.equal(edit.status,200);
assert.equal((await sync(b.participant)).data.changes.length,1);
const collision=fresh(); collision.body.adminHash=a.body.adminHash;
assert.equal((await call(collision.body)).status,503);
assert.equal(sql.prepare('SELECT count(*) n FROM groups').get().n,2);
assert.equal(sql.prepare('SELECT count FROM group_creation_limits WHERE bucket LIKE ?').get('%:all').count,2);
const c=fresh([]);
assert.deepEqual((await Promise.all([call(c.body),call(c.body)])).map(r=>r.status).sort(),[200,201]);
assert.equal((await sync(c.participant)).data.changes.length,0);
for(let i=0;i<6;i++) assert.equal((await call(fresh([]).body)).status,201);
const race=await Promise.all([call(fresh([]).body),call(fresh([]).body)]);
assert.deepEqual(race.map(r=>r.status).sort(),[201,429]);
assert.equal(sql.prepare('SELECT count(*) n FROM groups').get().n,10);
assert.equal((await call(a.body)).status,200); // Recover a committed request even at quota.
assert.equal((await call(fresh(Array.from({length:40},(_,i)=>`人${i}`)).body,'192.0.2.2')).status,201);
assert.equal((await call(fresh(Array.from({length:41},(_,i)=>`人${i}`)).body,'192.0.2.2')).status,400);
console.log('PASS: creation, validation, origin/body bounds, roles, isolation, sync/edit, retry recovery, duplicate races, full rollback, atomic quotas, empty/40-member groups');

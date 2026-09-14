import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Updated 2026-09-13: Exercise real SQL transactions with anonymous fixtures, never production records.
await build({ entryPoints: ['cloudflare/api.js'], bundle: true, format: 'esm', platform: 'browser', loader:{'.sql':'text'}, outfile: 'dist-worker/worker.mjs' });
await build({ entryPoints: ['src/domain/directResults.ts'], bundle: true, format: 'esm', platform: 'browser', outfile: 'dist-worker/fixtures.mjs' });
const { default: api } = await import('../dist-worker/worker.mjs');
const { createResultGame } = await import('../dist-worker/fixtures.mjs');
const sql = new DatabaseSync(':memory:');
for (const migration of ['0001_initial.sql', '0002_mutation_guard.sql']) sql.exec(readFileSync(`cloudflare/migrations/${migration}`, 'utf8'));
class Statement {
  constructor(text) { this.text = text; this.params = []; }
  bind(...params) { this.params = params; return this; }
  run() { return { results: sql.prepare(this.text).all(...this.params) }; }
  async first() { return this.run().results[0] ?? null; }
  async all() { return this.run(); }
}
const db = { prepare: text => new Statement(text), batch: async statements => {
  sql.exec('BEGIN');
  try { const result = statements.map(s => s.run()); sql.exec('COMMIT'); return result; }
  catch (e) { sql.exec('ROLLBACK'); throw e; }
} };
const tokens = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
const digest = text => createHash('sha256').update(text).digest('hex');
const now = new Date().toISOString();
const fixture = createResultGame({ id: 'game-1', date: '2026-08-06', createdAt: '2020-01-01T00:00:00Z', entries: [40, 10, -20, -30].map((result, i) => ({ playerId: `member-${i}`, result })) });
for (const group of ['group-a','group-b']) {
  sql.prepare('INSERT INTO groups(id,name,created_at,updated_at) VALUES(?,?,?,?)').run(group, group, now, now);
  sql.prepare('INSERT INTO group_rules VALUES(?,?,?,?)').run(group, JSON.stringify(fixture.rules), 0, now);
}
for (const [i, token] of tokens.entries()) sql.prepare('INSERT INTO access_keys(token_hash,group_id,role,created_at) VALUES(?,?,?,?)').run(digest(token), i === 2 ? 'group-b' : 'group-a', i === 1 ? 'admin' : 'participant', now);
const call = async (path, body, token = tokens[0], extraHeaders = {}) => {
  const response = await api.fetch(new Request(`https://test.invalid${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...extraHeaders }, ...(body ? { body: JSON.stringify(body) } : {}) }), { DB: db });
  return { status: response.status, data: await response.json() };
};
const op = body => ({ requestId: crypto.randomUUID(), ...body });
assert.equal((await call('/sync','', '')).status, 401);
assert.equal((await call('/sync',null,tokens[0],{Origin:'https://attacker.invalid'})).status,403);
for (let i=0; i<4; i++) assert.equal((await call('/mutation', op({kind:'member',action:'add',id:`member-${i}`,data:{name:`選手${i}`}}))).status,200);
fixture.highlight = '選手0が役満ツモ';
assert.equal((await call('/mutation',op({kind:'game',action:'add',id:fixture.id,data:{...fixture,highlight:'あ'.repeat(51)}}))).status,400);
const add = op({ kind:'game', action:'add', id:fixture.id, data:fixture });
assert.equal((await call('/mutation',add)).status,200);
assert.equal((await call('/mutation',add)).status,200);
assert.equal(sql.prepare('SELECT count(*) n FROM games').get().n,1);
const first = (await call('/sync')).data;
assert.equal(first.changes.length,5);
const game = first.changes.find(c=>c.kind==='game');
assert.equal(game.data.highlight,fixture.highlight);
assert.equal(game.data.date,'2026-08-06');
assert.notEqual(game.data.createdAt,fixture.createdAt);
assert.equal((await call('/sync?since=5')).data.changes.length,0);
assert.equal((await call('/sync',null,tokens[2])).data.changes.length,0);
assert.equal((await call('/mutation',op({kind:'game',action:'save',id:fixture.id,data:fixture,expected:game.revision}),tokens[2])).status,409);
const concurrent = await Promise.all(['one','two'].map(note=>call('/mutation',op({kind:'game',action:'save',id:fixture.id,data:{...fixture,note},expected:game.revision}))));
assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
assert.equal(sql.prepare('SELECT revision FROM groups WHERE id=?').get('group-a').revision,6);
assert.equal((await call('/mutation',op({kind:'member',action:'delete',id:'member-0',expected:'1'}))).status,400);
assert.equal((await call('/mutation',op({kind:'game',action:'delete',id:fixture.id,expected:'6'}))).status,200);
assert.equal((await call('/trash')).data.games.length,1);
assert.equal((await call('/trash',null,tokens[2])).data.games.length,0);
assert.equal((await call('/mutation',op({kind:'game',action:'restore',id:fixture.id,expected:'7'}))).status,200);
assert.equal((await call('/trash')).data.games.length,0);
assert.equal((await call('/mutation',op({kind:'rules',action:'save',expected:'0',data:fixture.rules}))).status,200);
assert.equal((await call('/mutation',op({kind:'rules',action:'save',expected:'0',data:fixture.rules}))).status,409);
const rotate = op({kind:'access_key',action:'rotate',tokenHash:digest('d'.repeat(64))});
assert.equal((await call('/mutation',rotate)).status,403);
assert.equal((await call('/mutation',rotate,tokens[1])).status,200);
assert.equal((await call('/sync')).status,401);
assert.equal((await call('/sync',null,'d'.repeat(64))).status,200);
assert.equal((await call('/sync',null,tokens[2])).status,200);
assert.equal(sql.prepare('SELECT count(*) n FROM mutation_guard').get().n,0);
console.log('PASS: authorization, isolation, validation, server timestamps, idempotency, concurrent edits, transactional rollback, delta sync, delete/restore, rule conflicts, invitation rotation');
// Real SQLite guards cover direct writes, reader keys, pause/undo, per-group quotas and capacity rollback.
const admin=tokens[1], participant='d'.repeat(64), viewer='e'.repeat(64);
assert.equal((await call('/management',{action:'viewer',tokenHash:digest(viewer)},participant)).status,403);
assert.equal((await call('/management',{action:'viewer',tokenHash:digest(viewer)},admin)).status,200);
assert.equal((await call('/sync',null,viewer)).data.group.role,'viewer');
assert.equal((await call('/mutation',op({kind:'member',action:'add',id:'bad',data:{name:'bad'}}),viewer)).status,403);
assert.equal((await call('/management',{action:'controls',paused:true,newsEnabled:false,expected:0},admin)).status,200);
assert.equal((await call('/mutation',op({kind:'member',action:'add',id:'paused',data:{name:'paused'}}),participant)).status,423);
assert.equal(sql.prepare("SELECT count(*) n FROM members WHERE id='paused'").get().n,0);
assert.equal((await call('/sync',null,viewer)).data.group.newsEnabled,false);
assert.equal((await call('/management',{action:'controls',paused:false,newsEnabled:true,expected:0},admin)).status,409);
assert.equal((await call('/management',{action:'controls',paused:false,newsEnabled:true,expected:1},admin)).status,200);
assert.equal((await call('/management',{action:'undo',revision:9,expected:'9',requestId:crypto.randomUUID()},admin)).status,200);
assert.equal((await call('/management',{action:'undo',revision:9,expected:'9',requestId:crypto.randomUUID()},admin)).status,409);
const before=sql.prepare("SELECT revision FROM groups WHERE id='group-a'").get().revision;
const huge=await call('/mutation',op({kind:'game',action:'add',id:'huge',data:{...fixture,id:'huge',extra:'x'.repeat(9000)}}),participant);
assert.equal(huge.status,413);
assert.equal(sql.prepare("SELECT revision FROM groups WHERE id='group-a'").get().revision,before);
let limited=false;for(let i=0;i<35;i++){const r=await call('/mutation',op({kind:'member',action:'add',id:`limit-${i}`,data:{name:`limit-${i}`}}),participant);if(r.status===429){limited=true;break;}assert.equal(r.status,200);}
assert.ok(limited);
assert.equal((await call('/changes',null,tokens[2])).data.changes.length,0);
assert.equal(sql.prepare('SELECT count(*) n FROM mutation_guard').get().n,0);
console.log('PASS: viewer permissions, administrative pause, CAS controls, undo conflicts, oversized-record rollback, write quotas, audit isolation');
// Restore a real backup shape into an empty isolated fixture, then retry and reject overwrites.
sql.prepare("INSERT INTO access_keys VALUES(?,'group-b','admin',?,NULL)").run(digest('f'.repeat(64)),now);
const restore=op({action:'import',data:{version:1,players:[0,1,2,3].map(i=>({id:`member-${i}`,name:`選手${i}`,color:'#123456'})),games:[fixture],rules:fixture.rules}});
assert.equal((await call('/management',restore,'f'.repeat(64))).status,200);
assert.equal((await call('/management',restore,'f'.repeat(64))).status,200);
assert.equal((await call('/management',{...restore,requestId:crypto.randomUUID()},'f'.repeat(64))).status,409);
assert.equal((await call('/sync',null,tokens[2])).data.changes.filter(c=>c.kind==='game').length,1);
assert.equal((await call('/sync',null,tokens[2])).data.changes.find(c=>c.kind==='game').data.highlight,fixture.highlight);
const rotation={action:'rotate-all',adminHash:digest('1'.repeat(64)),participantHash:digest('2'.repeat(64))};
assert.equal((await call('/management',rotation,admin)).status,200);
assert.equal((await call('/sync',null,admin)).status,401);
assert.equal((await call('/sync',null,participant)).status,401);
assert.equal((await call('/sync',null,viewer)).status,401);
assert.equal((await call('/sync',null,'1'.repeat(64))).data.group.role,'admin');
console.log('PASS: isolated backup restore, idempotent restore, overwrite protection, complete URL revocation');

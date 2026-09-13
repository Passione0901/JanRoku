import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// Updated 2026-09-13: Exercise real SQL transactions with anonymous fixtures, never production records.
await build({ entryPoints: ['cloudflare/api.js'], bundle: true, format: 'esm', platform: 'browser', outfile: 'dist-worker/worker.mjs' });
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
const add = op({ kind:'game', action:'add', id:fixture.id, data:fixture });
assert.equal((await call('/mutation',add)).status,200);
assert.equal((await call('/mutation',add)).status,200);
assert.equal(sql.prepare('SELECT count(*) n FROM games').get().n,1);
const first = (await call('/sync')).data;
assert.equal(first.changes.length,5);
const game = first.changes.find(c=>c.kind==='game');
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

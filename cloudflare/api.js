import { validGame, validRules } from '../src/data/LocalStorageGameRepository.ts';
import { normalize } from '../src/data/PlayerRepository.ts';

const origin = 'https://passione0901.github.io';
const json = (data, status = 200) => Response.json(data, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow', 'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin',
} });
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const parse = value => value == null ? null : JSON.parse(value);
const hash = async token => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), x => x.toString(16).padStart(2, '0')).join('');
const idOK = id => typeof id === 'string' && /^[a-z0-9-]{1,100}$/.test(id);

// Updated 2026-09-13: Queries derive their group from a revocable bearer key, never from client data.
async function authenticate(request, db) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) fail('共有URLを開き直してください。', 401);
  const row = await db.prepare(`SELECT g.id,g.name,g.revision,a.role FROM access_keys a JOIN groups g ON g.id=a.group_id WHERE a.token_hash=? AND a.revoked_at IS NULL AND g.deleted_at IS NULL`).bind(await hash(token)).first();
  if (!row) fail('この共有URLは無効です。新しいURLを受け取ってください。', 401);
  return row;
}

// Updated 2026-09-13: Group revision guards protect cross-entity constraints, retries and simultaneous editors.
async function mutate(db, actor, body) {
  if (!idOK(body.requestId)) fail('操作IDが不正です。');
  const completed = () => db.prepare('SELECT revision FROM change_history WHERE group_id=? AND request_id=?').bind(actor.id, body.requestId).first();
  const prior = await completed();
  if (prior) return prior;
  const kind = body.kind;
  if (!['game', 'member', 'rules', 'access_key'].includes(kind)) fail('操作が不正です。');
  if (kind === 'access_key' && actor.role !== 'admin') fail('管理者URLが必要です。', 403);
  for (let attempt = 0; attempt < 4; attempt++) {
    const group = await db.prepare('SELECT revision FROM groups WHERE id=? AND deleted_at IS NULL').bind(actor.id).first();
    if (!group) fail('麻雀会が見つかりません。', 404);
    const now = new Date().toISOString(), rev = group.revision + 1, statements = [];
    let before = null, after = null, entityId = body.id;
    const action = body.action;
    if (kind === 'access_key') {
      if (action !== 'rotate' || !/^[a-f0-9]{64}$/.test(body.tokenHash)) fail('URLの形式が不正です。');
      entityId = 'participant';
      statements.push(db.prepare("UPDATE access_keys SET revoked_at=? WHERE group_id=? AND role='participant' AND revoked_at IS NULL").bind(now, actor.id));
      statements.push(db.prepare("INSERT INTO access_keys(token_hash,group_id,role,created_at) VALUES(?,?,'participant',?)").bind(body.tokenHash, actor.id, now));
    } else if (kind === 'rules') {
      if (action !== 'save' || !validRules(body.data)) fail('ルールの内容が不正です。');
      const row = await db.prepare('SELECT config_json,revision FROM group_rules WHERE group_id=?').bind(actor.id).first();
      before = parse(row.config_json);
      if (String(row.revision) !== body.expected) fail('別の人がルールを更新しました。設定画面を開き直してください。', 409);
      after = body.data; entityId = actor.id;
      statements.push(db.prepare('UPDATE group_rules SET config_json=?,revision=?,updated_at=? WHERE group_id=?').bind(JSON.stringify(after), rev, now, actor.id));
    } else {
      if (!idOK(entityId)) fail('記録IDが不正です。');
      const table = kind === 'game' ? 'games' : 'members', column = kind === 'game' ? 'game_json' : 'profile_json';
      const row = await db.prepare(`SELECT ${column} AS data,revision,deleted_at,created_at FROM ${table} WHERE group_id=? AND id=?`).bind(actor.id, entityId).first();
      before = row ? parse(row.data) : null;
      if (action === 'add') { if (row) fail('この記録は登録済みです。', 409); }
      else if (!['save', 'delete', 'restore'].includes(action) || !row || String(row.revision) !== body.expected || (action === 'restore' ? !row.deleted_at : !!row.deleted_at)) fail('別の人がこの記録を変更しました。最新の内容を確認してやり直してください。', 409);
      if (kind === 'game') {
        after = action === 'restore' ? before : body.data;
        if (action !== 'delete') {
          if (!after || after.id !== entityId || !validGame(after)) fail('対局の点数・順位・日付を確認してください。');
          const members = await db.prepare('SELECT id FROM members WHERE group_id=? AND deleted_at IS NULL').bind(actor.id).all();
          if (after.players.some(p => !members.results.some(m => m.id === p.playerId))) fail('参加者が変更されています。メンバーを選び直してください。', 409);
          after = { ...after, createdAt: row?.created_at ?? now, updatedAt: now }; delete after.syncRevision;
          statements.push(db.prepare(`INSERT INTO games(group_id,id,event_date,game_json,revision,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,NULL)
            ON CONFLICT(group_id,id) DO UPDATE SET event_date=excluded.event_date,game_json=excluded.game_json,revision=excluded.revision,updated_at=excluded.updated_at,deleted_at=NULL`).bind(actor.id, entityId, after.date, JSON.stringify(after), rev, after.createdAt, now));
        }
      } else {
        if (action === 'restore') fail('この操作には対応していません。');
        if (action === 'delete') {
          const used = await db.prepare(`SELECT 1 FROM games, json_each(games.game_json,'$.players') p WHERE group_id=? AND json_extract(p.value,'$.playerId')=? LIMIT 1`).bind(actor.id, entityId).first();
          if (used) fail('対局記録のあるメンバーは削除できません。');
        } else {
          if (typeof body.data?.name !== 'string') fail('名前を入力してください。');
          let name; try { name = normalize(body.data.name); } catch (e) { fail(e.message); }
          const members = await db.prepare('SELECT profile_json FROM members WHERE group_id=? AND deleted_at IS NULL').bind(actor.id).all();
          if (members.results.some(m => { const p = parse(m.profile_json); return p.id !== entityId && normalize(p.name).toLowerCase() === name.toLowerCase(); })) fail('同じ名前のメンバーがいます。', 409);
          if (members.results.length >= 500 && action === 'add') fail('メンバーは500人までです。');
          after = { id: entityId, name, color: before?.color ?? '#7f9a8a' };
          statements.push(db.prepare(`INSERT INTO members(group_id,id,profile_json,revision,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(group_id,id) DO UPDATE SET profile_json=excluded.profile_json,revision=excluded.revision,updated_at=excluded.updated_at`).bind(actor.id, entityId, JSON.stringify(after), rev, row?.created_at ?? now, now));
        }
      }
      if (action === 'delete') {
        after = null;
        statements.push(db.prepare(`UPDATE ${table} SET deleted_at=?,updated_at=?,revision=? WHERE group_id=? AND id=?`).bind(now, now, rev, actor.id, entityId));
      }
    }
    try {
      await db.batch([
        db.prepare('UPDATE groups SET revision=?,updated_at=? WHERE id=? AND revision=?').bind(rev, now, actor.id, group.revision),
        db.prepare('INSERT INTO mutation_guard(ok) VALUES (CASE WHEN changes()=1 THEN 1 ELSE 0 END)'),
        ...statements,
        db.prepare('INSERT INTO change_history(group_id,revision,request_id,entity_type,entity_id,action,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(actor.id, rev, body.requestId, kind, entityId, action, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, now),
        db.prepare('DELETE FROM mutation_guard'),
      ]);
      return { revision: rev };
    } catch (error) {
      const done = await completed(); if (done) return done;
      if (!String(error).includes('CHECK constraint failed')) throw error;
    }
  }
  fail('入力が重なっています。少し待ってから保存してください。', 409);
}

// Updated 2026-09-13: Bounded delta reads keep polling cheap. No records or keys go to logs.
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (request.headers.has('Origin') && request.headers.get('Origin') !== origin) return json({ error: '接続元が許可されていません。' }, 403);
      if (request.method === 'OPTIONS') return json({ ok: true });
      if (url.pathname === '/health' && request.method === 'GET') return json({ status: 'ok', stage: 'shared', schemaVersion: 2 });
      const actor = await authenticate(request, env.DB);
      if (url.pathname === '/sync' && request.method === 'GET') {
        const since = Number(url.searchParams.get('since') ?? 0);
        if (!Number.isSafeInteger(since) || since < 0) fail('同期位置が不正です。');
        const data = await env.DB.batch([
          env.DB.prepare('SELECT revision,name FROM groups WHERE id=?').bind(actor.id),
          env.DB.prepare('SELECT config_json,revision FROM group_rules WHERE group_id=?').bind(actor.id),
          env.DB.prepare('SELECT revision,entity_type,entity_id,action,after_json FROM change_history WHERE group_id=? AND revision>? ORDER BY revision LIMIT 200').bind(actor.id, since),
        ]);
        const group = data[0].results[0], rules = data[1].results[0], changes = data[2].results;
        return json({ group: { id: actor.id, name: group.name, role: actor.role }, revision: group.revision,
          rules: parse(rules.config_json), rulesRevision: String(rules.revision), cursor: changes.at(-1)?.revision ?? since,
          changes: changes.map(c => ({ revision: String(c.revision), kind: c.entity_type, id: c.entity_id, action: c.action, data: parse(c.after_json) })) });
      }
      if (url.pathname === '/trash' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT game_json,revision,deleted_at FROM games WHERE group_id=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 100').bind(actor.id).all();
        return json({ games: rows.results.map(r => ({ ...parse(r.game_json), syncRevision: String(r.revision), deletedAt: r.deleted_at })) });
      }
      if (url.pathname === '/mutation' && request.method === 'POST') {
        const reader = request.body?.getReader(); if (!reader) fail('入力がありません。');
        let size = 0; const chunks = [];
        while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 32768) { await reader.cancel(); fail('入力が大きすぎます。', 413); } chunks.push(part.value); }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        let body; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('入力が不正です。'); }
        if (!body || typeof body !== 'object') fail('入力が不正です。');
        return json(await mutate(env.DB, actor, body));
      }
      return json({ error: 'この操作には対応していません。' }, 404);
    } catch (error) {
      return json({ error: error.status ? error.message : '保存サーバーに接続できませんでした。時間をおいて再度お試しください。' }, error.status ?? 503);
    }
  },
};

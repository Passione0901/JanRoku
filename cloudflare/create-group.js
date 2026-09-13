import { normalize } from '../src/data/PlayerRepository.ts';
import { validRules } from '../src/data/LocalStorageGameRepository.ts';
import creationSchema from './migrations/0003_group_creation.sql';

const reply = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join('');
const normalizeInput = value => { try { return normalize(value); } catch (error) { fail(error.message); } };

// Updated 2026-09-13: Bound streamed input even when Content-Length is omitted or misleading.
async function readBody(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail('JSONで送信してください。', 415);
  const reader = request.body?.getReader();
  if (!reader) fail('入力内容がありません。');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 32768) { await reader.cancel(); fail('入力内容が大きすぎます。', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { fail('入力内容を読み取れませんでした。'); }
}

// Updated 2026-09-13: One transaction creates an isolated group, keys and sync history; retries never duplicate it.
export async function createGroup(request, env) {
  if (request.method !== 'POST') return reply({ error: 'POSTのみ利用できます。' }, 405);
  try {
    const body = await readBody(request);
    if (!body || typeof body !== 'object' || !/^[a-f0-9-]{36}$/.test(body.requestId ?? '')) fail('作成IDが不正です。');
    if (typeof body.name !== 'string') fail('グループ名を入力してください。');
    const name = normalizeInput(body.name);
    if (!Array.isArray(body.members) || body.members.length > 40 || body.members.some(n => typeof n !== 'string')) fail('作成時のメンバーは40人までです。');
    const members = body.members.map(normalizeInput);
    if (new Set(members.map(n => n.toLowerCase())).size !== members.length) fail('同じ名前のメンバーがいます。');
    for (const key of [body.participantHash, body.adminHash]) if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) fail('共有キーが不正です。');
    if (body.participantHash === body.adminHash) fail('共有キーが重複しています。');
    const r = body.rules;
    if (!validRules(r) || r.id.length > 100 || r.scoreUnit !== 100 || r.resultDivisor !== 1000 ||
      [r.startingPoints,r.returnPoints].some(n => n > 10000000 || n % 100 !== 0) ||
      r.uma.some(n => Math.abs(n) > 10000 || Math.abs(n * 10 - Math.round(n * 10)) > 0.000001) ||
      Math.round(r.uma.reduce((a,b) => a+b,0) * 10) !== 0) fail('ルールの内容が不正です。');
    // Keep only supported fields in persisted rule snapshots.
    const rules = { id:r.id,playerCount:4,startingPoints:r.startingPoints,returnPoints:r.returnPoints,scoreUnit:100,resultDivisor:1000,
      uma:r.uma,oka:r.oka,tieBreak:r.tieBreak,bustIncludesZero:r.bustIncludesZero,
      ...(r.settlementRounding ? {settlementRounding:r.settlementRounding} : {}),
      ...(r.countNegativePoints !== undefined ? {countNegativePoints:r.countNegativePoints} : {}) };
    const fingerprint = await hash(JSON.stringify({name,members,rules,participantHash:body.participantHash,adminHash:body.adminHash}));
    const db = env.DB;
    // The fixed, additive schema is also bootstrapped by the app binding on its first creation request.
    // This keeps direct Pages uploads deployable without an out-of-band database migration step.
    await db.batch(creationSchema.split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
    const receipt = () => db.prepare('SELECT payload_hash FROM group_creations WHERE request_id=?').bind(body.requestId).first();
    const recover = row => {
      if (row.payload_hash !== fingerprint) fail('この作成IDは別の内容で使用されています。', 409);
      return reply({ id:body.requestId,name }, 200);
    };
    const prior = await receipt(); if (prior) return recover(prior);
    const now = new Date().toISOString(), day = now.slice(0,10);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucket = `${day}:${await hash(`${day}:${ip}`)}`, globalBucket = `${day}:all`;
    const expires = new Date(Date.now() + 2 * 86400000).toISOString();
    const statements = [
      db.prepare('INSERT INTO groups(id,name,revision,created_at,updated_at) VALUES(?,?,?,?,?)').bind(body.requestId,name,members.length,now,now),
      db.prepare('INSERT INTO group_creations VALUES(?,?,?)').bind(body.requestId,fingerprint,now),
      ...[[bucket,10],[globalBucket,100]].map(([key,limit]) => db.prepare('INSERT INTO group_creation_limits(bucket,count,maximum,expires_at) VALUES(?,1,?,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1').bind(key,limit,expires)),
      db.prepare('INSERT INTO group_rules VALUES(?,?,0,?)').bind(body.requestId,JSON.stringify(rules),now),
      ...[[body.participantHash,'participant'],[body.adminHash,'admin']].map(([key,role]) => db.prepare('INSERT INTO access_keys(token_hash,group_id,role,created_at) VALUES(?,?,?,?)').bind(key,body.requestId,role,now)),
    ];
    members.forEach((member,i) => {
      const id = `member-${crypto.randomUUID()}`, profile = JSON.stringify({id,name:member,color:'#7f9a8a'});
      statements.push(db.prepare('INSERT INTO members(group_id,id,profile_json,revision,created_at,updated_at) VALUES(?,?,?,?,?,?)').bind(body.requestId,id,profile,i+1,now,now));
      statements.push(db.prepare("INSERT INTO change_history(group_id,revision,request_id,entity_type,entity_id,action,after_json,created_at) VALUES(?,?,?,'member',?,'add',?,?)").bind(body.requestId,i+1,`${body.requestId}-${i}`,id,profile,now));
    });
    statements.push(db.prepare('DELETE FROM group_creation_limits WHERE expires_at < ?').bind(now));
    try { await db.batch(statements); } catch (error) {
      const saved = await receipt(); if (saved) return recover(saved);
      const limited = await db.prepare('SELECT bucket FROM group_creation_limits WHERE bucket IN (?,?) AND count >= maximum').bind(bucket,globalBucket).first();
      if (limited) fail('本日のグループ作成回数の上限に達しました。時間を置いてお試しください。', 429);
      throw error;
    }
    return reply({id:body.requestId,name},201);
  } catch (error) {
    return reply({error:error.status ? error.message : '作成結果を確認できませんでした。同じ内容で再試行してください。'},error.status || 503);
  }
}

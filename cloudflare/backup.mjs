import {writeFileSync,mkdirSync} from 'node:fs';
import {randomBytes,createCipheriv} from 'node:crypto';
// Updated 2026-09-14: Independent encrypted exports use a dedicated read-only API credential, never an invitation key.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,db=process.env.CLOUDFLARE_DATABASE_ID,token=process.env.CLOUDFLARE_BACKUP_TOKEN;
const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY||'','base64');
if(!account||!db||!token||key.length!==32)throw new Error('Configure account, database, read-only backup token and 32-byte base64 encryption key.');
async function query(sql){const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${db}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql}),signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok||!d.success)throw new Error('Backup query failed (HTTP '+r.status+').');return d.result[0].results;}
const start=await query('SELECT id,revision FROM groups ORDER BY id');
const schema=await query("SELECT name,sql FROM sqlite_master WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND sql IS NOT NULL ORDER BY type,name");
const tables=[];
for(const t of schema.filter(t=>t.sql.startsWith('CREATE TABLE'))){if(!/^[a-z_]+$/.test(t.name))throw new Error('Unexpected table name');const rows=[];for(let offset=0;;offset+=100){const part=await query(`SELECT * FROM "${t.name}" ORDER BY rowid LIMIT 100 OFFSET ${offset}`);rows.push(...part);if(part.length<100)break;}tables.push({name:t.name,rows});}
if(JSON.stringify(start)!==JSON.stringify(await query('SELECT id,revision FROM groups ORDER BY id')))throw new Error('Records changed during export. Retry in a quiet period.');
const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
const encrypted=Buffer.concat([cipher.update(JSON.stringify({version:1,createdAt:new Date().toISOString(),schema,tables})),cipher.final()]);
mkdirSync('backup-output',{recursive:true});writeFileSync('backup-output/janroku-backup.enc.json',JSON.stringify({format:'aes-256-gcm',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}));
console.log('Encrypted backup complete. Tables: '+tables.length);

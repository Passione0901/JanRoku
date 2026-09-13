import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createDecipheriv} from 'node:crypto';
// Updated 2026-09-14: Restore and verify an encrypted backup only in an isolated in-memory database.
const envelope=JSON.parse(readFileSync(process.argv[2],'utf8')),key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY||'','base64');
if(key.length!==32||envelope.format!=='aes-256-gcm')throw new Error('Invalid key or backup format');
const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));cipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
const data=JSON.parse(Buffer.concat([cipher.update(Buffer.from(envelope.data,'base64')),cipher.final()]).toString('utf8'));
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=OFF');
for(const s of data.schema.filter(s=>s.sql.startsWith('CREATE TABLE')))db.exec(s.sql);
for(const t of data.tables){if(!/^[a-z_]+$/.test(t.name))throw new Error('Invalid table');for(const row of t.rows){const cols=Object.keys(row);if(cols.some(c=>!/^[a-z_]+$/.test(c)))throw new Error('Invalid column');db.prepare(`INSERT INTO "${t.name}" (${cols.map(c=>'"'+c+'"').join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...Object.values(row));}}
for(const s of data.schema.filter(s=>!s.sql.startsWith('CREATE TABLE')))db.exec(s.sql);
if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Backup integrity failed');
if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(data));
console.log('PASS: decrypted backup restored to isolated SQLite and verified.');

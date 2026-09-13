-- Updated 2026-09-14: Database guards also protect requests made to older API deployments.
CREATE TABLE IF NOT EXISTS group_controls(group_id TEXT PRIMARY KEY REFERENCES groups(id), paused INTEGER NOT NULL DEFAULT 0, news_enabled INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0);
-- statement-break
CREATE TABLE IF NOT EXISTS viewer_keys(group_id TEXT PRIMARY KEY REFERENCES groups(id), token_hash TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL);
-- statement-break
CREATE TABLE IF NOT EXISTS elevated_transactions(group_id TEXT PRIMARY KEY);
-- statement-break
CREATE TABLE IF NOT EXISTS write_windows(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL CHECK(count<=maximum),maximum INTEGER NOT NULL,expires_at TEXT NOT NULL);
-- statement-break
CREATE INDEX IF NOT EXISTS write_windows_expiry ON write_windows(expires_at);
-- statement-break
CREATE TABLE IF NOT EXISTS group_usage(group_id TEXT PRIMARY KEY,bytes INTEGER NOT NULL DEFAULT 0 CHECK(bytes<=20971520));
-- statement-break
INSERT OR IGNORE INTO group_usage(group_id,bytes) SELECT g.id,
coalesce((SELECT sum(length(CAST(game_json AS BLOB))) FROM games WHERE group_id=g.id),0)+
coalesce((SELECT sum(length(CAST(profile_json AS BLOB))) FROM members WHERE group_id=g.id),0)+
coalesce((SELECT sum(length(CAST(coalesce(before_json,'') AS BLOB))+length(CAST(coalesce(after_json,'') AS BLOB))) FROM change_history WHERE group_id=g.id),0) FROM groups g;
-- statement-break
CREATE TABLE IF NOT EXISTS service_usage(id INTEGER PRIMARY KEY CHECK(id=1),bytes INTEGER NOT NULL CHECK(bytes<=314572800));
-- statement-break
INSERT OR IGNORE INTO service_usage SELECT 1,coalesce(sum(bytes),0) FROM group_usage;
-- statement-break
CREATE TRIGGER IF NOT EXISTS group_usage_insert AFTER INSERT ON group_usage BEGIN UPDATE service_usage SET bytes=bytes+NEW.bytes WHERE id=1; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS group_usage_update AFTER UPDATE ON group_usage BEGIN UPDATE service_usage SET bytes=bytes+NEW.bytes-OLD.bytes WHERE id=1; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS group_usage_delete AFTER DELETE ON group_usage BEGIN UPDATE service_usage SET bytes=bytes-OLD.bytes WHERE id=1; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS game_capacity BEFORE INSERT ON games BEGIN
 SELECT CASE WHEN (SELECT count(*) FROM games WHERE group_id=NEW.group_id)>=5000 AND NOT EXISTS(SELECT 1 FROM games WHERE group_id=NEW.group_id AND id=NEW.id) THEN RAISE(ABORT,'GROUP_GAME_LIMIT') END;
 SELECT CASE WHEN length(CAST(NEW.game_json AS BLOB))>8192 THEN RAISE(ABORT,'RECORD_SIZE_LIMIT') END;
END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS game_size_update BEFORE UPDATE ON games BEGIN SELECT CASE WHEN length(CAST(NEW.game_json AS BLOB))>8192 THEN RAISE(ABORT,'RECORD_SIZE_LIMIT') END; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS game_usage_insert AFTER INSERT ON games BEGIN INSERT INTO group_usage VALUES(NEW.group_id,length(CAST(NEW.game_json AS BLOB))) ON CONFLICT(group_id) DO UPDATE SET bytes=bytes+excluded.bytes; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS game_usage_update AFTER UPDATE ON games BEGIN UPDATE group_usage SET bytes=bytes+length(CAST(NEW.game_json AS BLOB))-length(CAST(OLD.game_json AS BLOB)) WHERE group_id=NEW.group_id; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS game_usage_delete AFTER DELETE ON games BEGIN UPDATE group_usage SET bytes=bytes-length(CAST(OLD.game_json AS BLOB)) WHERE group_id=OLD.group_id; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS member_usage_insert AFTER INSERT ON members BEGIN INSERT INTO group_usage VALUES(NEW.group_id,length(CAST(NEW.profile_json AS BLOB))) ON CONFLICT(group_id) DO UPDATE SET bytes=bytes+excluded.bytes; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS member_usage_update AFTER UPDATE ON members BEGIN UPDATE group_usage SET bytes=bytes+length(CAST(NEW.profile_json AS BLOB))-length(CAST(OLD.profile_json AS BLOB)) WHERE group_id=NEW.group_id; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS member_usage_delete AFTER DELETE ON members BEGIN UPDATE group_usage SET bytes=bytes-length(CAST(OLD.profile_json AS BLOB)) WHERE group_id=OLD.group_id; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS history_usage_insert AFTER INSERT ON change_history BEGIN INSERT INTO group_usage VALUES(NEW.group_id,length(CAST(coalesce(NEW.before_json,'') AS BLOB))+length(CAST(coalesce(NEW.after_json,'') AS BLOB))) ON CONFLICT(group_id) DO UPDATE SET bytes=bytes+excluded.bytes; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS history_usage_delete AFTER DELETE ON change_history BEGIN UPDATE group_usage SET bytes=bytes-length(CAST(coalesce(OLD.before_json,'') AS BLOB))-length(CAST(coalesce(OLD.after_json,'') AS BLOB)) WHERE group_id=OLD.group_id; END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS history_guards BEFORE INSERT ON change_history WHEN NOT EXISTS(SELECT 1 FROM elevated_transactions WHERE group_id=NEW.group_id) BEGIN
 SELECT CASE WHEN coalesce((SELECT paused FROM group_controls WHERE group_id=NEW.group_id),0)=1 THEN RAISE(ABORT,'GROUP_PAUSED') END;
 INSERT INTO write_windows VALUES('minute:'||NEW.group_id||':'||strftime('%Y%m%d%H%M','now'),1,30,datetime('now','+2 days')) ON CONFLICT(bucket) DO UPDATE SET count=count+1;
 INSERT INTO write_windows VALUES('day:'||NEW.group_id||':'||date('now'),1,300,datetime('now','+2 days')) ON CONFLICT(bucket) DO UPDATE SET count=count+1;
 INSERT INTO write_windows VALUES('global:'||date('now'),1,2000,datetime('now','+2 days')) ON CONFLICT(bucket) DO UPDATE SET count=count+1;
END;
-- statement-break
CREATE TRIGGER IF NOT EXISTS history_capacity BEFORE INSERT ON change_history BEGIN SELECT CASE WHEN (SELECT count(*) FROM change_history WHERE group_id=NEW.group_id)>=20000 THEN RAISE(ABORT,'GROUP_HISTORY_LIMIT') END; END;
-- statement-break
INSERT OR IGNORE INTO schema_versions VALUES(4,strftime('%Y-%m-%dT%H:%M:%fZ','now'));

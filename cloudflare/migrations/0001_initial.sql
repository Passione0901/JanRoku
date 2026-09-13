-- 2026-09-13: Keep every record scoped to a group; preserve historical rule snapshots in game JSON.
CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS group_rules (
  group_id TEXT PRIMARY KEY REFERENCES groups(id),
  config_json TEXT NOT NULL CHECK(json_valid(config_json)),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  group_id TEXT NOT NULL REFERENCES groups(id),
  id TEXT NOT NULL,
  profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (group_id, id)
);
CREATE TABLE IF NOT EXISTS games (
  group_id TEXT NOT NULL REFERENCES groups(id),
  id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  game_json TEXT NOT NULL CHECK(json_valid(game_json)),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (group_id, id)
);
CREATE INDEX IF NOT EXISTS games_group_date ON games(group_id, event_date, created_at);
-- Only hashes of random shared keys belong here. No plaintext link secrets in the database or repository.
CREATE TABLE IF NOT EXISTS access_keys (
  token_hash TEXT PRIMARY KEY CHECK(length(token_hash) = 64),
  group_id TEXT NOT NULL REFERENCES groups(id),
  role TEXT NOT NULL CHECK(role IN ('participant', 'admin')),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS access_keys_group ON access_keys(group_id);
CREATE TABLE IF NOT EXISTS change_history (
  group_id TEXT NOT NULL REFERENCES groups(id),
  revision INTEGER NOT NULL,
  request_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('group', 'rules', 'member', 'game', 'access_key')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT CHECK(before_json IS NULL OR json_valid(before_json)),
  after_json TEXT CHECK(after_json IS NULL OR json_valid(after_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY (group_id, revision),
  UNIQUE (group_id, request_id)
);
INSERT OR IGNORE INTO schema_versions(version, applied_at) VALUES(1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

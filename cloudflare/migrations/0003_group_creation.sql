-- Updated 2026-09-13: Retry receipts and bounded anonymous group creation, separate from match data.
CREATE TABLE IF NOT EXISTS group_creations (
  request_id TEXT PRIMARY KEY REFERENCES groups(id),
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS group_creation_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK(count > 0 AND count <= maximum),
  maximum INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS group_creation_limits_expiry ON group_creation_limits(expires_at);
INSERT OR IGNORE INTO schema_versions(version, applied_at) VALUES(3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

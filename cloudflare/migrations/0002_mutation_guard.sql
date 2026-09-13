-- Updated 2026-09-13: A failed revision comparison aborts the complete D1 batch.
CREATE TABLE mutation_guard(ok INTEGER NOT NULL CHECK(ok = 1));
INSERT INTO schema_versions(version,applied_at) VALUES(2,strftime('%Y-%m-%dT%H:%M:%fZ','now'));

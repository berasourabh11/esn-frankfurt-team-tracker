-- Adds the "admin" role: everything a moderator and a member can do.
-- Same table rebuild as 0002 (SQLite can't change a CHECK constraint); the
-- same note about applying it before the remote database has members applies.

CREATE TABLE users_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'member', 'user')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active')),
  team          TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

INSERT INTO users_new (id, name, email, role, status, team, password_hash, created_at, updated_at)
SELECT id, name, email, role, status, team, password_hash, created_at, updated_at FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX users_status_idx ON users (status);

-- Roles become moderator / member / user, and accounts get a status:
-- people who register themselves are "pending" until a moderator accepts them.
--   board -> moderator, organiser -> member, volunteer -> user
--
-- SQLite can't change a CHECK constraint, so the users table is rebuilt.
-- The local runner applies this with foreign keys switched off (no cascades).
-- On Cloudflare D1 foreign keys stay on, so dropping `users` would cascade:
-- this migration must be applied before the remote database has members
-- (it is, when following backend/README.md: migrate first, then add people).

CREATE TABLE users_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role          TEXT NOT NULL CHECK (role IN ('moderator', 'member', 'user')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active')),
  team          TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

INSERT INTO users_new (id, name, email, role, status, team, password_hash, created_at, updated_at)
SELECT id, name, email,
       CASE role WHEN 'board' THEN 'moderator' WHEN 'organiser' THEN 'member' ELSE 'user' END,
       'active', team, password_hash, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX users_status_idx ON users (status);

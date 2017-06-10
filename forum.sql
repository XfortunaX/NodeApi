\c docker;
CREATE EXTENSION citext;
DROP Table IF EXISTS users CASCADE;

DROP INDEX IF EXISTS unique_email;
DROP INDEX IF EXISTS unique_nickname;
DROP INDEX IF EXISTS unique_nickname_low;
DROP INDEX IF EXISTS idx_forums_user;
DROP INDEX IF EXISTS unique_slug_forums;
DROP INDEX IF EXISTS idx_thread_user;
DROP INDEX IF EXISTS idx_thread_forum;
DROP INDEX IF EXISTS unique_slug_thread;
DROP INDEX IF EXISTS idx_post_author;
DROP INDEX IF EXISTS idx_post_forum;
DROP INDEX IF EXISTS idx_post_thread;
DROP INDEX IF EXISTS idx_post_parent;
DROP INDEX IF EXISTS idx_thread_created;
DROP INDEX IF EXISTS idx_post_created;
DROP INDEX IF EXISTS idx_post_t_c_i;
DROP INDEX IF EXISTS idx_post_p_t_i;
DROP INDEX IF EXISTS idx_post_t_p;
DROP INDEX IF EXISTS idx_post_p1_t_p_i;
DROP INDEX IF EXISTS idx_thread_f_c;
DROP INDEX IF EXISTS idx_nick_nicklow;
DROP INDEX IF EXISTS idx_post_p1;
DROP INDEX IF EXISTS idx_uf_user;
DROP INDEX IF EXISTS idx_uf_forum;

CREATE TABLE IF NOT EXISTS users (
  nickname VARCHAR PRIMARY KEY,
  fullname VARCHAR,
  about TEXT,
  email CITEXT NOT NULL UNIQUE
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS unique_nickname ON users(upper(nickname));
CREATE UNIQUE INDEX IF NOT EXISTS unique_nickname_low ON users(lower(nickname collate "ucs_basic"));

DROP Table IF EXISTS forums CASCADE;

CREATE TABLE IF NOT EXISTS forums (
  id SERIAL NOT NULL PRIMARY KEY,
  title VARCHAR NOT NULL,
  username VARCHAR NOT NULL REFERENCES users (nickname),
  slug CITEXT NOT NULL UNIQUE,
  posts INTEGER DEFAULT 0,
  threads INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_forums_user ON forums(username);
CREATE UNIQUE INDEX IF NOT EXISTS unique_slug_forums ON forums(slug);

DROP Table IF EXISTS threads CASCADE;

CREATE TABLE IF NOT EXISTS threads (
  id SERIAL NOT NULL PRIMARY KEY,
  author VARCHAR NOT NULL REFERENCES users (nickname),
  created TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp,
  forum INTEGER NOT NULL REFERENCES forums (id),
  message TEXT NOT NULL,
  slug CITEXT UNIQUE,
  title VARCHAR NOT NULL,
  votes INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_thread_user ON threads(author);
CREATE INDEX IF NOT EXISTS idx_thread_forum ON threads(forum);
CREATE INDEX IF NOT EXISTS idx_thread_created ON threads(created);
CREATE INDEX IF NOT EXISTS idx_thread_f_c ON threads(forum, created);
CREATE UNIQUE INDEX IF NOT EXISTS unique_slug_thread ON threads(slug);

DROP Table IF EXISTS posts CASCADE;

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL NOT NULL PRIMARY KEY,
  author VARCHAR NOT NULL REFERENCES users (nickname),
  created TIMESTAMP WITH TIME ZONE DEFAULT current_timestamp,
  forum VARCHAR,
  isEdited BOOLEAN DEFAULT FALSE,
  message TEXT NOT NULL,
  parent INTEGER DEFAULT 0,
  thread INTEGER NOT NULL REFERENCES threads (id),
  path INT ARRAY
);

CREATE INDEX IF NOT EXISTS idx_post_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_post_forum ON posts(forum);
CREATE INDEX IF NOT EXISTS idx_post_thread ON posts(thread);
CREATE INDEX IF NOT EXISTS idx_post_parent ON posts(parent);
CREATE INDEX IF NOT EXISTS idx_post_created ON posts(created);
CREATE INDEX IF NOT EXISTS idx_post_p1 ON posts((path[1]));
CREATE INDEX IF NOT EXISTS idx_post_t_c_i ON posts(thread, created, id);
CREATE INDEX IF NOT EXISTS idx_post_p_t_i ON posts(parent, thread, id);
CREATE INDEX IF NOT EXISTS idx_post_t_p ON posts(thread, path);
CREATE INDEX IF NOT EXISTS idx_post_p1_t_p_i ON posts(thread, path, id);

DROP Table IF EXISTS votes CASCADE;

CREATE TABLE IF NOT EXISTS votes (
  id SERIAL NOT NULL PRIMARY KEY,
  username VARCHAR NOT NULL REFERENCES users (nickname),
  voice INTEGER,
  thread INTEGER NOT NULL REFERENCES threads (id),
  UNIQUE (username, thread)
);

DROP TABLE IF EXISTS users_forums CASCADE;

CREATE TABLE IF NOT EXISTS users_forums (
  user_nickname VARCHAR REFERENCES users (nickname) NOT NULL,
  forum_id INTEGER REFERENCES forums(id) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uf_user ON users_forums (user_nickname);
CREATE INDEX IF NOT EXISTS idx_uf_forum ON users_forums (forum_id);

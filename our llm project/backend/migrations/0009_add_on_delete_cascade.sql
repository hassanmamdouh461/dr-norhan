-- Disable foreign key constraints temporarily
PRAGMA foreign_keys = OFF;

-- 1) Re-create units table with ON DELETE CASCADE
ALTER TABLE units RENAME TO units_old;
CREATE TABLE units (
  id           TEXT PRIMARY KEY,
  course_id    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  is_archived  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO units SELECT * FROM units_old;
DROP TABLE units_old;
CREATE INDEX IF NOT EXISTS idx_units_lookup ON units(course_id, is_archived, is_published, sort_order);


-- 2) Re-create lessons table with ON DELETE CASCADE
ALTER TABLE lessons RENAME TO lessons_old;
CREATE TABLE lessons (
  id                TEXT PRIMARY KEY,
  unit_id           TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  course_id         TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_free_preview   INTEGER NOT NULL DEFAULT 0,
  is_published      INTEGER NOT NULL DEFAULT 0,
  is_archived       INTEGER NOT NULL DEFAULT 0,
  publish_at        TEXT,
  duration_seconds  INTEGER,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO lessons SELECT * FROM lessons_old;
DROP TABLE lessons_old;
CREATE INDEX IF NOT EXISTS idx_lessons_lookup ON lessons(unit_id, is_archived, is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);


-- 3) Re-create lesson_videos table with ON DELETE CASCADE
ALTER TABLE lesson_videos RENAME TO lesson_videos_old;
CREATE TABLE lesson_videos (
  id               TEXT PRIMARY KEY,
  lesson_id        TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK(provider IN ('stream', 'youtube', 'r2', 'server', 'r2_hls')),
  stream_uid       TEXT,
  youtube_id       TEXT,
  thumbnail_url    TEXT,
  duration_seconds INTEGER,
  status           TEXT NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','processing','ready','error')),
  require_drm      INTEGER NOT NULL DEFAULT 1,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO lesson_videos SELECT * FROM lesson_videos_old;
DROP TABLE lesson_videos_old;
CREATE INDEX IF NOT EXISTS idx_lesson_videos_lesson ON lesson_videos(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_videos_stream ON lesson_videos(stream_uid);


-- 4) Re-create lesson_files table with ON DELETE CASCADE
ALTER TABLE lesson_files RENAME TO lesson_files_old;
CREATE TABLE lesson_files (
  id              TEXT PRIMARY KEY,
  lesson_id       TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  r2_key          TEXT NOT NULL,
  mime_type       TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  is_downloadable INTEGER NOT NULL DEFAULT 0,
  watermark       INTEGER NOT NULL DEFAULT 1,
  encrypt_offline INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO lesson_files SELECT * FROM lesson_files_old;
DROP TABLE lesson_files_old;
CREATE INDEX IF NOT EXISTS idx_lesson_files_lesson ON lesson_files(lesson_id);


-- 5) Re-create enrollments table with ON DELETE CASCADE
ALTER TABLE enrollments RENAME TO enrollments_old;
CREATE TABLE enrollments (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id   TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT 'code' CHECK(source IN ('code','manual','free')),
  code_id     TEXT REFERENCES activation_codes(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
  granted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  platform    TEXT NOT NULL DEFAULT 'alhadaba-chemistry',
  UNIQUE(student_id, course_id)
);
INSERT INTO enrollments SELECT id, student_id, course_id, source, code_id, status, granted_at, expires_at, created_at, platform FROM enrollments_old;
DROP TABLE enrollments_old;
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);


-- 6) Re-create devices table with ON DELETE CASCADE
ALTER TABLE devices RENAME TO devices_old;
CREATE TABLE devices (
  id            TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id     TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK(platform IN ('android','ios','web')),
  model         TEXT,
  push_token    TEXT,
  is_trusted    INTEGER NOT NULL DEFAULT 1,
  is_rooted     INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(student_id, device_id)
);
INSERT INTO devices SELECT * FROM devices_old;
DROP TABLE devices_old;
CREATE INDEX IF NOT EXISTS idx_devices_student ON devices(student_id);
CREATE INDEX IF NOT EXISTS idx_devices_push ON devices(push_token);


-- 7) Re-create questions table with ON DELETE CASCADE
ALTER TABLE questions RENAME TO questions_old;
CREATE TABLE questions (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id    TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  course_id    TEXT REFERENCES courses(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  image_r2_key TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed','hidden')),
  is_pinned    INTEGER NOT NULL DEFAULT 0,
  upvotes      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO questions SELECT * FROM questions_old;
DROP TABLE questions_old;
CREATE INDEX IF NOT EXISTS idx_questions_lesson ON questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_questions_student ON questions(student_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);


-- 8) Re-create answers table with ON DELETE CASCADE
ALTER TABLE answers RENAME TO answers_old;
CREATE TABLE answers (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  is_accepted INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
INSERT INTO answers SELECT * FROM answers_old;
DROP TABLE answers_old;
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);


-- 9) Re-create reviews table with ON DELETE CASCADE
ALTER TABLE reviews RENAME TO reviews_old;
CREATE TABLE reviews (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN ('lesson','course')),
  target_id   TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment     TEXT,
  status      TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(student_id, target_type, target_id)
);
INSERT INTO reviews SELECT * FROM reviews_old;
DROP TABLE reviews_old;
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);


-- 10) Re-create notifications table with ON DELETE CASCADE
ALTER TABLE notifications RENAME TO notifications_old;
CREATE TABLE notifications (
  id           TEXT PRIMARY KEY,
  recipient_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  audience     TEXT NOT NULL DEFAULT 'user' CHECK(audience IN ('user','course','all')),
  course_id    TEXT,
  type         TEXT NOT NULL CHECK(type IN ('new_lesson','answer','announcement','system')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  data_json    TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  sent_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  platform     TEXT NOT NULL DEFAULT 'alhadaba-chemistry'
);
INSERT INTO notifications SELECT id, recipient_id, audience, course_id, type, title, body, data_json, is_read, sent_at, created_at, platform FROM notifications_old;
DROP TABLE notifications_old;
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_audience ON notifications(audience);


-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

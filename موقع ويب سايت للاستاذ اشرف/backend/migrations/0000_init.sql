-- ============================================================
-- فُصْحَى Platform — D1 (SQLite) Database Schema
-- Migration: 0000_init.sql
-- ============================================================

-- 1) profiles — User profiles (source of truth for roles)
CREATE TABLE IF NOT EXISTS profiles (
  id                  TEXT PRIMARY KEY,
  supabase_user_id    TEXT UNIQUE NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  role                TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('admin','assistant','student')),
  full_name           TEXT NOT NULL DEFAULT '',
  phone               TEXT DEFAULT '',
  parent_phone        TEXT,
  grade               TEXT,
  governorate         TEXT,
  avatar_url          TEXT,
  status              TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked')),
  max_devices         INTEGER NOT NULL DEFAULT 2,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  last_seen_at        TEXT,
  last_self_reset_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_profiles_supabase ON profiles(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- 2) courses
CREATE TABLE IF NOT EXISTS courses (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  description     TEXT,
  cover_url       TEXT,
  grade           TEXT,
  subject         TEXT NOT NULL DEFAULT 'اللغة العربية',
  reference_price INTEGER,
  is_published    INTEGER NOT NULL DEFAULT 0,
  is_free         INTEGER NOT NULL DEFAULT 0,
  is_archived     INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT REFERENCES profiles(id),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_lookup ON courses(is_archived, is_published, sort_order);

-- 3) units
CREATE TABLE IF NOT EXISTS units (
  id           TEXT PRIMARY KEY,
  course_id    TEXT NOT NULL REFERENCES courses(id),
  title        TEXT NOT NULL,
  description  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  is_archived  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_units_lookup ON units(course_id, is_archived, is_published, sort_order);

-- 4) lessons
CREATE TABLE IF NOT EXISTS lessons (
  id                TEXT PRIMARY KEY,
  unit_id           TEXT NOT NULL REFERENCES units(id),
  course_id         TEXT NOT NULL REFERENCES courses(id),
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
CREATE INDEX IF NOT EXISTS idx_lessons_lookup ON lessons(unit_id, is_archived, is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);

-- 5) lesson_videos
CREATE TABLE IF NOT EXISTS lesson_videos (
  id               TEXT PRIMARY KEY,
  lesson_id        TEXT NOT NULL REFERENCES lessons(id),
  provider         TEXT NOT NULL CHECK(provider IN ('stream','youtube')),
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
CREATE INDEX IF NOT EXISTS idx_lesson_videos_lesson ON lesson_videos(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_videos_stream ON lesson_videos(stream_uid);

-- 6) lesson_files
CREATE TABLE IF NOT EXISTS lesson_files (
  id              TEXT PRIMARY KEY,
  lesson_id       TEXT NOT NULL REFERENCES lessons(id),
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
CREATE INDEX IF NOT EXISTS idx_lesson_files_lesson ON lesson_files(lesson_id);

-- 7) activation_codes
CREATE TABLE IF NOT EXISTS activation_codes (
  id          TEXT PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  batch_id    TEXT NOT NULL REFERENCES code_batches(id),
  scope_type  TEXT NOT NULL CHECK(scope_type IN ('course','bundle','all')),
  course_id   TEXT REFERENCES courses(id),
  bundle_id   TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','expired','revoked')),
  max_uses    INTEGER NOT NULL DEFAULT 1,
  used_count  INTEGER NOT NULL DEFAULT 0,
  used_by     TEXT REFERENCES profiles(id),
  used_at     TEXT,
  valid_from  TEXT,
  expires_at  TEXT,
  access_days INTEGER,
  created_by  TEXT NOT NULL REFERENCES profiles(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_codes_batch ON activation_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_codes_status ON activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_codes_course ON activation_codes(course_id);

-- 8) code_batches
CREATE TABLE IF NOT EXISTS code_batches (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  scope_type  TEXT NOT NULL CHECK(scope_type IN ('course','bundle','all')),
  course_id   TEXT,
  bundle_id   TEXT,
  quantity    INTEGER NOT NULL,
  access_days INTEGER,
  expires_at  TEXT,
  note        TEXT,
  created_by  TEXT NOT NULL REFERENCES profiles(id),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 9) bundles & bundle_courses (Phase 2)
CREATE TABLE IF NOT EXISTS bundles (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_url       TEXT,
  reference_price INTEGER,
  is_published    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE IF NOT EXISTS bundle_courses (
  bundle_id TEXT NOT NULL REFERENCES bundles(id),
  course_id TEXT NOT NULL REFERENCES courses(id),
  PRIMARY KEY (bundle_id, course_id)
);

-- 10) enrollments
CREATE TABLE IF NOT EXISTS enrollments (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES profiles(id),
  course_id   TEXT NOT NULL REFERENCES courses(id),
  source      TEXT NOT NULL DEFAULT 'code' CHECK(source IN ('code','manual','free')),
  code_id     TEXT REFERENCES activation_codes(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
  granted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(student_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

-- 11) lesson_progress
CREATE TABLE IF NOT EXISTS lesson_progress (
  id                       TEXT PRIMARY KEY,
  student_id               TEXT NOT NULL REFERENCES profiles(id),
  lesson_id                TEXT NOT NULL REFERENCES lessons(id),
  course_id                TEXT NOT NULL REFERENCES courses(id),
  watched_seconds          INTEGER NOT NULL DEFAULT 0,
  last_position            INTEGER NOT NULL DEFAULT 0,
  is_completed             INTEGER NOT NULL DEFAULT 0,
  highest_position_watched INTEGER NOT NULL DEFAULT 0,
  completed_at             TEXT,
  updated_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(student_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_student ON lesson_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_course ON lesson_progress(course_id);

-- 12) questions
CREATE TABLE IF NOT EXISTS questions (
  id           TEXT PRIMARY KEY,
  student_id   TEXT NOT NULL REFERENCES profiles(id),
  lesson_id    TEXT REFERENCES lessons(id),
  course_id    TEXT REFERENCES courses(id),
  body         TEXT NOT NULL,
  image_r2_key TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','answered','closed','hidden')),
  is_pinned    INTEGER NOT NULL DEFAULT 0,
  upvotes      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_questions_lesson ON questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_questions_student ON questions(student_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);

-- 13) answers
CREATE TABLE IF NOT EXISTS answers (
  id          TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  author_id   TEXT NOT NULL REFERENCES profiles(id),
  body        TEXT NOT NULL,
  is_accepted INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_answers_question ON answers(question_id);

-- 14) reviews
CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL CHECK(target_type IN ('lesson','course')),
  target_id   TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment     TEXT,
  status      TEXT NOT NULL DEFAULT 'visible' CHECK(status IN ('visible','hidden')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(student_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);

-- 15) devices
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES profiles(id),
  device_id     TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK(platform IN ('android','ios')),
  model         TEXT,
  push_token    TEXT,
  is_trusted    INTEGER NOT NULL DEFAULT 1,
  is_rooted     INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(student_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_devices_student ON devices(student_id);
CREATE INDEX IF NOT EXISTS idx_devices_push ON devices(push_token);

-- 16) notifications
CREATE TABLE IF NOT EXISTS notifications (
  id           TEXT PRIMARY KEY,
  recipient_id TEXT REFERENCES profiles(id),
  audience     TEXT NOT NULL DEFAULT 'user' CHECK(audience IN ('user','course','all')),
  course_id    TEXT,
  type         TEXT NOT NULL CHECK(type IN ('new_lesson','answer','announcement','system')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  data_json    TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  sent_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notif_audience ON notifications(audience);

-- 17) audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES profiles(id),
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  ip          TEXT,
  user_agent  TEXT,
  meta_json   TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

-- 18) app_settings
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed default settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('max_concurrent_sessions', '1'),
  ('signed_url_ttl_seconds', '120'),
  ('min_app_version', '1.0.0'),
  ('allow_self_device_reset', '1'),
  ('device_reset_cooldown_days', '30'),
  ('support_whatsapp', '+201000000000'),
  ('terms_url', ''),
  ('privacy_url', '');

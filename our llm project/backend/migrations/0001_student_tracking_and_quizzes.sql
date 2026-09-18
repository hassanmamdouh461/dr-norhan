-- ============================================================
-- Dr. Physics Platform — D1 (SQLite) Database Schema Extension
-- Migration: 0001_student_tracking_and_quizzes.sql
-- ============================================================

-- 1) Add student_code to profiles table
ALTER TABLE profiles ADD COLUMN student_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_code ON profiles(student_code);

-- 2) financial_transactions — Renewal and financial transaction history
CREATE TABLE IF NOT EXISTS financial_transactions (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id           TEXT REFERENCES courses(id) ON DELETE SET NULL,
  amount              INTEGER NOT NULL DEFAULT 0, -- in piasters/cents
  transaction_type    TEXT NOT NULL CHECK(transaction_type IN ('code_redeem', 'manual_admin', 'online_payment')),
  code_id             TEXT REFERENCES activation_codes(id) ON DELETE SET NULL,
  note                TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_financial_student ON financial_transactions(student_id);
CREATE INDEX IF NOT EXISTS idx_financial_created ON financial_transactions(created_at);

-- 3) lecture_playback_logs — Detailed lecture play session events (open / close)
CREATE TABLE IF NOT EXISTS lecture_playback_logs (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id           TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  action              TEXT NOT NULL CHECK(action IN ('open', 'close')),
  position_seconds    INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_playback_logs_student ON lecture_playback_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_lesson ON lecture_playback_logs(lesson_id);
CREATE INDEX IF NOT EXISTS idx_playback_logs_created ON lecture_playback_logs(created_at);

-- 4) quizzes — Course quizzes
CREATE TABLE IF NOT EXISTS quizzes (
  id                  TEXT PRIMARY KEY,
  course_id           TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id           TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  max_score           INTEGER NOT NULL DEFAULT 100,
  is_published        INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0, 1)),
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_quizzes_course ON quizzes(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON quizzes(lesson_id);

-- 5) quiz_attempts — Student quiz grades
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quiz_id             TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score               REAL NOT NULL DEFAULT 0.0,
  submitted_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(student_id, quiz_id)
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

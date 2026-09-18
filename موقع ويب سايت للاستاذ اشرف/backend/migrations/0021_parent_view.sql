-- ============================================================
-- منصة فُصْحَى — الأستاذ أشرف سليم · D1 (SQLite)
-- Migration: 0021_parent_view.sql
-- ============================================================
-- الغرض: تمكين «عرض وليّ الأمر» (الدليل §8.2):
--   1) ربط حساب وليّ الأمر بحساب الطالب.
--   2) ملاحظات الأستاذ الموجّهة لوليّ الأمر مباشرةً.
-- يعتمد على: profiles (0000)، lesson_progress (0000)، quiz_attempts (0001).
-- ============================================================

-- 1) روابط أولياء الأمور بالطلاب
CREATE TABLE IF NOT EXISTS parent_links (
  id          TEXT PRIMARY KEY,
  platform    TEXT NOT NULL DEFAULT 'fusha',
  parent_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relation    TEXT,                       -- «أب» / «أم» / «وصي»
  -- من أنشأ الرابط (للتدقيق) — اختياري
  created_by  TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(platform, parent_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent  ON parent_links(platform, parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON parent_links(platform, student_id);

-- 2) ملاحظات الأستاذ الموجّهة لوليّ الأمر
CREATE TABLE IF NOT EXISTS parent_notes (
  id          TEXT PRIMARY KEY,
  platform    TEXT NOT NULL DEFAULT 'fusha',
  student_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  read_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_parent_notes_student ON parent_notes(platform, student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parent_notes_unread   ON parent_notes(platform, student_id, read_at);

-- ملاحظة: ساعات المذاكرة تُحسب من lesson_progress.watched_seconds،
-- والدرجات من quiz_attempts.score، ومتوسط الدفعة يُحسب بنفس quiz_id.
-- لا حاجة لجداول إضافية.

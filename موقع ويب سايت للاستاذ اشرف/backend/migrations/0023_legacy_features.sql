-- ============================================================
-- منصة فُصْحَى — الأستاذ أشرف سليم · D1 (SQLite)
-- Migration: 0023_legacy_features.sql
-- ============================================================
-- الغرض: استعادة الميزات المفقودة من الكود القديم (الوثيقة 23):
--   1) سبب الإجابة الصحيحة  → quiz_questions.explanation
--   2) حزم الكورسات         → توسيع bundles
--   3) الأخبار              → news
--   4) المشتريات            → purchase_requests
--   5) طلب امتحان مخصص      → exam_build_requests
--   6) كتاب الأخطاء         → student_mistakes
--   7) الأخطاء الشائعة      → common_mistakes
--   8) النقاط والمستوى      → profiles.points/level + points_ledger
--   9) المحافظ والإحالة     → payment_wallets + referral_uses
-- كل جدول جديد يحمل عمود platform لعزل المنصات.
-- ============================================================

-- 1) سبب الإجابة الصحيحة
ALTER TABLE quiz_questions ADD COLUMN explanation TEXT;

-- 1ب) سعر الامتحان + تمييز الامتحانات المُنشأة (طلب امتحان مخصص)
ALTER TABLE quizzes ADD COLUMN price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0 CHECK(is_custom IN (0, 1));

-- 1ج) سعر المقرر (لشراء المقرر مباشرةً)
ALTER TABLE courses ADD COLUMN price INTEGER NOT NULL DEFAULT 0;

-- 2) توسيع حزم الكورسات
-- ⚠️ لا تُضف عمود `platform` هنا: جدول bundles أُنشئ به أصلاً في 0000_init.sql،
--    وإعادة إضافته تُسقط الهجرة بخطأ "duplicate column name: platform"
--    وتمنع إنشاء أي قاعدة بيانات جديدة من الصفر.
ALTER TABLE bundles ADD COLUMN price INTEGER;
ALTER TABLE bundles ADD COLUMN is_price_hidden INTEGER NOT NULL DEFAULT 0 CHECK(is_price_hidden IN (0, 1));
ALTER TABLE bundles ADD COLUMN features_json TEXT;
ALTER TABLE bundles ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bundles ADD COLUMN updated_at TEXT;
CREATE INDEX IF NOT EXISTS idx_bundles_platform ON bundles(platform);

-- 3) الأخبار
CREATE TABLE IF NOT EXISTS news (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL DEFAULT 'fusha',
  title         TEXT NOT NULL,
  body          TEXT,
  image_url     TEXT,
  is_published  INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  published_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_platform ON news(platform, is_published, sort_order);

-- 4) المشتريات + موافقة الإدارة
CREATE TABLE IF NOT EXISTS purchase_requests (
  id                  TEXT PRIMARY KEY,
  platform            TEXT NOT NULL DEFAULT 'fusha',
  student_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type         TEXT NOT NULL CHECK(target_type IN ('exam', 'course', 'bundle')),
  exam_id             TEXT REFERENCES quizzes(id) ON DELETE SET NULL,
  course_id           TEXT REFERENCES courses(id) ON DELETE SET NULL,
  bundle_id           TEXT REFERENCES bundles(id) ON DELETE SET NULL,
  amount              INTEGER NOT NULL DEFAULT 0,
  transfer_image_url  TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  reviewed_by         TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at         TEXT,
  rejection_reason    TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_student ON purchase_requests(student_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(platform, status);

-- 5) طلب امتحان مخصص
CREATE TABLE IF NOT EXISTS exam_build_requests (
  id                TEXT PRIMARY KEY,
  platform          TEXT NOT NULL DEFAULT 'fusha',
  student_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  duration_minutes  INTEGER NOT NULL,
  question_count    INTEGER NOT NULL,
  section_ids_json  TEXT,
  chapter_ids_json  TEXT,
  price             INTEGER NOT NULL DEFAULT 0,
  transfer_image_url TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  admin_notes       TEXT,
  generated_quiz_id TEXT REFERENCES quizzes(id) ON DELETE SET NULL,
  reviewed_by       TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_exam_build_requests_student ON exam_build_requests(student_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_build_requests_status ON exam_build_requests(platform, status);

-- 6) كتاب الأخطاء
CREATE TABLE IF NOT EXISTS student_mistakes (
  id                TEXT PRIMARY KEY,
  platform          TEXT NOT NULL DEFAULT 'fusha',
  student_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id       TEXT NOT NULL,
  question_source   TEXT NOT NULL DEFAULT 'quiz' CHECK(question_source IN ('quiz', 'bank')),
  quiz_id           TEXT NOT NULL DEFAULT '',
  exam_id           TEXT,
  question_text     TEXT,
  given_answer      TEXT,
  correct_answer    TEXT,
  points_lost       INTEGER NOT NULL DEFAULT 0,
  is_resolved       INTEGER NOT NULL DEFAULT 0 CHECK(is_resolved IN (0, 1)),
  resolved_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_student_mistakes_student ON student_mistakes(student_id, is_resolved);
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_mistakes_unique ON student_mistakes(student_id, question_id, quiz_id);

-- 7) الأخطاء الشائعة
CREATE TABLE IF NOT EXISTS common_mistakes (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL DEFAULT 'fusha',
  subject       TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_common_mistakes_platform ON common_mistakes(platform, is_published, sort_order);

-- 8) النقاط والمستوى
ALTER TABLE profiles ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN level INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS points_ledger (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL DEFAULT 'fusha',
  student_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points        INTEGER NOT NULL,
  reason        TEXT NOT NULL CHECK(reason IN ('exam_completed', 'challenge', 'referral', 'admin')),
  reference_id  TEXT,
  note          TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_points_ledger_student ON points_ledger(student_id, created_at);

-- 9) المحافظ + الإحالة
CREATE TABLE IF NOT EXISTS payment_wallets (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL DEFAULT 'fusha',
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_wallets_platform ON payment_wallets(platform, is_active);

CREATE TABLE IF NOT EXISTS referral_uses (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL DEFAULT 'fusha',
  referrer_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (referred_id)
);
CREATE INDEX IF NOT EXISTS idx_referral_uses_referrer ON referral_uses(referrer_id);

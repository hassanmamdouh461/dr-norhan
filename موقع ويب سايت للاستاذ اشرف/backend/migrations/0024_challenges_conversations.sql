-- ============================================================
-- منصة فُصْحَى — الأستاذ أشرف سليم · D1 (SQLite)
-- Migration: 0024_challenges_conversations.sql
-- ============================================================
-- الغرض: إغلاق بقية فجوات الوثيقة 23:
--   10) تحدي 1v1          → challenges + challenge_questions + challenge_answers
--   11) المحادثات         → messages (نصية + صوتية)
-- كل جدول جديد يحمل عمود platform لعزل المنصات.
-- ============================================================

-- 10) تحدي 1v1
CREATE TABLE IF NOT EXISTS challenges (
  id                TEXT PRIMARY KEY,
  platform          TEXT NOT NULL DEFAULT 'fusha',
  challenger_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_id       TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'accepted', 'rejected', 'completed')),
  duration_minutes  INTEGER NOT NULL DEFAULT 5,
  question_count    INTEGER NOT NULL DEFAULT 5,
  challenger_score  INTEGER NOT NULL DEFAULT 0,
  opponent_score    INTEGER NOT NULL DEFAULT 0,
  challenger_done   INTEGER NOT NULL DEFAULT 0 CHECK(challenger_done IN (0, 1)),
  opponent_done     INTEGER NOT NULL DEFAULT 0 CHECK(opponent_done IN (0, 1)),
  winner_id         TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  started_at        TEXT,
  completed_at      TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_challenges_opponent ON challenges(platform, opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges(platform, challenger_id, status);

CREATE TABLE IF NOT EXISTS challenge_questions (
  id            TEXT PRIMARY KEY,
  challenge_id  TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE (challenge_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_challenge_questions_challenge ON challenge_questions(challenge_id, sort_order);

CREATE TABLE IF NOT EXISTS challenge_answers (
  id            TEXT PRIMARY KEY,
  platform      TEXT NOT NULL DEFAULT 'fusha',
  challenge_id  TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id   TEXT NOT NULL,
  answer_json   TEXT,
  is_correct    INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0, 1)),
  points        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE (challenge_id, student_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_challenge_answers_student ON challenge_answers(challenge_id, student_id);

-- 11) المحادثات (مجموعة الطلاب والمعلم) — نصية وصوتية
CREATE TABLE IF NOT EXISTS messages (
  id                      TEXT PRIMARY KEY,
  platform                TEXT NOT NULL DEFAULT 'fusha',
  sender_id               TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body                    TEXT,
  audio_url               TEXT,
  audio_duration_seconds  INTEGER,
  is_deleted              INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_platform ON messages(platform, created_at);

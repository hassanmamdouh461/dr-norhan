-- ============================================================
-- فُصْحَى Platform — D1 (SQLite) Database Schema Extension
-- Migration: 0007_quizzes_questions_and_answers.sql
-- ============================================================

-- 1) quiz_questions — Store multiple choice questions for a quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
  id              TEXT PRIMARY KEY,
  quiz_id         TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text   TEXT,
  image_url       TEXT,
  options_json    TEXT NOT NULL, -- JSON array of strings e.g. '["Option A", "Option B", "Option C"]'
  correct_option  TEXT NOT NULL, -- The value or letter of the correct option (e.g. "Option A" or "A")
  score           INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);

-- 2) Add answers_json to quiz_attempts to store student choices
ALTER TABLE quiz_attempts ADD COLUMN answers_json TEXT;

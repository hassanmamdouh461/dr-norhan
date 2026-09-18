-- ============================================================
-- فُصْحَى — D1 (SQLite) Database Schema Extension
-- Migration: 0008_quiz_advanced_settings.sql
-- ============================================================

-- 1) Add advanced settings to quizzes table
ALTER TABLE quizzes ADD COLUMN randomize_questions INTEGER NOT NULL DEFAULT 0 CHECK(randomize_questions IN (0, 1));
ALTER TABLE quizzes ADD COLUMN start_time TEXT;
ALTER TABLE quizzes ADD COLUMN end_time TEXT;
ALTER TABLE quizzes ADD COLUMN time_limit_mins INTEGER;

-- 2) Add started_at and is_submitted to quiz_attempts table
ALTER TABLE quiz_attempts ADD COLUMN started_at TEXT;
ALTER TABLE quiz_attempts ADD COLUMN is_submitted INTEGER NOT NULL DEFAULT 1 CHECK(is_submitted IN (0, 1));

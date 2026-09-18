-- Migration: Add is_free column to quizzes
ALTER TABLE quizzes ADD COLUMN is_free INTEGER NOT NULL DEFAULT 0 CHECK(is_free IN (0, 1));

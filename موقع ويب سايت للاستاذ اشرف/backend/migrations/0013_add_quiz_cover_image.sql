-- Migration: Add cover_image column to quizzes
ALTER TABLE quizzes ADD COLUMN cover_image TEXT DEFAULT NULL;

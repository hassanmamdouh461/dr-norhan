-- Migration: Add branch column to profiles and courses
ALTER TABLE profiles ADD COLUMN branch TEXT DEFAULT NULL;
ALTER TABLE courses ADD COLUMN branch TEXT DEFAULT NULL;

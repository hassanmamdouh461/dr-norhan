-- ============================================================
-- فُصْحَى Platform — D1 (SQLite) Schema Extension
-- Migration: 0005_platform_isolation.sql
-- ============================================================

-- 1) Add platform column to profiles table directly
ALTER TABLE profiles ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
CREATE INDEX IF NOT EXISTS idx_profiles_platform ON profiles(platform);

-- 2) Alter other tables to add platform columns with default 'fusha'

-- courses
ALTER TABLE courses ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
CREATE INDEX IF NOT EXISTS idx_courses_platform ON courses(platform);

-- code_batches
ALTER TABLE code_batches ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
CREATE INDEX IF NOT EXISTS idx_code_batches_platform ON code_batches(platform);

-- activation_codes
ALTER TABLE activation_codes ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
CREATE INDEX IF NOT EXISTS idx_activation_codes_platform ON activation_codes(platform);

-- enrollments
ALTER TABLE enrollments ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
CREATE INDEX IF NOT EXISTS idx_enrollments_platform ON enrollments(platform);

-- notifications
ALTER TABLE notifications ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
CREATE INDEX IF NOT EXISTS idx_notifications_platform ON notifications(platform);

-- audit_logs
ALTER TABLE audit_logs ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
CREATE INDEX IF NOT EXISTS idx_audit_logs_platform ON audit_logs(platform);

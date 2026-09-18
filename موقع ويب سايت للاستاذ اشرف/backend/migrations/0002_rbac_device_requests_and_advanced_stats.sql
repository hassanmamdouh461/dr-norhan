-- ============================================================
-- فُصْحَى Platform — D1 (SQLite) Database Schema Extension
-- Migration: 0002_rbac_device_requests_and_advanced_stats.sql
-- ============================================================

-- 1) assistant_permissions — Permission controls for teaching assistants (RBAC)
CREATE TABLE IF NOT EXISTS assistant_permissions (
  id                  TEXT PRIMARY KEY,
  assistant_id        TEXT UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  can_reset_devices   INTEGER NOT NULL DEFAULT 0 CHECK(can_reset_devices IN (0, 1)),
  can_grade_quizzes   INTEGER NOT NULL DEFAULT 0 CHECK(can_grade_quizzes IN (0, 1)),
  can_answer_questions INTEGER NOT NULL DEFAULT 0 CHECK(can_answer_questions IN (0, 1)),
  can_manage_codes    INTEGER NOT NULL DEFAULT 0 CHECK(can_manage_codes IN (0, 1)),
  can_manage_courses  INTEGER NOT NULL DEFAULT 0 CHECK(can_manage_courses IN (0, 1)),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_assistant_permissions_uid ON assistant_permissions(assistant_id);

-- 2) device_reset_requests — Student tickets for device unbinding requests
CREATE TABLE IF NOT EXISTS device_reset_requests (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id           TEXT NOT NULL,
  platform            TEXT NOT NULL CHECK(platform IN ('android','ios')),
  model               TEXT,
  reason              TEXT NOT NULL,
  proof_image_url     TEXT,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  handled_by          TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  rejection_reason    TEXT,
  handled_at          TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_device_resets_student ON device_reset_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_device_resets_status ON device_reset_requests(status);

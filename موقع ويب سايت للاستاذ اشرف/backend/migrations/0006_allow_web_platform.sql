-- Disable foreign key constraints temporarily
PRAGMA foreign_keys = OFF;

-- 1) Re-create devices table to allow 'web' platform
ALTER TABLE devices RENAME TO devices_old;

CREATE TABLE devices (
  id            TEXT PRIMARY KEY,
  student_id    TEXT NOT NULL REFERENCES profiles(id),
  device_id     TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK(platform IN ('android','ios','web')),
  model         TEXT,
  push_token    TEXT,
  is_trusted    INTEGER NOT NULL DEFAULT 1,
  is_rooted     INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(student_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_devices_student ON devices(student_id);
CREATE INDEX IF NOT EXISTS idx_devices_push ON devices(push_token);

INSERT INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
SELECT id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at FROM devices_old;

DROP TABLE devices_old;

-- 2) Re-create device_reset_requests table to allow 'web' platform
ALTER TABLE device_reset_requests RENAME TO device_reset_requests_old;

CREATE TABLE device_reset_requests (
  id                  TEXT PRIMARY KEY,
  student_id          TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id           TEXT NOT NULL,
  platform            TEXT NOT NULL CHECK(platform IN ('android','ios','web')),
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

INSERT INTO device_reset_requests (id, student_id, device_id, platform, model, reason, proof_image_url, status, handled_by, rejection_reason, handled_at, created_at, updated_at)
SELECT id, student_id, device_id, platform, model, reason, proof_image_url, status, handled_by, rejection_reason, handled_at, created_at, updated_at FROM device_reset_requests_old;

DROP TABLE device_reset_requests_old;

-- Re-enable foreign key constraints
PRAGMA foreign_keys = ON;

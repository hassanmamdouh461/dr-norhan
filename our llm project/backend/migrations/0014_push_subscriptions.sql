-- Push subscriptions: every app install (and web client) registers its FCM
-- token here, even BEFORE signing in. This enables broadcasting notifications
-- to everyone who downloaded the app — not only logged-in students.
--
-- Distinct from the `devices` table (which is student-bound and drives device
-- trust / anti-piracy). A row here may have a NULL student_id (anonymous
-- install); it gets linked to a student once they authenticate.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            TEXT PRIMARY KEY,
  device_id     TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK(platform IN ('android','ios','web')),
  push_token    TEXT NOT NULL,
  student_id    TEXT REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL until sign-in
  platform_key  TEXT NOT NULL,                                    -- tenant isolation
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(device_id, platform_key)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_token ON push_subscriptions(push_token);
CREATE INDEX IF NOT EXISTS idx_push_subs_platform_key ON push_subscriptions(platform_key);
CREATE INDEX IF NOT EXISTS idx_push_subs_student ON push_subscriptions(student_id);

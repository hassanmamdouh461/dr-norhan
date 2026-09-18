-- Disable foreign keys check temporarily
PRAGMA foreign_keys = OFF;

-- 1) Rename old table
ALTER TABLE lesson_videos RENAME TO lesson_videos_old;

-- 2) Create new table with updated CHECK constraint for provider (without indexes yet)
CREATE TABLE lesson_videos (
  id               TEXT PRIMARY KEY,
  lesson_id        TEXT NOT NULL REFERENCES lessons(id),
  provider         TEXT NOT NULL CHECK(provider IN ('stream', 'youtube', 'r2', 'server')),
  stream_uid       TEXT,
  youtube_id       TEXT,
  thumbnail_url    TEXT,
  duration_seconds INTEGER,
  status           TEXT NOT NULL DEFAULT 'uploading' CHECK(status IN ('uploading','processing','ready','error')),
  require_drm      INTEGER NOT NULL DEFAULT 1,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- 3) Copy data from old table to new table
INSERT INTO lesson_videos (
  id, lesson_id, provider, stream_uid, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order, created_at, updated_at
)
SELECT 
  id, lesson_id, provider, stream_uid, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order, created_at, updated_at
FROM lesson_videos_old;

-- 4) Drop old table (this also drops the old indexes attached to it)
DROP TABLE lesson_videos_old;

-- 5) Recreate indexes on the new table
CREATE INDEX idx_lesson_videos_lesson ON lesson_videos(lesson_id);
CREATE INDEX idx_lesson_videos_stream ON lesson_videos(stream_uid);

-- Re-enable foreign keys check
PRAGMA foreign_keys = ON;

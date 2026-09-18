-- Drop the 'stream' (Cloudflare Stream) provider from lesson_videos.
--
-- Cloudflare Stream was never configured in production (CF_STREAM_SIGNING_KEY_ID
-- was empty), so any 'stream' row could never be played back — the playback route
-- returned STREAM_NOT_CONFIGURED for it. Verified 0 such rows in production before
-- writing this migration; the DELETE below is defensive only.
-- Cloud transcoding continues via Bunny Stream, which lands videos as 'r2_hls'.
--
-- SQLite cannot ALTER a CHECK constraint, so the table is recreated. The column
-- list below deliberately matches the 12 columns that exist in the production
-- database. Migration 0010 added a `platform` column to lesson_videos, but that
-- column is absent from production (schema drift) and no query in backend/src
-- reads lesson_videos.platform, so it is not carried over here.
--
-- The lesson_id foreign key regains ON DELETE CASCADE, which migration 0009
-- declared as the intended schema but which production does not currently have.

PRAGMA foreign_keys = OFF;

DELETE FROM lesson_videos WHERE provider = 'stream';

ALTER TABLE lesson_videos RENAME TO lesson_videos_old;

CREATE TABLE lesson_videos (
  id               TEXT PRIMARY KEY,
  lesson_id        TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK(provider IN ('youtube', 'r2', 'server', 'r2_hls')),
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

INSERT INTO lesson_videos (
  id, lesson_id, provider, stream_uid, youtube_id, thumbnail_url,
  duration_seconds, status, require_drm, sort_order, created_at, updated_at
)
SELECT
  id, lesson_id, provider, stream_uid, youtube_id, thumbnail_url,
  duration_seconds, status, require_drm, sort_order, created_at, updated_at
FROM lesson_videos_old;

DROP TABLE lesson_videos_old;

CREATE INDEX IF NOT EXISTS idx_lesson_videos_lesson ON lesson_videos(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_videos_stream ON lesson_videos(stream_uid);

PRAGMA foreign_keys = ON;

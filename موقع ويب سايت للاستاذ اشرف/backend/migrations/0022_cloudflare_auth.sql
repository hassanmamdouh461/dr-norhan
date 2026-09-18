-- ============================================================
-- منصة فُصْحَى — الأستاذ أشرف سليم · D1 (SQLite)
-- Migration: 0022_cloudflare_auth.sql
-- ============================================================
-- الغرض: استبدال Supabase بمصادقة Cloudflare أصلية.
--   1) إضافة عمود password_hash إلى profiles (PBKDF2-HMAC-SHA256، بصيغة salt:hash).
--   2) جدول refresh_tokens — لتخزين رموز التجديد مُجزَّأة (SHA-256) وإمكانية إلغائها.
--   3) جدول password_resets — لاستعادة كلمة المرور برمز لمرة واحدة.
-- ملاحظة: يبقى العمود supabase_user_id (لم يُعد مستخدماً) لأن إسقاط الأعمدة
--         في SQLite مكلف؛ تُكتب فيه قيمة عشوائية فريدة عند التسجيل.
-- ============================================================

-- 1) كلمة المرور المُجزَّأة
ALTER TABLE profiles ADD COLUMN password_hash TEXT;

-- 2) رموز التجديد (refresh tokens)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL DEFAULT 'fusha',
  user_agent  TEXT,
  ip          TEXT,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_profile ON refresh_tokens(profile_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- 3) استعادة كلمة المرور (رموز لمرة واحدة)
CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,
  profile_id  TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_password_resets_profile ON password_resets(profile_id);

-- ============================================================
-- منصة فُصحى — D1 (SQLite) Database Schema Extension
-- Migration: 0019_dictionary.sql
-- معجم فُصحى — قاموس المفردات الأدبية الصعبة (شعر + نثر + بلاغة)
-- ============================================================

-- 1) dictionary_entries — مدخلات المعجم
-- word_normalized هو نفس الكلمة بعد التطبيع (نزع التشكيل، توحيد الهمزات،
-- ى→ي، ة→ه، نزع "ال" التعريف) — يُستخدم للمطابقة الضبابية. راجع
-- normalizeArabic() في backend/src/routes/dictionary.ts.
CREATE TABLE IF NOT EXISTS dictionary_entries (
  id               TEXT PRIMARY KEY,
  platform         TEXT NOT NULL DEFAULT 'fusha',
  word             TEXT NOT NULL,            -- الكلمة (المدخل) مشكولة قدر الإمكان
  word_normalized  TEXT NOT NULL,            -- الكلمة بعد التطبيع (للبحث)
  root             TEXT,                     -- الجذر الثلاثي/الرباعي، مثل: "ط ل ل"
  type             TEXT,                     -- اسم / فعل / حرف / صفة / مصدر
  meaning          TEXT NOT NULL,            -- المعنى
  plural           TEXT,                     -- الجمع
  singular         TEXT,                     -- المفرد (إذا كان المدخل جمعاً)
  synonyms_json    TEXT,                     -- المرادفات
  antonyms_json    TEXT,                     -- المضاد
  context          TEXT,                     -- سياق الورود (البيت أو العبارة)
  exam_context     TEXT,                     -- وروده في امتحانات سابقة: مثال "وزاري 2023"
  lesson_id        TEXT,                     -- درس مرتبط (اختياري)
  unit             TEXT,                     -- الوحدة الدراسية
  audio_url        TEXT,                     -- نطق الكلمة (اختياري)
  difficulty       INTEGER NOT NULL DEFAULT 2, -- 1 سهل | 2 متوسط | 3 صعب
  tags_json        TEXT,                     -- مثال: ["شعر جاهلي","معلقات"]
  search_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_dictionary_word ON dictionary_entries(platform, word_normalized);
CREATE INDEX IF NOT EXISTS idx_dictionary_root ON dictionary_entries(platform, root);

-- يمنع تكرار الكلمة نفسها داخل المنصة، ويسمح للاستيراد بالتحديث (upsert)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dictionary_unique
  ON dictionary_entries(platform, word_normalized);

-- ============================================================
-- نهاية مخطط معجم فُصْحى.
-- المدخلات التجريبية (30 كلمة بشواهد) ليست هنا عن قصد —
-- انظر seeds/002_dictionary_ar.sql.
-- ============================================================

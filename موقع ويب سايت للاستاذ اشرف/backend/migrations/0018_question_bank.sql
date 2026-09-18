-- ============================================================
-- فُصْحَى (Fusha) — D1 (SQLite) Database Schema Extension
-- Migration: 0018_question_bank.sql
-- بنك الأسئلة — reusable, standalone question repository.
--
-- WHY: quiz_questions (0007) is a *weak* table owned by a single quiz.
-- A question cannot be reused, tagged, or searched across exams.
-- The question bank makes the QUESTION the first-class entity; exams
-- (existing quizzes) simply reference bank rows through exam_questions.
-- Old exams keep working untouched.
-- ============================================================


-- ============================================================
-- 1) question_bank — the canonical, reusable question
-- ============================================================
CREATE TABLE IF NOT EXISTS question_bank (
  id                  TEXT PRIMARY KEY,

  -- Multi-tenant isolation. Always 'fusha' on this deployment.
  platform            TEXT NOT NULL DEFAULT 'fusha',

  -- Optional curriculum anchors. All nullable so a question may live in the
  -- bank before it is attached to any course/unit/lesson.
  course_id           TEXT REFERENCES courses(id) ON DELETE SET NULL,
  unit_id             TEXT REFERENCES units(id) ON DELETE SET NULL,
  lesson_id           TEXT REFERENCES lessons(id) ON DELETE SET NULL,

  -- Question type
  --   mcq             : multiple choice  (options_json holds the choices)
  --   true_false      : صح / خطأ
  --   short_answer    : إجابة قصيرة
  --   essay           : مقالي
  --   matching        : صِل (options_json holds left/right pairs)
  --   fill_blank      : أكمل الفراغ
  --   ordering        : رتّب (options_json holds the scrambled items)
  --   poetry_analysis : تحليل شعري / بلاغي
  type                TEXT NOT NULL DEFAULT 'mcq'
                      CHECK(type IN ('mcq','true_false','short_answer','essay','matching','fill_blank','ordering','poetry_analysis')),

  difficulty          TEXT NOT NULL DEFAULT 'medium'
                      CHECK(difficulty IN ('easy','medium','hard')),

  -- Bloom's taxonomy level (تذكر / فهم / تطبيق / تحليل / تقويم / إبداع)
  bloom_level         TEXT,

  question_text       TEXT NOT NULL,
  image_url           TEXT,

  -- options_json: JSON array of strings for mcq / matching / ordering.
  --   mcq      -> ["خيار أ", "خيار ب", ...]
  --   matching -> [{"left":"...","right":"..."}]
  --   ordering -> ["العبارة الأولى", "العبارة الثانية", ...]
  options_json        TEXT,

  -- correct_answer_json — richer than a single letter, so every type is supported:
  --   mcq             -> {"option_index":1, "option_text":"..."}
  --   true_false      -> {"value":true} | {"value":false}
  --   short_answer    -> {"text":"الإجابة النموذجية"}
  --   fill_blank      -> {"text":"الكلمة المطلوبة"}
  --   essay           -> {"rubric":"نقاط التقييم ..."}
  --   matching        -> {"pairs":[{"left":"...","right":"..."}]}
  --   ordering        -> {"order":[0,2,1]}
  --   poetry_analysis -> {"text":"الإجابة النموذجية"}
  correct_answer_json TEXT,

  -- التفسير / الإجابة النموذجية الموضّحة للطالب بعد التصحيح
  explanation         TEXT,

  points              INTEGER NOT NULL DEFAULT 1,

  -- Arabic topic tags, e.g. ["النحو", "المفعول به"] — stored as a JSON array of strings.
  -- See note at the bottom of this file for the tags_json vs join-table decision.
  tags_json           TEXT NOT NULL DEFAULT '[]',

  -- المصدر، مثال: "وزاري 2024" / "كتاب المدرسة" / "تأليف"
  source              TEXT,

  usage_count         INTEGER NOT NULL DEFAULT 0,
  is_archived         INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),

  created_by          TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_qb_platform_course    ON question_bank(platform, course_id);
CREATE INDEX IF NOT EXISTS idx_qb_platform_type      ON question_bank(platform, type);
CREATE INDEX IF NOT EXISTS idx_qb_platform_difficulty ON question_bank(platform, difficulty);
CREATE INDEX IF NOT EXISTS idx_qb_platform_lesson    ON question_bank(platform, lesson_id);
CREATE INDEX IF NOT EXISTS idx_qb_platform_archived  ON question_bank(platform, is_archived);


-- ============================================================
-- 2) exam_questions — join table: an existing exam (quizzes.id)
--    is composed of bank questions.
--    points_override lets one exam weight a question differently
--    without mutating the canonical bank row.
-- ============================================================
CREATE TABLE IF NOT EXISTS exam_questions (
  id               TEXT PRIMARY KEY,
  quiz_id          TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id      TEXT NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  points_override  INTEGER,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  UNIQUE(quiz_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_quiz     ON exam_questions(quiz_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_exam_questions_question ON exam_questions(question_id);

-- ============================================================
-- نهاية مخطط بنك الأسئلة.
-- البيانات التجريبية (10 أسئلة نحو/بلاغة/أدب) ليست هنا عن قصد —
-- انظر seeds/001_question_bank_ar.sql.
-- ============================================================

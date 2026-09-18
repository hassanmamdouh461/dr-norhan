import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requireRole, requirePermission, rateLimit, optionalAuth } from '../middleware/auth';
import { generateId } from '../utils/id';
import { recordMistake } from '../lib/mistakes';
import { normalizeArabic } from './dictionary';

/**
 * بنك الأسئلة — Question Bank
 *
 * Questions are first-class, reusable entities. An exam (existing `quizzes`
 * row) is composed of bank questions through `exam_questions`, so the same
 * question can appear in many exams without duplication.
 *
 * Mounted at the app root, therefore all paths below are served as
 * /question-bank/*
 *
 * Two tiers:
 *   /question-bank/public/*  — learner-facing, answer-redacted. Any authenticated
 *                              learner may browse and self-check. The correct
 *                              answer is never SELECTed here; it is only ever
 *                              returned by /public/check, after an attempt.
 *   /question-bank/*         — staff-only (admin / assistant).
 */

const questionBank = new Hono<HonoBindings>();

/** Everything under this prefix is learner-facing and answer-redacted. */
const PUBLIC_PREFIX = '/question-bank/public';

/**
 * Columns safe to return to a learner — no answer key, no explanation.
 * Table-qualified (`q.`) because exam_questions also has `id`/`created_at`
 * and the list query can JOIN it.
 */
const PUBLIC_COLUMNS = `q.id, q.course_id, q.unit_id, q.lesson_id, q.type, q.difficulty,
  q.bloom_level, q.question_text, q.image_url, q.options_json, q.points,
  q.tags_json, q.source, q.created_at`;

// ── Enums (shared Arabic error messages) ──────────────────────────────
export const QUESTION_TYPES = [
  'mcq',
  'true_false',
  'short_answer',
  'essay',
  'matching',
  'fill_blank',
  'ordering',
  'poetry_analysis',
] as const;

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

export const BLOOM_LEVELS = [
  'تذكر',
  'فهم',
  'تطبيق',
  'تحليل',
  'تقويم',
  'إبداع',
] as const;

const SORTABLE_COLUMNS: Record<string, string> = {
  created_at: 'q.created_at',
  updated_at: 'q.updated_at',
  usage_count: 'q.usage_count',
  points: 'q.points',
  difficulty: 'q.difficulty',
  type: 'q.type',
};

const SORT_ORDERS: Record<string, string> = { asc: 'ASC', desc: 'DESC' };

const MAX_LIMIT = 50;

// ── Validation schemas ────────────────────────────────────────────────
const optionSchema = z.string().min(1).max(1000);

const questionInputSchema = z.object({
  type: z.enum(QUESTION_TYPES).default('mcq'),
  difficulty: z.enum(DIFFICULTIES).default('medium'),
  bloom_level: z.enum(BLOOM_LEVELS).nullable().optional(),
  course_id: z.string().max(200).nullable().optional(),
  unit_id: z.string().max(200).nullable().optional(),
  lesson_id: z.string().max(200).nullable().optional(),
  question_text: z.string().min(1, 'نص السؤال مطلوب').max(8000),
  image_url: z.string().max(1000).nullable().optional(),
  options: z.array(optionSchema).max(20).nullable().optional(),
  correct_answer: z.unknown().optional(),
  explanation: z.string().max(8000).nullable().optional(),
  points: z.coerce.number().int().min(1).max(100).default(1),
  tags: z.array(z.string().min(1).max(100)).max(20).default([]),
  source: z.string().max(300).nullable().optional(),
});

const questionUpdateSchema = questionInputSchema.partial().extend({
  is_archived: z.boolean().optional(),
});

const bulkSchema = z.object({
  questions: z.array(questionInputSchema).min(1).max(200),
});

const randomSchema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(10),
  type: z.enum(QUESTION_TYPES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  tags: z.array(z.string().min(1).max(100)).max(20).optional(),
  course_id: z.string().max(200).optional(),
  lesson_id: z.string().max(200).optional(),
  exclude_ids: z.array(z.string().max(200)).max(500).optional(),
});

const attachSchema = z.object({
  quiz_id: z.string().min(1),
  question_ids: z.array(z.string().min(1)).min(1).max(300),
  points_override: z.coerce.number().int().min(1).max(100).nullable().optional(),
});

// ── Row → API shape ───────────────────────────────────────────────────
function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type BankRow = {
  id: string;
  platform: string;
  course_id: string | null;
  unit_id: string | null;
  lesson_id: string | null;
  type: string;
  difficulty: string;
  bloom_level: string | null;
  question_text: string;
  image_url: string | null;
  options_json: string | null;
  correct_answer_json: string | null;
  explanation: string | null;
  points: number;
  tags_json: string | null;
  source: string | null;
  usage_count: number;
  is_archived: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function toApi(row: BankRow) {
  return {
    id: row.id,
    platform: row.platform,
    course_id: row.course_id,
    unit_id: row.unit_id,
    lesson_id: row.lesson_id,
    type: row.type,
    difficulty: row.difficulty,
    bloom_level: row.bloom_level,
    question_text: row.question_text,
    image_url: row.image_url,
    options: parseJsonSafe<string[] | null>(row.options_json, null),
    correct_answer: parseJsonSafe<unknown>(row.correct_answer_json, null),
    explanation: row.explanation,
    points: row.points,
    tags: parseJsonSafe<string[]>(row.tags_json, []),
    source: row.source,
    usage_count: row.usage_count,
    is_archived: row.is_archived === 1,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validationError(c: any, details: unknown) {
  return c.json(
    { error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details } },
    400
  );
}

// ── Shared filter builder for list / export ───────────────────────────
type Filters = {
  where: string[];
  binds: any[];
  join: string;
};

function buildFilters(q: Record<string, string | undefined>): Filters {
  const where: string[] = ['q.platform = ?'];
  const binds: any[] = [q.__platform];
  let join = '';

  // Text search — match against ? bound parameter (no interpolation).
  if (q.q) {
    where.push('(q.question_text LIKE ? OR q.explanation LIKE ?)');
    const like = `%${q.q}%`;
    binds.push(like, like);
  }

  if (q.type) {
    where.push('q.type = ?');
    binds.push(q.type);
  }

  if (q.difficulty) {
    where.push('q.difficulty = ?');
    binds.push(q.difficulty);
  }

  // Tag match: tags_json is a JSON array of strings, e.g. ["النحو"].
  // Bound-parameter LIKE against the serialised array — no string interpolation.
  if (q.tag) {
    where.push(`q.tags_json LIKE '%"' || ? || '"%'`);
    binds.push(q.tag);
  }

  if (q.course_id) {
    where.push('q.course_id = ?');
    binds.push(q.course_id);
  }

  if (q.lesson_id) {
    where.push('q.lesson_id = ?');
    binds.push(q.lesson_id);
  }

  if (q.unit_id) {
    where.push('q.unit_id = ?');
    binds.push(q.unit_id);
  }

  if (q.bloom_level) {
    where.push('q.bloom_level = ?');
    binds.push(q.bloom_level);
  }

  // Exclude archived by default; pass include_archived=true to see them.
  if (q.include_archived !== 'true') {
    where.push('q.is_archived = 0');
  }

  // Attach filter: only questions already linked to a given exam.
  if (q.quiz_id) {
    join = ' INNER JOIN exam_questions eq ON eq.question_id = q.id AND eq.quiz_id = ?';
  }

  return { where, binds, join };
}

// ── CSV helpers ───────────────────────────────────────────────────────
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = Array.isArray(value) ? value.join(' | ') : String(value);
  // Prefix formula-triggering characters to avoid CSV injection in Excel.
  const guarded = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function toCsv(rows: ReturnType<typeof toApi>[]): string {
  const header = [
    'id', 'type', 'difficulty', 'bloom_level', 'question_text',
    'options', 'correct_answer', 'explanation', 'points', 'tags', 'source',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvCell(r.id),
      csvCell(r.type),
      csvCell(r.difficulty),
      csvCell(r.bloom_level),
      csvCell(r.question_text),
      csvCell(r.options),
      csvCell(typeof r.correct_answer === 'object' ? JSON.stringify(r.correct_answer) : r.correct_answer),
      csvCell(r.explanation),
      csvCell(r.points),
      csvCell(r.tags),
      csvCell(r.source),
    ].join(','));
  }
  // BOM so Excel renders Arabic correctly.
  return '\uFEFF' + lines.join('\r\n');
}

// ============================================================
// Auth gate.
//  * every endpoint requires a logged-in user
//  * /question-bank/public/* is open to any learner (answers redacted)
//  * everything else is staff-only (admin / assistant); write endpoints
//    additionally require the can_manage_courses permission
//
// Fail-closed: any path that is not under PUBLIC_PREFIX is treated as staff.
// ============================================================
// ⚠️ المسارات العامة (PUBLIC_PREFIX) مفتوحة للزائر والطالب دون تسجيل دخول —
//    هذا مقصود: بنك الأسئلة سطح «تجرّب قبل الاشتراك» تعلنه الصفحة العامة.
//    لذلك يجب أن يتجاوز شرط المصادقة نفسه، لا شرط الصلاحية فقط.
//    (سابقاً كان requireAuth يُطبَّق على كل شيء، فكانت /public تردّ 401.)
questionBank.use('/question-bank/*', async (c, next) => {
  if (c.req.path.startsWith(PUBLIC_PREFIX)) {
    await next();
    return;
  }
  return requireAuth(c, next);
});
questionBank.use('/question-bank/*', async (c, next) => {
  if (c.req.path.startsWith(PUBLIC_PREFIX)) {
    await next();
    return;
  }
  return requireRole('admin', 'assistant')(c, next);
});

// ════════════════════════════════════════════════════════════
// ══ PUBLIC (LEARNER) TIER — answer-redacted ══════════════════
// ════════════════════════════════════════════════════════════

/** Fisher–Yates using Web Crypto (matches courses.ts shuffle style). */
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const j = Math.floor(rand * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Shape a row for a learner. Deliberately built field-by-field rather than
 * spreading the row: a future column added to question_bank can never leak
 * into the public payload by accident.
 *
 * `matching` is special-cased: its options_json stores the *solved* pairs
 * [{left,right}], so shipping it raw would hand the student the answer.
 * Only the left column is exposed, and the right column is returned as a
 * shuffled pool — enough to build a two-column drill, not enough to cheat.
 */
/**
 * مُصدَّرة للاختبار: هذه قائمة سماح (whitelist) — لا تُنسخ الحقول بل تُبنَى من جديد،
 * ولذلك لا يمكن أن يتسرّب مفتاح الإجابة أو الشرح إلى العميل ولو تغيّر المخطط لاحقاً.
 * أي تعديل هنا يجب أن يُرافقه تحديث `questionBank-redaction.test.ts`.
 */
export function toPublicApi(row: BankRow) {
  let options = parseJsonSafe<unknown>(row.options_json, null);
  let choices: string[] | null = null;

  if (row.type === 'matching') {
    const pairs = parseJsonSafe<{ left?: string; right?: string }[]>(row.options_json, []);
    options = pairs.map((p) => p?.left ?? '');
    choices = shuffle(pairs.map((p) => p?.right ?? ''));
  }

  return {
    id: row.id,
    course_id: row.course_id,
    unit_id: row.unit_id,
    lesson_id: row.lesson_id,
    type: row.type,
    difficulty: row.difficulty,
    bloom_level: row.bloom_level,
    question_text: row.question_text,
    image_url: row.image_url,
    options,
    choices,
    points: row.points,
    tags: parseJsonSafe<string[]>(row.tags_json, []),
    source: row.source,
    created_at: row.created_at,
  };
}

// ── Arabic-aware grading ──────────────────────────────────────────────
type GradeResult = { correct: boolean | null; reason?: string };

const TRUE_WORDS = new Set(['صح', 'ص', 'true', '1', 'نعم', 'صحح']);
const FALSE_WORDS = new Set(['خطأ', 'خ', 'false', '0', 'لا', 'خطا']);

function toBooleanAnswer(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (TRUE_WORDS.has(s)) return true;
    if (FALSE_WORDS.has(s)) return false;
  }
  return null;
}

/**
 * Grade one submitted answer against the stored key.
 * Uses the shared Arabic normaliser so a student is not marked wrong for
 * missing tashkeel or writing «الألف» instead of «ألف».
 * Returns `correct: null` for types that need a human marker (essay).
 */
// مُصدَّرة للاختبار: كان خلل هنا يجعل كل إجابة تُصحَّح كخاطئة
// (العميل يرسل {option_index} والفروع كانت تتوقع رقماً أو نصاً فقط).
export function gradeAnswer(type: string, key: unknown, given: unknown): GradeResult {
  const k = (key ?? {}) as Record<string, unknown>;

  // العميل قد يرسل الإجابة مُغلَّفة داخل كائن: {option_index} / {value} / {text} / {option_text}
  // بدل قيمة مباشرة (رقم أو نص). بدون فكّ التغليف كان كل تصحيح يرجّع false،
  // لأن الفروع أدناه كانت تختبر `typeof given === 'number' | 'string'`.
  // (لا يؤثر على matching/ordering لأن إجابتها تُقارَن كاملة كـ JSON.)
  let g: unknown = given;
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    const o = g as Record<string, unknown>;
    if (typeof o.option_index !== 'undefined') g = o.option_index;
    else if (typeof o.value !== 'undefined') g = o.value;
    else if (typeof o.text !== 'undefined') g = o.text;
    else if (typeof o.option_text !== 'undefined') g = o.option_text;
  }

  if (type === 'mcq') {
    const expectedIndex = typeof k.option_index === 'number' ? k.option_index : null;
    if (typeof g === 'number' && expectedIndex !== null) {
      return { correct: g === expectedIndex };
    }
    if (typeof g === 'string') {
      const trimmed = g.trim();
      if (expectedIndex !== null && trimmed === String(expectedIndex)) {
        return { correct: true };
      }
      if (typeof k.option_text === 'string') {
        return { correct: normalizeArabic(trimmed) === normalizeArabic(k.option_text) };
      }
    }
    return { correct: false };
  }

  if (type === 'true_false') {
    const expected = toBooleanAnswer(k.value);
    const actual = toBooleanAnswer(g);
    if (expected === null || actual === null) return { correct: false };
    return { correct: expected === actual };
  }

  if (type === 'matching' || type === 'ordering') {
    // Structured answers are compared as JSON — no fuzzy matching.
    // يُفكّ تغليف {pairs} / {order} إن أرسلها العميل ككائن، وإلا كانت المقارنة
    // غير متكافئة (مصفوفة مقابل كائن) فتُعدّ كل إجابة خاطئة.
    const expected = JSON.stringify(k.pairs ?? k.order ?? null);
    const givenStruct =
      given && typeof given === 'object' && !Array.isArray(given)
        ? (((given as Record<string, unknown>).pairs ??
            (given as Record<string, unknown>).order) as unknown)
        : given;
    const actual = JSON.stringify(givenStruct ?? null);
    return { correct: expected === actual };
  }

  if (type === 'essay') {
    return { correct: null, reason: 'السؤال المقالي يحتاج تصحيحًا يدويًا من المدرس' };
  }

  // short_answer / fill_blank / poetry_analysis
  const expectedText = typeof k.text === 'string' ? k.text : '';
  const givenText = typeof g === 'string' ? g : '';
  if (!expectedText || !givenText.trim()) return { correct: false };

  const normExpected = normalizeArabic(expectedText);
  const normGiven = normalizeArabic(givenText);
  if (normExpected === normGiven) return { correct: true };
  // Long model answers: accept a submission that contains them verbatim.
  if (normExpected.length >= 12 && normGiven.includes(normExpected)) return { correct: true };
  return { correct: false };
}

const checkSchema = z.object({
  question_id: z.string().min(1).max(200),
  answer: z.unknown(),
});

// ============================================================
// P1) GET /question-bank/public — browse, answers redacted
// ============================================================
questionBank.get(
  '/question-bank/public',
  rateLimit('qb_public_list', 120, 60),
  async (c) => {
    const platform = c.env.PLATFORM_KEY || 'fusha';
    const query = c.req.query();

    const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit || '20', 10) || 20));
    const offset = (page - 1) * limit;

    if (query.type && !QUESTION_TYPES.includes(query.type as any)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'نوع السؤال غير صالح' } }, 400);
    }
    if (query.difficulty && !DIFFICULTIES.includes(query.difficulty as any)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'مستوى الصعوبة غير صالح' } }, 400);
    }

    const filters = buildFilters({ ...query, __platform: platform });
    const whereSql = filters.where.join(' AND ');

    const sortColumn = SORTABLE_COLUMNS[query.sort || 'created_at'] || SORTABLE_COLUMNS.created_at;
    const sortOrder = SORT_ORDERS[(query.order || 'desc').toLowerCase()] || 'DESC';

    const countBinds = filters.join ? [query.quiz_id, ...filters.binds] : filters.binds;
    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM question_bank q${filters.join} WHERE ${whereSql}`
    ).bind(...countBinds).first<{ total: number }>();
    const total = totalRow?.total || 0;

    const listBinds = filters.join
      ? [query.quiz_id, ...filters.binds, limit, offset]
      : [...filters.binds, limit, offset];

    const { results } = await c.env.DB.prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM question_bank q${filters.join}
       WHERE ${whereSql}
       ORDER BY ${sortColumn} ${sortOrder}
       LIMIT ? OFFSET ?`
    ).bind(...listBinds).all<BankRow>();

    return c.json({
      questions: results.map((r) => toPublicApi(r)),
      meta: { page, limit, total, has_more: offset + results.length < total },
    });
  }
);

// ============================================================
// P2) GET /question-bank/public/tags — Arabic tag cloud
// ============================================================
questionBank.get('/question-bank/public/tags', rateLimit('qb_public_tags', 120, 60), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const { results } = await c.env.DB.prepare(
    'SELECT tags_json FROM question_bank WHERE platform = ? AND is_archived = 0 AND tags_json IS NOT NULL'
  ).bind(platform).all<{ tags_json: string }>();

  const counts = new Map<string, number>();
  for (const row of results) {
    for (const tag of parseJsonSafe<string[]>(row.tags_json, [])) {
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const tags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ar'));

  return c.json({ tags });
});

// ============================================================
// P3) POST /question-bank/public/random — random drill set
// ============================================================
questionBank.post(
  '/question-bank/public/random',
  rateLimit('qb_public_random', 60, 60),
  async (c) => {
    const platform = c.env.PLATFORM_KEY || 'fusha';

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'يجب إرسال بيانات بصيغة JSON' } }, 400);
    }

    const parsed = randomSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(c, parsed.error.flatten());
    }
    const d = parsed.data;

    const where: string[] = ['platform = ?', 'is_archived = 0'];
    const binds: any[] = [platform];

    if (d.type) { where.push('type = ?'); binds.push(d.type); }
    if (d.difficulty) { where.push('difficulty = ?'); binds.push(d.difficulty); }
    if (d.course_id) { where.push('course_id = ?'); binds.push(d.course_id); }
    if (d.lesson_id) { where.push('lesson_id = ?'); binds.push(d.lesson_id); }

    const exclude = (d.exclude_ids || []).filter(Boolean).slice(0, 500);
    if (exclude.length > 0) {
      where.push(`id NOT IN (${exclude.map(() => '?').join(',')})`);
      binds.push(...exclude);
    }

    for (const tag of d.tags || []) {
      where.push(`tags_json LIKE '%"' || ? || '"%'`);
      binds.push(tag);
    }

    const { results } = await c.env.DB.prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM question_bank q
       WHERE ${where.join(' AND ')}
       ORDER BY RANDOM()
       LIMIT ?`
    ).bind(...binds, d.count).all<BankRow>();

    const questions = results.map((r) => toPublicApi(r));

    return c.json({
      questions,
      count: questions.length,
      requested: d.count,
      ...(questions.length < d.count
        ? {
            message: questions.length === 0
              ? 'لا توجد أسئلة تطابق المعايير المحددة'
              : `تم العثور على ${questions.length} سؤالًا فقط من ${d.count} مطلوبًا`,
          }
        : {}),
    });
  }
);

// ============================================================
// P4) POST /question-bank/public/check — server-side grading.
//     The ONLY place a non-staff caller ever receives the answer key.
// ============================================================
questionBank.post(
  '/question-bank/public/check',
  optionalAuth,
  rateLimit('qb_public_check', 60, 60),
  async (c) => {
    const platform = c.env.PLATFORM_KEY || 'fusha';

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'يجب إرسال بيانات بصيغة JSON' } }, 400);
    }

    const parsed = checkSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(c, parsed.error.flatten());
    }

    const row = await c.env.DB.prepare(
      'SELECT * FROM question_bank WHERE id = ? AND platform = ? AND is_archived = 0'
    ).bind(parsed.data.question_id, platform).first<BankRow>();

    if (!row) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'السؤال غير موجود' } }, 404);
    }

    const key = parseJsonSafe<unknown>(row.correct_answer_json, null);
    const { correct, reason } = gradeAnswer(row.type, key, parsed.data.answer);

    const user = c.get('user');
    // كتاب الأخطاء: يُسجَّل الخطأ تلقائياً في التدريب أيضاً (عند وجود مستخدم).
    if (user && correct === false) {
      const correctAnswerText = bankAnswerText(row.type, row.options_json, key);
      await recordMistake(c.env, {
        studentId: user.id,
        questionId: row.id,
        source: 'bank',
        quizId: null,
        examId: null,
        questionText: row.question_text,
        givenAnswer: describeGivenAnswer(parsed.data.answer),
        correctAnswer: correctAnswerText,
        pointsLost: row.points,
      });
    }

    // The key and explanation are revealed only as part of a graded result.
    return c.json({
      question_id: row.id,
      type: row.type,
      correct,
      ...(reason ? { message: reason } : {}),
      correct_answer: key,
      explanation: row.explanation,
      points: row.points,
      ...(correct === false
        ? { correct_answer_reason: buildBankReason(row.type, row.options_json, key, row.explanation) }
        : {}),
    });
  }
);

/**
 * النص المعروض للإجابة الصحيحة في بنك الأسئلة.
 * Displays the correct answer as text (used by the error book / reason box).
 */
function bankAnswerText(type: string, optionsJson: string | null, key: unknown): string {
  const k = (key ?? {}) as Record<string, unknown>;

  if (type === 'mcq') {
    if (typeof k.option_text === 'string' && k.option_text) return k.option_text;
    const options = parseJsonSafe<string[] | null>(optionsJson, null);
    if (Array.isArray(options) && typeof k.option_index === 'number' && typeof options[k.option_index] === 'string') {
      return options[k.option_index];
    }
    return '';
  }

  if (type === 'true_false') {
    if (k.value === true) return 'صح';
    if (k.value === false) return 'خطأ';
    return '';
  }

  if (typeof k.text === 'string') return k.text;
  if (k.pairs !== undefined || k.order !== undefined) return JSON.stringify(k.pairs ?? k.order);
  return '';
}

/**
 * النص العربي الحرفي لسبب الإجابة الصحيحة (الوثيقة 23 §3.11):
 * «الإجابة الصحيحة هي «{correctOptionText}» لأن {correctAnswerReason}»
 */
function buildBankReason(type: string, optionsJson: string | null, key: unknown, explanation: string | null): string | null {
  const correctOptionText = bankAnswerText(type, optionsJson, key);
  if (!correctOptionText) return null;
  const reason = (explanation || '').trim();
  return `الإجابة الصحيحة هي «${correctOptionText}»${reason ? ` لأن ${reason}` : ''}`;
}

/** يحوّل إجابة الطالب (نص/رقم/كائن) إلى نص مقروء لكتاب الأخطاء. */
function describeGivenAnswer(given: unknown): string {
  if (given === null || given === undefined) return '';
  if (typeof given === 'string') return given;
  if (typeof given === 'number' || typeof given === 'boolean') return String(given);
  if (typeof given === 'object') {
    const o = given as Record<string, unknown>;
    for (const field of ['option_text', 'text', 'value', 'option_index']) {
      if (o[field] !== undefined && o[field] !== null) return String(o[field]);
    }
    return JSON.stringify(given);
  }
  return String(given);
}

// ════════════════════════════════════════════════════════════
// ══ STAFF TIER ══════════════════════════════════════════════
// ════════════════════════════════════════════════════════════

// ============================================================
// 1) GET /question-bank/tags — distinct Arabic tags (for filter UI)
//    MUST be registered before /:id
// ============================================================
questionBank.get('/question-bank/tags', async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const { results } = await c.env.DB.prepare(
    'SELECT tags_json FROM question_bank WHERE platform = ? AND is_archived = 0 AND tags_json IS NOT NULL'
  ).bind(platform).all<{ tags_json: string }>();

  const counts = new Map<string, number>();
  for (const row of results) {
    const tags = parseJsonSafe<string[]>(row.tags_json, []);
    for (const tag of tags) {
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const tags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ar'));

  return c.json({ tags });
});

// ============================================================
// 2) GET /question-bank/export — export filtered set (JSON / CSV)
//    MUST be registered before /:id
// ============================================================
questionBank.get('/question-bank/export', async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const query = c.req.query();
  const filters = buildFilters({ ...query, __platform: platform });

  const stmt = c.env.DB.prepare(
    `SELECT q.* FROM question_bank q${filters.join}
     WHERE ${filters.where.join(' AND ')}
     ORDER BY q.created_at DESC
     LIMIT 1000`
  );

  const bindValues = filters.join ? [query.quiz_id, ...filters.binds] : filters.binds;
  const { results } = await stmt.bind(...bindValues).all<BankRow>();
  const questions = results.map(toApi);

  if (query.format === 'csv') {
    return new Response(toCsv(questions), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="fusha-question-bank.csv"',
      },
    });
  }

  return c.json({
    questions,
    exported_at: new Date().toISOString(),
    count: questions.length,
  });
});

// ============================================================
// 3) GET /question-bank — list with filters + pagination
// ============================================================
questionBank.get('/question-bank', async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const query = c.req.query();

  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const rawLimit = Number.parseInt(query.limit || '20', 10) || 20;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  const offset = (page - 1) * limit;

  // Validate enum filters up front so bad input yields a clear 400.
  if (query.type && !QUESTION_TYPES.includes(query.type as any)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'نوع السؤال غير صالح' } }, 400);
  }
  if (query.difficulty && !DIFFICULTIES.includes(query.difficulty as any)) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'مستوى الصعوبة غير صالح' } }, 400);
  }

  const filters = buildFilters({ ...query, __platform: platform });
  const whereSql = filters.where.join(' AND ');

  // Whitelisted sort — never interpolated from raw user input.
  const sortColumn = SORTABLE_COLUMNS[query.sort || 'created_at'] || SORTABLE_COLUMNS.created_at;
  const sortOrder = SORT_ORDERS[(query.order || 'desc').toLowerCase()] || 'DESC';

  const countBinds = filters.join ? [query.quiz_id, ...filters.binds] : filters.binds;

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM question_bank q${filters.join} WHERE ${whereSql}`
  ).bind(...countBinds).first<{ total: number }>();
  const total = totalRow?.total || 0;

  const stmt = c.env.DB.prepare(
    `SELECT q.* FROM question_bank q${filters.join}
     WHERE ${whereSql}
     ORDER BY ${sortColumn} ${sortOrder}
     LIMIT ? OFFSET ?`
  );
  const listBinds = filters.join
    ? [query.quiz_id, ...filters.binds, limit, offset]
    : [...filters.binds, limit, offset];

  const { results } = await stmt.bind(...listBinds).all<BankRow>();

  return c.json({
    questions: results.map(toApi),
    meta: {
      page,
      limit,
      total,
      has_more: offset + results.length < total,
    },
  });
});

// ============================================================
// 4) POST /question-bank/random — pick N random questions
//    MUST be registered before /:id
// ============================================================
questionBank.post('/question-bank/random', async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'يجب إرسال بيانات بصيغة JSON' } }, 400);
  }

  const parsed = randomSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const d = parsed.data;

  const where: string[] = ['platform = ?', 'is_archived = 0'];
  const binds: any[] = [platform];

  if (d.type) { where.push('type = ?'); binds.push(d.type); }
  if (d.difficulty) { where.push('difficulty = ?'); binds.push(d.difficulty); }
  if (d.course_id) { where.push('course_id = ?'); binds.push(d.course_id); }
  if (d.lesson_id) { where.push('lesson_id = ?'); binds.push(d.lesson_id); }

  // Exclude already-picked questions (bound placeholders, never interpolated).
  const exclude = (d.exclude_ids || []).filter(Boolean).slice(0, 500);
  if (exclude.length > 0) {
    where.push(`id NOT IN (${exclude.map(() => '?').join(',')})`);
    binds.push(...exclude);
  }

  for (const tag of d.tags || []) {
    where.push(`tags_json LIKE '%"' || ? || '"%'`);
    binds.push(tag);
  }

  // Oversample then shuffle in JS: RANDOM() alone is fine but we need the
  // count to degrade gracefully when fewer questions match.
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM question_bank
     WHERE ${where.join(' AND ')}
     ORDER BY RANDOM()
     LIMIT ?`
  ).bind(...binds, d.count).all<BankRow>();

  const questions = results.map(toApi);

  if (questions.length < d.count) {
    return c.json({
      questions,
      count: questions.length,
      requested: d.count,
      message: questions.length === 0
        ? 'لا توجد أسئلة تطابق المعايير المحددة'
        : `تم العثور على ${questions.length} سؤالًا فقط من ${d.count} مطلوبًا`,
    });
  }

  return c.json({ questions, count: questions.length, requested: d.count });
});

// ============================================================
// 5) POST /question-bank/bulk — bulk create (import)
//    MUST be registered before /:id
// ============================================================
questionBank.post('/question-bank/bulk', requirePermission('can_manage_courses'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const user = c.get('user');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'يجب إرسال بيانات بصيغة JSON' } }, 400);
  }

  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }

  const statements = parsed.data.questions.map((q) => {
    const id = generateId();
    return c.env.DB.prepare(
      `INSERT INTO question_bank
        (id, platform, course_id, unit_id, lesson_id, type, difficulty, bloom_level,
         question_text, image_url, options_json, correct_answer_json, explanation,
         points, tags_json, source, usage_count, is_archived, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'))`
    ).bind(
      id,
      platform,
      q.course_id || null,
      q.unit_id || null,
      q.lesson_id || null,
      q.type,
      q.difficulty,
      q.bloom_level || null,
      q.question_text,
      q.image_url || null,
      q.options ? JSON.stringify(q.options) : null,
      q.correct_answer !== undefined ? JSON.stringify(q.correct_answer) : null,
      q.explanation || null,
      q.points,
      JSON.stringify(q.tags || []),
      q.source || null,
      user.id
    );
  });

  await c.env.DB.batch(statements);

  return c.json({ ok: true, created: statements.length }, 201);
});

// ============================================================
// 6) POST /question-bank/attach — link bank questions to an exam
//    MUST be registered before /:id
// ============================================================
questionBank.post('/question-bank/attach', requirePermission('can_manage_courses'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'يجب إرسال بيانات بصيغة JSON' } }, 400);
  }

  const parsed = attachSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const d = parsed.data;

  const quiz = await c.env.DB.prepare('SELECT id FROM quizzes WHERE id = ?').bind(d.quiz_id).first();
  if (!quiz) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الامتحان غير موجود' } }, 404);
  }

  // Verify every question belongs to this platform before linking.
  const ids = d.question_ids;
  const placeholders = ids.map(() => '?').join(',');
  const { results: found } = await c.env.DB.prepare(
    `SELECT id FROM question_bank WHERE platform = ? AND id IN (${placeholders})`
  ).bind(platform, ...ids).all<{ id: string }>();

  const foundIds = new Set(found.map((r) => r.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'بعض الأسئلة غير موجودة في بنك الأسئلة', details: { missing } } },
      404
    );
  }

  const currentOrder = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM exam_questions WHERE quiz_id = ?'
  ).bind(d.quiz_id).first<{ max_order: number }>();
  let nextOrder = (currentOrder?.max_order ?? -1) + 1;

  const statements = ids.map((questionId) =>
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO exam_questions (id, quiz_id, question_id, sort_order, points_override, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(generateId(), d.quiz_id, questionId, nextOrder++, d.points_override ?? null)
  );

  await c.env.DB.batch(statements);

  // usage_count tracks how often a question is reused across exams.
  await c.env.DB.prepare(
    `UPDATE question_bank SET usage_count = usage_count + 1, updated_at = datetime('now')
     WHERE id IN (${placeholders})`
  ).bind(...ids).run();

  return c.json({ ok: true, quiz_id: d.quiz_id, attached: ids.length });
});

// ============================================================
// 7) POST /question-bank — create a single question
// ============================================================
questionBank.post('/question-bank', requirePermission('can_manage_courses'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const user = c.get('user');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'يجب إرسال بيانات بصيغة JSON' } }, 400);
  }

  const parsed = questionInputSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const d = parsed.data;

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO question_bank
      (id, platform, course_id, unit_id, lesson_id, type, difficulty, bloom_level,
       question_text, image_url, options_json, correct_answer_json, explanation,
       points, tags_json, source, usage_count, is_archived, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    platform,
    d.course_id || null,
    d.unit_id || null,
    d.lesson_id || null,
    d.type,
    d.difficulty,
    d.bloom_level || null,
    d.question_text,
    d.image_url || null,
    d.options ? JSON.stringify(d.options) : null,
    d.correct_answer !== undefined ? JSON.stringify(d.correct_answer) : null,
    d.explanation || null,
    d.points,
    JSON.stringify(d.tags || []),
    d.source || null,
    user.id
  ).run();

  const row = await c.env.DB.prepare('SELECT * FROM question_bank WHERE id = ?').bind(id).first<BankRow>();
  return c.json({ question: toApi(row as BankRow) }, 201);
});

// ============================================================
// 8) GET /question-bank/:id
// ============================================================
questionBank.get('/question-bank/:id', async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const id = c.req.param('id');

  const row = await c.env.DB.prepare(
    'SELECT * FROM question_bank WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<BankRow>();

  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'السؤال غير موجود' } }, 404);
  }

  const { results: exams } = await c.env.DB.prepare(
    `SELECT eq.quiz_id, eq.sort_order, eq.points_override, q.title as quiz_title
     FROM exam_questions eq
     INNER JOIN quizzes q ON q.id = eq.quiz_id
     WHERE eq.question_id = ?
     ORDER BY eq.sort_order ASC`
  ).bind(id).all();

  return c.json({ question: toApi(row), exams });
});

// ============================================================
// 9) PATCH /question-bank/:id
// ============================================================
questionBank.patch('/question-bank/:id', requirePermission('can_manage_courses'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const id = c.req.param('id');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'يجب إرسال بيانات بصيغة JSON' } }, 400);
  }

  const parsed = questionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(c, parsed.error.flatten());
  }
  const d = parsed.data;

  const existing = await c.env.DB.prepare(
    'SELECT * FROM question_bank WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<BankRow>();

  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'السؤال غير موجود' } }, 404);
  }

  const setClauses: string[] = [];
  const binds: any[] = [];

  const assign = (column: string, value: any) => {
    setClauses.push(`${column} = ?`);
    binds.push(value);
  };

  if (d.type !== undefined) assign('type', d.type);
  if (d.difficulty !== undefined) assign('difficulty', d.difficulty);
  if (d.bloom_level !== undefined) assign('bloom_level', d.bloom_level);
  if (d.course_id !== undefined) assign('course_id', d.course_id);
  if (d.unit_id !== undefined) assign('unit_id', d.unit_id);
  if (d.lesson_id !== undefined) assign('lesson_id', d.lesson_id);
  if (d.question_text !== undefined) assign('question_text', d.question_text);
  if (d.image_url !== undefined) assign('image_url', d.image_url);
  if (d.options !== undefined) assign('options_json', d.options ? JSON.stringify(d.options) : null);
  if (d.correct_answer !== undefined) assign('correct_answer_json', JSON.stringify(d.correct_answer));
  if (d.explanation !== undefined) assign('explanation', d.explanation);
  if (d.points !== undefined) assign('points', d.points);
  if (d.tags !== undefined) assign('tags_json', JSON.stringify(d.tags));
  if (d.source !== undefined) assign('source', d.source);
  if (d.is_archived !== undefined) assign('is_archived', d.is_archived ? 1 : 0);

  if (setClauses.length === 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'لا توجد بيانات للتحديث' } }, 400);
  }

  setClauses.push("updated_at = datetime('now')");
  binds.push(id, platform);

  await c.env.DB.prepare(
    `UPDATE question_bank SET ${setClauses.join(', ')} WHERE id = ? AND platform = ?`
  ).bind(...binds).run();

  const row = await c.env.DB.prepare('SELECT * FROM question_bank WHERE id = ?').bind(id).first<BankRow>();
  return c.json({ question: toApi(row as BankRow) });
});

// ============================================================
// 10) DELETE /question-bank/:id — soft delete via is_archived
// ============================================================
questionBank.delete('/question-bank/:id', requirePermission('can_manage_courses'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT id FROM question_bank WHERE id = ? AND platform = ?'
  ).bind(id, platform).first();

  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'السؤال غير موجود' } }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE question_bank SET is_archived = 1, updated_at = datetime('now') WHERE id = ? AND platform = ?`
  ).bind(id, platform).run();

  return c.json({ ok: true });
});

export default questionBank;

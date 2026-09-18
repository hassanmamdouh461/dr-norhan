import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requireRole, rateLimit } from '../middleware/auth';
import { generateId } from '../utils/id';

const examBuilds = new Hono<HonoBindings>();

// مسارات /admin/* تحتاج تحميل المستخدم أولاً — requireRole وحدها لا تقرأ التوكن.
examBuilds.use('/admin/*', requireAuth);

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

/**
 * خريطة الأسعار (الوثيقة 23 §3.6): ٥→١٠ · ١٠→١٥ · ١٥→٢٠ · ٢٠→٢٥ جنيه
 */
export const EXAM_BUILD_PRICE_MAP: Record<number, number> = {
  5: 10,
  10: 15,
  15: 20,
  20: 25,
};

export const EXAM_BUILD_QUESTION_COUNTS = [5, 10, 15, 20] as const;

/** مدة الامتحان المسموحة بالدقائق. */
export const EXAM_BUILD_DURATIONS = [15, 30, 45, 60, 90, 120] as const;

export function priceForQuestionCount(count: number): number | null {
  return Object.prototype.hasOwnProperty.call(EXAM_BUILD_PRICE_MAP, count)
    ? EXAM_BUILD_PRICE_MAP[count]
    : null;
}

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.6). */
export const EXAM_BUILD_LABELS = {
  entry_button: 'أنشئ امتحانك',
  title: 'أنشئ امتحانك',
  q_duration: 'أهلاً! كم مدة الامتحان اللي عايزه؟ 👋',
  q_question_count: 'كم سؤال تحب تكون في الامتحان؟',
  q_sections: 'أي أقسام تحب تشملهم؟',
  q_chapters: 'أي فصول تحب تشملهم؟',
  q_title: 'عنوان ووصف الامتحان، وهيكون مدفوع؟',
  option_duration: '{n} دقيقة',
  option_question_count: '{n} سؤال',
  loading_sections: 'جاري تحميل الأقسام...',
  loading_chapters: 'جاري تحميل الفصول...',
  empty_sections: 'لا توجد أقسام متاحة',
  empty_chapters: 'لا توجد فصول لهذه الأقسام',
  form_title: 'عنوان الامتحان',
  form_description: 'وصف (اختياري)',
  form_price: 'السعر الإجمالي: {n} جنيه',
  form_transfer_image: 'صورة إثبات التحويل',
  image_selected: 'تم اختيار الصورة',
  image_remove: 'إزالة الصورة',
  back: 'رجوع',
  next: 'التالي',
  create: 'أنشئ الامتحان',
  error_title_required: 'أدخل عنوان الامتحان',
  error_image_required: 'ارفع صورة إثبات التحويل',
  error_sections_failed: 'لم يتم تحميل المواد. حاول مرة أخرى.',
  error_pick_failed: 'فشل في اختيار الصورة',
  success_title: 'تمام! طلبك جاهز وقيد التنفيذ ✅',
  success_subtitle: 'سنُعدّ الامتحان حسب اختياراتك قريباً',
  currency: 'جنيه',
} as const;

function parseIdArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

// ── GET /exam-builds/options — خيارات البناء + خريطة الأسعار ──
examBuilds.get('/exam-builds/options', requireAuth, async (c) => {
  return c.json({
    duration_options: EXAM_BUILD_DURATIONS.map(n => ({ minutes: n, label: `${n} دقيقة` })),
    question_count_options: EXAM_BUILD_QUESTION_COUNTS.map(n => ({
      question_count: n,
      price: EXAM_BUILD_PRICE_MAP[n],
      label: `${n} سؤال`,
      price_label: `السعر الإجمالي: ${EXAM_BUILD_PRICE_MAP[n]} جنيه`,
    })),
    currency: 'جنيه',
    labels: EXAM_BUILD_LABELS,
  });
});

// ── GET /exam-builds/sections — الأقسام المتاحة (مقررات بها أسئلة في البنك) ──
examBuilds.get('/exam-builds/sections', requireAuth, async (c) => {
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.title, COUNT(q.id) AS question_count
     FROM courses c
     INNER JOIN question_bank q ON q.course_id = c.id AND q.is_archived = 0
     WHERE c.platform = ? AND c.is_archived = 0
     GROUP BY c.id, c.title
     HAVING COUNT(q.id) > 0
     ORDER BY c.title ASC`
  ).bind(platform).all();

  return c.json({
    sections: results,
    empty_text: EXAM_BUILD_LABELS.empty_sections,
    loading_text: EXAM_BUILD_LABELS.loading_sections,
  });
});

// ── GET /exam-builds/chapters?section_ids=a,b — الفصول داخل الأقسام المختارة ──
examBuilds.get('/exam-builds/chapters', requireAuth, async (c) => {
  const platform = platformOf(c.env);
  const sectionIds = (c.req.query('section_ids') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (sectionIds.length === 0) {
    return c.json({
      chapters: [],
      empty_text: EXAM_BUILD_LABELS.empty_chapters,
      loading_text: EXAM_BUILD_LABELS.loading_chapters,
    });
  }

  const placeholders = sectionIds.map(() => '?').join(',');
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.title, l.course_id, COUNT(q.id) AS question_count
     FROM lessons l
     INNER JOIN question_bank q ON q.lesson_id = l.id AND q.is_archived = 0
     WHERE l.course_id IN (${placeholders}) AND q.platform = ?
     GROUP BY l.id, l.title, l.course_id
     HAVING COUNT(q.id) > 0
     ORDER BY l.title ASC`
  ).bind(...sectionIds, platform).all();

  return c.json({
    chapters: results,
    empty_text: EXAM_BUILD_LABELS.empty_chapters,
    loading_text: EXAM_BUILD_LABELS.loading_chapters,
  });
});

// ── POST /exam-builds — طالب ينشئ طلب امتحان مخصص ──
const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  duration_minutes: z.number().int().min(5).max(240),
  question_count: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]),
  section_ids: z.array(z.string().min(1)).max(50).optional(),
  chapter_ids: z.array(z.string().min(1)).max(200).optional(),
  transfer_image_url: z.string().min(1).max(1000),
});

examBuilds.post('/exam-builds', requireAuth, rateLimit('exam_build_create', 10, 300), async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;

  const price = priceForQuestionCount(d.question_count);
  if (price === null) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'عدد أسئلة غير مدعوم' } }, 400);
  }

  const sectionIds = (d.section_ids || []).slice(0, 50);
  const chapterIds = (d.chapter_ids || []).slice(0, 200);

  // يجب أن يكون هناك أسئلة فعلية مطابقة للاختيارات
  const available = await countAvailableQuestions(c.env, platform, sectionIds, chapterIds);
  if (available < d.question_count) {
    return c.json({
      error: {
        code: 'NOT_ENOUGH_QUESTIONS',
        message: `عدد الأسئلة المتاحة (${available}) أقل من المطلوب (${d.question_count})`,
      },
    }, 400);
  }

  const pending = await c.env.DB.prepare(
    "SELECT id FROM exam_build_requests WHERE student_id = ? AND platform = ? AND status = 'pending' LIMIT 1"
  ).bind(user.id, platform).first();
  if (pending) {
    return c.json({ error: { code: 'ALREADY_PENDING', message: 'لديك طلب امتحان قيد المراجعة بالفعل' } }, 409);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO exam_build_requests
       (id, platform, student_id, title, description, duration_minutes, question_count,
        section_ids_json, chapter_ids_json, price, transfer_image_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
  ).bind(
    id,
    platform,
    user.id,
    d.title,
    d.description ?? null,
    d.duration_minutes,
    d.question_count,
    JSON.stringify(sectionIds),
    JSON.stringify(chapterIds),
    price,
    d.transfer_image_url
  ).run();

  const created = await c.env.DB.prepare('SELECT * FROM exam_build_requests WHERE id = ?').bind(id).first();
  return c.json({
    ok: true,
    exam_build_request: created,
    success_title: EXAM_BUILD_LABELS.success_title,
    success_subtitle: EXAM_BUILD_LABELS.success_subtitle,
  }, 201);
});

// ── GET /exam-builds — طلبات الطالب ──
examBuilds.get('/exam-builds', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM exam_build_requests
     WHERE student_id = ? AND platform = ?
     ORDER BY created_at DESC`
  ).bind(user.id, platform).all();

  return c.json({ exam_build_requests: results, currency: 'جنيه' });
});

// ── GET /admin/exam-build-requests — مراجعة الإدارة ──
examBuilds.get('/admin/exam-build-requests', requireRole('admin'), async (c) => {
  const platform = platformOf(c.env);
  const status = c.req.query('status');

  const where: string[] = ['ebr.platform = ?'];
  const binds: unknown[] = [platform];
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    where.push('ebr.status = ?');
    binds.push(status);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ebr.*, p.full_name AS student_name, p.email AS student_email, p.phone AS student_phone, p.student_code
     FROM exam_build_requests ebr
     INNER JOIN profiles p ON p.id = ebr.student_id
     WHERE ${where.join(' AND ')}
     ORDER BY CASE ebr.status WHEN 'pending' THEN 0 ELSE 1 END, ebr.created_at DESC`
  ).bind(...binds).all<any[]>();

  const pendingCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM exam_build_requests WHERE platform = ? AND status = 'pending'"
  ).bind(platform).first<{ count: number }>();

  return c.json({
    exam_build_requests: (results as any[]).map(row => ({
      ...row,
      section_ids: parseIdArray(row.section_ids_json),
      chapter_ids: parseIdArray(row.chapter_ids_json),
    })),
    pending_count: pendingCount?.count ?? 0,
  });
});

// ── POST /admin/exam-build-requests/:id/approve — الموافقة + توليد الامتحان ──
examBuilds.post('/admin/exam-build-requests/:id/approve', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const admin = c.get('user');
  const platform = platformOf(c.env);

  const request = await c.env.DB.prepare(
    'SELECT * FROM exam_build_requests WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<any>();

  if (!request) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطلب غير موجود' } }, 404);
  }
  if (request.status === 'approved') {
    return c.json({ error: { code: 'ALREADY_REVIEWED', message: 'تمت الموافقة على هذا الطلب مسبقاً' } }, 400);
  }

  const sectionIds = parseIdArray(request.section_ids_json);
  const chapterIds = parseIdArray(request.chapter_ids_json);
  const questionCount = request.question_count as number;

  const bankQuestions = await sampleBankQuestions(c.env, platform, sectionIds, chapterIds, questionCount);
  if (bankQuestions.length === 0) {
    return c.json({ error: { code: 'NO_QUESTIONS', message: 'لا توجد أسئلة مطابقة لاختيارات الطالب في بنك الأسئلة' } }, 400);
  }

  const quizId = generateId();
  const now = "datetime('now')";
  const firstCourseId = bankQuestions[0]?.course_id || sectionIds[0] || null;
  const maxScore = bankQuestions.reduce((sum, q) => sum + (q.score || 0), 0);

  const statements: D1PreparedStatement[] = [];

  statements.push(
    c.env.DB.prepare(
      `INSERT INTO quizzes
         (id, course_id, lesson_id, title, max_score, is_published, sort_order,
          randomize_questions, is_free, price, is_custom, time_limit_mins, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, 1, 0, 0, 0, ?, 1, ?, ${now}, ${now})`
    ).bind(
      quizId,
      firstCourseId,
      request.title,
      maxScore,
      request.price || 0,
      request.duration_minutes || 30
    )
  );

  bankQuestions.forEach((q, index) => {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO quiz_questions
           (id, quiz_id, question_text, image_url, options_json, correct_option, score, sort_order, explanation, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${now}, ${now})`
      ).bind(
        generateId(),
        quizId,
        q.question_text,
        q.image_url,
        q.options_json,
        q.correct_option,
        q.score,
        index,
        q.explanation
      )
    );
  });

  // منح الطالب حق الوصول لامتحانه الخاص عبر طلب شراء معتمد
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO purchase_requests
         (id, platform, student_id, target_type, exam_id, course_id, bundle_id, amount, transfer_image_url, status, reviewed_by, reviewed_at, created_at, updated_at)
       VALUES (?, ?, ?, 'exam', ?, NULL, NULL, ?, ?, 'approved', ?, ${now}, ${now}, ${now})`
    ).bind(
      generateId(),
      platform,
      request.student_id,
      quizId,
      request.price || 0,
      request.transfer_image_url,
      admin.id
    )
  );

  statements.push(
    c.env.DB.prepare(
      `INSERT INTO financial_transactions (id, student_id, course_id, amount, transaction_type, code_id, note, created_at)
       VALUES (?, ?, ?, ?, 'online_payment', NULL, ?, ${now})`
    ).bind(
      generateId(),
      request.student_id,
      firstCourseId,
      request.price || 0,
      `طلب امتحان مخصص: ${request.title}`
    )
  );

  statements.push(
    c.env.DB.prepare(
      `UPDATE exam_build_requests
       SET status = 'approved', generated_quiz_id = ?, reviewed_by = ?, reviewed_at = ${now}, updated_at = ${now}
       WHERE id = ?`
    ).bind(quizId, admin.id, id)
  );

  await c.env.DB.batch(statements);

  const updated = await c.env.DB.prepare('SELECT * FROM exam_build_requests WHERE id = ?').bind(id).first();
  return c.json({
    ok: true,
    exam_build_request: updated,
    generated_quiz_id: quizId,
    generated_questions: bankQuestions.length,
    max_score: maxScore,
  });
});

// ── POST /admin/exam-build-requests/:id/reject — الرفض ──
examBuilds.post('/admin/exam-build-requests/:id/reject', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const admin = c.get('user');
  const platform = platformOf(c.env);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({
    admin_notes: z.string().trim().min(2).max(1000),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'سبب الرفض مطلوب', details: parsed.error.flatten() } }, 400);
  }

  const request = await c.env.DB.prepare(
    'SELECT id, status FROM exam_build_requests WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<{ id: string; status: string }>();

  if (!request) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطلب غير موجود' } }, 404);
  }
  if (request.status === 'approved') {
    return c.json({ error: { code: 'ALREADY_REVIEWED', message: 'لا يمكن رفض طلب تمت الموافقة عليه' } }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE exam_build_requests
     SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).bind(parsed.data.admin_notes, admin.id, id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM exam_build_requests WHERE id = ?').bind(id).first();
  return c.json({ ok: true, exam_build_request: updated });
});

// ── Helpers ──

function buildBankWhere(platform: string, sectionIds: string[], chapterIds: string[]) {
  const where: string[] = ['q.platform = ?', 'q.is_archived = 0', "q.type IN ('mcq', 'true_false', 'short_answer', 'fill_blank')"];
  const binds: unknown[] = [platform];

  if (sectionIds.length > 0) {
    where.push(`q.course_id IN (${sectionIds.map(() => '?').join(',')})`);
    binds.push(...sectionIds);
  }
  if (chapterIds.length > 0) {
    where.push(`q.lesson_id IN (${chapterIds.map(() => '?').join(',')})`);
    binds.push(...chapterIds);
  }
  return { where, binds };
}

async function countAvailableQuestions(
  env: HonoBindings['Bindings'],
  platform: string,
  sectionIds: string[],
  chapterIds: string[]
): Promise<number> {
  const { where, binds } = buildBankWhere(platform, sectionIds, chapterIds);
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM question_bank q WHERE ${where.join(' AND ')}`
  ).bind(...binds).first<{ count: number }>();
  return row?.count ?? 0;
}

interface GeneratedQuestion {
  question_text: string;
  image_url: string | null;
  options_json: string;
  correct_option: string;
  score: number;
  explanation: string | null;
  course_id: string | null;
}

/**
 * يسحب أسئلة عشوائية من بنك الأسئلة ويحوّلها إلى صيغة `quiz_questions`
 * (نص الخيار الصحيح لا حرفه) ليعمل التصحيح النصي الحالي بشكل صحيح.
 */
async function sampleBankQuestions(
  env: HonoBindings['Bindings'],
  platform: string,
  sectionIds: string[],
  chapterIds: string[],
  limit: number
): Promise<GeneratedQuestion[]> {
  const { where, binds } = buildBankWhere(platform, sectionIds, chapterIds);
  const { results } = await env.DB.prepare(
    `SELECT q.id, q.course_id, q.type, q.question_text, q.image_url, q.options_json,
            q.correct_answer_json, q.explanation, q.points
     FROM question_bank q
     WHERE ${where.join(' AND ')}
     ORDER BY RANDOM()
     LIMIT ?`
  ).bind(...binds, limit).all<any[]>();

  const generated: GeneratedQuestion[] = [];
  for (const row of results as any[]) {
    const mapped = mapBankQuestionToQuizQuestion(row);
    if (mapped) generated.push(mapped);
  }
  return generated;
}

function safeParse(raw: string | null | undefined): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function mapBankQuestionToQuizQuestion(row: any): GeneratedQuestion | null {
  const key = safeParse(row.correct_answer_json) || {};
  const options = safeParse(row.options_json);
  const score = Number.isFinite(row.points) ? Math.max(1, Math.trunc(row.points)) : 1;
  const base = {
    image_url: row.image_url ?? null,
    score,
    explanation: row.explanation ?? null,
    course_id: row.course_id ?? null,
    question_text: row.question_text ?? '',
  };

  if (row.type === 'mcq') {
    if (!Array.isArray(options) || options.length === 0) return null;
    const index = typeof key.option_index === 'number' ? key.option_index : null;
    const text = (index !== null && typeof options[index] === 'string')
      ? options[index]
      : (typeof key.option_text === 'string' ? key.option_text : null);
    if (!text) return null;
    return { ...base, options_json: JSON.stringify(options), correct_option: text };
  }

  if (row.type === 'true_false') {
    const value = typeof key.value === 'boolean' ? key.value : null;
    if (value === null) return null;
    return {
      ...base,
      options_json: JSON.stringify(['صح', 'خطأ']),
      correct_option: value ? 'صح' : 'خطأ',
    };
  }

  // short_answer / fill_blank
  const text = typeof key.text === 'string' ? key.text : null;
  if (!text) return null;
  return {
    ...base,
    options_json: JSON.stringify(options && Array.isArray(options) ? options : []),
    correct_option: text,
  };
}

export default examBuilds;

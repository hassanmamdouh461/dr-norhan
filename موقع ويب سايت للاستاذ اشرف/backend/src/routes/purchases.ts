import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requireRole, rateLimit } from '../middleware/auth';
import { generateId } from '../utils/id';
import { ACCESS_LABELS, PURCHASE_LABELS } from '../lib/access';

const purchases = new Hono<HonoBindings>();

// مسارات /admin/* تحتاج تحميل المستخدم أولاً — requireRole وحدها لا تقرأ التوكن.
purchases.use('/admin/*', requireAuth);

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

/** وصف عربي مختصر لطلب الشراء يُخزَّن في note للسجل المالي. */
function describeTarget(targetType: string, title: string | null | undefined): string {
  const label = targetType === 'exam' ? 'امتحان' : targetType === 'bundle' ? 'باقة' : 'مقرر';
  return `شراء ${label}: ${title || '—'}`;
}

/** يجلب عنوان الهدف (امتحان/مقرر/باقة) لتوثيقه في السجل المالي. */
async function resolveTargetTitle(
  env: HonoBindings['Bindings'],
  request: { target_type: string; exam_id?: string | null; course_id?: string | null; bundle_id?: string | null }
): Promise<string | null> {
  if (request.target_type === 'exam' && request.exam_id) {
    const row = await env.DB.prepare('SELECT title FROM quizzes WHERE id = ?').bind(request.exam_id).first<{ title: string }>();
    return row?.title ?? null;
  }
  if (request.target_type === 'course' && request.course_id) {
    const row = await env.DB.prepare('SELECT title FROM courses WHERE id = ?').bind(request.course_id).first<{ title: string }>();
    return row?.title ?? null;
  }
  if (request.target_type === 'bundle' && request.bundle_id) {
    const row = await env.DB.prepare('SELECT title FROM bundles WHERE id = ?').bind(request.bundle_id).first<{ title: string }>();
    return row?.title ?? null;
  }
  return null;
}

// ── GET /purchases/catalog — ما يمكن شراؤه (باقات + مقررات بأسعارها) ──
purchases.get('/purchases/catalog', requireAuth, async (c) => {
  const platform = platformOf(c.env);

  const { results: bundleRows } = await c.env.DB.prepare(
    `SELECT id, title, description, cover_url, price, is_price_hidden, reference_price
     FROM bundles WHERE platform = ? AND is_published = 1
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all();

  const { results: courseRows } = await c.env.DB.prepare(
    `SELECT id, title, description, cover_url, price, is_free
     FROM courses WHERE platform = ? AND is_published = 1 AND is_archived = 0
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all();

  return c.json({
    bundles: bundleRows,
    courses: courseRows,
    currency: 'جنيه',
    labels: { ...PURCHASE_LABELS, ...ACCESS_LABELS },
  });
});

// ── POST /purchases — طالب ينشئ طلب شراء ──
const createSchema = z.object({
  target_type: z.enum(['exam', 'course', 'bundle']),
  exam_id: z.string().min(1).optional(),
  course_id: z.string().min(1).optional(),
  bundle_id: z.string().min(1).optional(),
  transfer_image_url: z.string().min(1).max(1000),
});

purchases.post('/purchases', requireAuth, rateLimit('purchase_create', 10, 300), async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;

  // السعر يُحسب على الخادم دائماً — لا نثق بقيمة قادمة من العميل.
  let amount = 0;
  let examId: string | null = null;
  let courseId: string | null = null;
  let bundleId: string | null = null;
  let targetTitle: string | null = null;

  if (d.target_type === 'exam') {
    if (!d.exam_id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'معرّف الامتحان مطلوب' } }, 400);
    const exam = await c.env.DB.prepare(
      `SELECT q.id, q.title, q.price, q.course_id FROM quizzes q
       INNER JOIN courses c ON c.id = q.course_id
       WHERE q.id = ? AND c.platform = ?`
    ).bind(d.exam_id, platform).first<any>();
    if (!exam) return c.json({ error: { code: 'NOT_FOUND', message: 'الامتحان غير موجود' } }, 404);
    examId = exam.id;
    amount = exam.price || 0;
    targetTitle = exam.title;
  } else if (d.target_type === 'course') {
    if (!d.course_id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'معرّف المقرر مطلوب' } }, 400);
    const course = await c.env.DB.prepare(
      'SELECT id, title, price FROM courses WHERE id = ? AND platform = ? AND is_archived = 0'
    ).bind(d.course_id, platform).first<any>();
    if (!course) return c.json({ error: { code: 'NOT_FOUND', message: 'المقرر غير موجود' } }, 404);
    courseId = course.id;
    amount = course.price || 0;
    targetTitle = course.title;
  } else {
    if (!d.bundle_id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'معرّف الباقة مطلوب' } }, 400);
    const bundle = await c.env.DB.prepare(
      'SELECT id, title, price FROM bundles WHERE id = ? AND platform = ?'
    ).bind(d.bundle_id, platform).first<any>();
    if (!bundle) return c.json({ error: { code: 'NOT_FOUND', message: 'الباقة غير موجودة' } }, 404);
    bundleId = bundle.id;
    amount = bundle.price || 0;
    targetTitle = bundle.title;
  }

  // منع تكرار الطلب على نفس الهدف
  const duplicate = await c.env.DB.prepare(
    `SELECT id, status FROM purchase_requests
     WHERE student_id = ? AND platform = ?
       AND target_type = ?
       AND COALESCE(exam_id, '') = COALESCE(?, '')
       AND COALESCE(course_id, '') = COALESCE(?, '')
       AND COALESCE(bundle_id, '') = COALESCE(?, '')
       AND status IN ('pending', 'approved')
     LIMIT 1`
  ).bind(user.id, platform, d.target_type, examId, courseId, bundleId).first<{ id: string; status: string }>();

  if (duplicate) {
    return c.json({
      error: {
        code: duplicate.status === 'approved' ? 'ALREADY_PURCHASED' : 'ALREADY_PENDING',
        message: duplicate.status === 'approved' ? 'لقد تم تفعيل هذا المحتوى بالفعل' : 'لديك طلب قيد المراجعة لهذا المحتوى',
      },
    }, 409);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO purchase_requests
       (id, platform, student_id, target_type, exam_id, course_id, bundle_id, amount, transfer_image_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
  ).bind(id, platform, user.id, d.target_type, examId, courseId, bundleId, amount, d.transfer_image_url).run();

  const created = await c.env.DB.prepare('SELECT * FROM purchase_requests WHERE id = ?').bind(id).first();
  return c.json({ ok: true, purchase_request: created, labels: PURCHASE_LABELS }, 201);
});

// ── GET /purchases — طلبات الطالب ──
purchases.get('/purchases', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const { results } = await c.env.DB.prepare(
    `SELECT pr.*,
            q.title  AS exam_title,
            co.title AS course_title,
            b.title  AS bundle_title
     FROM purchase_requests pr
     LEFT JOIN quizzes q  ON q.id = pr.exam_id
     LEFT JOIN courses co ON co.id = pr.course_id
     LEFT JOIN bundles b  ON b.id = pr.bundle_id
     WHERE pr.student_id = ? AND pr.platform = ?
     ORDER BY pr.created_at DESC`
  ).bind(user.id, platform).all<any[]>();

  return c.json({
    purchases: (results as any[]).map(row => ({
      ...row,
      target_title: row.exam_title || row.course_title || row.bundle_title || null,
      status_label: row.status === 'approved'
        ? PURCHASE_LABELS.approved
        : row.status === 'rejected'
          ? PURCHASE_LABELS.rejected
          : PURCHASE_LABELS.pending,
    })),
    currency: 'جنيه',
    labels: PURCHASE_LABELS,
  });
});

// ── GET /admin/purchase-requests — مراجعة الإدارة ──
purchases.get('/admin/purchase-requests', requireRole('admin'), async (c) => {
  const platform = platformOf(c.env);
  const status = c.req.query('status');

  const where: string[] = ['pr.platform = ?'];
  const binds: unknown[] = [platform];
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    where.push('pr.status = ?');
    binds.push(status);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT pr.*,
            p.full_name AS student_name, p.email AS student_email, p.phone AS student_phone, p.student_code,
            q.title  AS exam_title,
            co.title AS course_title,
            b.title  AS bundle_title
     FROM purchase_requests pr
     INNER JOIN profiles p ON p.id = pr.student_id
     LEFT JOIN quizzes q  ON q.id = pr.exam_id
     LEFT JOIN courses co ON co.id = pr.course_id
     LEFT JOIN bundles b  ON b.id = pr.bundle_id
     WHERE ${where.join(' AND ')}
     ORDER BY CASE pr.status WHEN 'pending' THEN 0 ELSE 1 END, pr.created_at DESC`
  ).bind(...binds).all<any[]>();

  const pendingCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM purchase_requests WHERE platform = ? AND status = 'pending'"
  ).bind(platform).first<{ count: number }>();

  return c.json({
    purchase_requests: (results as any[]).map(row => ({
      ...row,
      target_title: row.exam_title || row.course_title || row.bundle_title || null,
    })),
    pending_count: pendingCount?.count ?? 0,
    dashboard_card: PURCHASE_LABELS.dashboard_card,
  });
});

// ── POST /admin/purchase-requests/:id/approve — الموافقة ──
purchases.post('/admin/purchase-requests/:id/approve', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const admin = c.get('user');
  const platform = platformOf(c.env);

  const request = await c.env.DB.prepare(
    'SELECT * FROM purchase_requests WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<any>();

  if (!request) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطلب غير موجود' } }, 404);
  }
  if (request.status === 'approved') {
    return c.json({ error: { code: 'ALREADY_REVIEWED', message: 'تمت الموافقة على هذا الطلب مسبقاً' } }, 400);
  }

  const statements: D1PreparedStatement[] = [];
  const now = "datetime('now')";

  // 1) تفعيل الاشتراكات اللازمة
  const courseIdsToEnroll: string[] = [];
  if (request.target_type === 'course' && request.course_id) {
    courseIdsToEnroll.push(request.course_id);
  } else if (request.target_type === 'bundle' && request.bundle_id) {
    const { results } = await c.env.DB.prepare(
      'SELECT course_id FROM bundle_courses WHERE bundle_id = ?'
    ).bind(request.bundle_id).all<{ course_id: string }>();
    courseIdsToEnroll.push(...(results as any[]).map(r => r.course_id));
  }

  for (const courseId of courseIdsToEnroll) {
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO enrollments (id, student_id, course_id, source, status, granted_at, created_at, platform)
         VALUES (?, ?, ?, 'manual', 'active', ${now}, ${now}, ?)
         ON CONFLICT(student_id, course_id) DO UPDATE SET status = 'active', granted_at = ${now}`
      ).bind(generateId(), request.student_id, courseId, platform)
    );
  }

  // 2) سطر مالي في السجل
  const targetTitle = await resolveTargetTitle(c.env, request);
  const transactionId = generateId();
  statements.push(
    c.env.DB.prepare(
      `INSERT INTO financial_transactions (id, student_id, course_id, amount, transaction_type, code_id, note, created_at)
       VALUES (?, ?, ?, ?, 'online_payment', NULL, ?, ${now})`
    ).bind(
      transactionId,
      request.student_id,
      request.course_id || null,
      request.amount || 0,
      describeTarget(request.target_type, targetTitle)
    )
  );

  // 3) تحديث حالة الطلب
  statements.push(
    c.env.DB.prepare(
      `UPDATE purchase_requests
       SET status = 'approved', reviewed_by = ?, reviewed_at = ${now}, rejection_reason = NULL, updated_at = ${now}
       WHERE id = ?`
    ).bind(admin.id, id)
  );

  await c.env.DB.batch(statements);

  const updated = await c.env.DB.prepare('SELECT * FROM purchase_requests WHERE id = ?').bind(id).first();
  return c.json({ ok: true, purchase_request: updated, transaction_id: transactionId, enrolled_courses: courseIdsToEnroll.length });
});

// ── POST /admin/purchase-requests/:id/reject — الرفض ──
purchases.post('/admin/purchase-requests/:id/reject', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const admin = c.get('user');
  const platform = platformOf(c.env);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ rejection_reason: z.string().trim().min(2).max(1000) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'سبب الرفض مطلوب', details: parsed.error.flatten() } }, 400);
  }

  const request = await c.env.DB.prepare(
    'SELECT id, status FROM purchase_requests WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<{ id: string; status: string }>();

  if (!request) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطلب غير موجود' } }, 404);
  }
  if (request.status === 'approved') {
    return c.json({ error: { code: 'ALREADY_REVIEWED', message: 'لا يمكن رفض طلب تمت الموافقة عليه' } }, 400);
  }

  await c.env.DB.prepare(
    `UPDATE purchase_requests
     SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'), rejection_reason = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(admin.id, parsed.data.rejection_reason, id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM purchase_requests WHERE id = ?').bind(id).first();
  return c.json({ ok: true, purchase_request: updated });
});

export default purchases;

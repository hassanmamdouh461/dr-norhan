import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requirePermission, rateLimit } from '../middleware/auth';
import { generateId } from '../utils/id';

/**
 * عرض وليّ الأمر (الدليل §8.2)
 * ------------------------------------------------------------
 * كل مسار هنا يتحقّق من الملكية قبل قراءة أي بيانات:
 * المستخدم المسجّل يجب أن يكون مرتبطاً فعلاً بالطالب عبر parent_links،
 * وإلا يُردّ 403. لا يُوثق بأي معرّف قادم من العميل دون التحقق من الرابط.
 */
const parent = new Hono<HonoBindings>();

/**
 * مُصدَّرة للاختبار: هذه البوابة هي خط الدفاع الوحيد الذي يمنع وليّ أمر
 * من قراءة بيانات طالب آخر بتخمين المعرّف. أي تراجع فيها = كشف بيانات حسّاسة.
 */
export async function assertLinked(
  db: D1Database,
  platform: string,
  parentId: string,
  studentId: string
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM parent_links
        WHERE platform = ? AND parent_id = ? AND student_id = ?`
    )
    .bind(platform, parentId, studentId)
    .first<{ id: string }>();
  // إخفاق مُغلق (fail-closed): أي نتيجة غير صفّ يحمل id تُعتبر «غير مرتبط».
  // لا يُكتفى بـ !!row لأن كائناً فارغاً {} كان سيُعدّ نجاحاً.
  return !!row && !!row.id;
}

// ── GET /parent/children — الأبناء المرتبطون بحساب وليّ الأمر ──
parent.get('/parent/children', requireAuth, rateLimit('parent_children', 60, 60), async (c) => {
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.full_name, p.avatar_url, p.grade_year, p.governorate, pl.relation
       FROM parent_links pl
       JOIN profiles p ON p.id = pl.student_id
      WHERE pl.platform = ? AND pl.parent_id = ? AND p.platform = ?
      ORDER BY p.full_name ASC`
  )
    .bind(platform, user.id, platform)
    .all();

  return c.json({ children: results });
});

// ── GET /parent/children/:id/summary — ساعات المذاكرة والدرجات مقابل متوسط الدفعة ──
parent.get('/parent/children/:id/summary', requireAuth, rateLimit('parent_summary', 60, 60), async (c) => {
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const studentId = c.req.param('id');

  if (!(await assertLinked(c.env.DB, platform, user.id, studentId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'هذا الطالب غير مرتبط بحسابك' } }, 403);
  }

  const student = await c.env.DB.prepare(
    `SELECT id, full_name, avatar_url, grade_year, governorate FROM profiles
      WHERE id = ? AND platform = ?`
  )
    .bind(studentId, platform)
    .first();

  if (!student) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  // إجمالي وقت المشاهدة وإكمال الدروس
  const totals = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(watched_seconds), 0) AS total_seconds,
            COUNT(*)                          AS lessons_started,
            COALESCE(SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END), 0) AS lessons_completed
       FROM lesson_progress
      WHERE student_id = ? AND platform = ?`
  )
    .bind(studentId, platform)
    .first<{ total_seconds: number; lessons_started: number; lessons_completed: number }>();

  // التقدّم لكل كورس
  const { results: perCourse } = await c.env.DB.prepare(
    `SELECT c.id AS course_id,
            c.title AS course_title,
            COUNT(lp.id) AS lessons_started,
            COALESCE(SUM(CASE WHEN lp.is_completed = 1 THEN 1 ELSE 0 END), 0) AS lessons_completed,
            COALESCE(SUM(lp.watched_seconds), 0) AS watched_seconds
       FROM lesson_progress lp
       JOIN courses c ON c.id = lp.course_id
      WHERE lp.student_id = ? AND lp.platform = ? AND c.platform = ?
      GROUP BY c.id
      ORDER BY c.title ASC`
  )
    .bind(studentId, platform, platform)
    .all();

  // محاولات الامتحانات مع متوسط الدفعة لنفس الامتحان
  const { results: exams } = await c.env.DB.prepare(
    `SELECT qa.id AS attempt_id,
            q.id  AS quiz_id,
            q.title AS quiz_title,
            q.max_score,
            qa.score,
            qa.submitted_at,
            (SELECT AVG(qa2.score) FROM quiz_attempts qa2 WHERE qa2.quiz_id = qa.quiz_id) AS cohort_avg,
            (SELECT COUNT(*)      FROM quiz_attempts qa3 WHERE qa3.quiz_id = qa.quiz_id) AS cohort_count
       FROM quiz_attempts qa
       JOIN quizzes q  ON q.id = qa.quiz_id
       JOIN courses c  ON c.id = q.course_id
      WHERE qa.student_id = ? AND c.platform = ?
      ORDER BY qa.submitted_at DESC`
  )
    .bind(studentId, platform)
    .all();

  const totalSeconds = Number(totals?.total_seconds || 0);

  return c.json({
    student,
    study: {
      total_seconds: totalSeconds,
      total_hours: Math.round((totalSeconds / 3600) * 10) / 10,
      lessons_started: Number(totals?.lessons_started || 0),
      lessons_completed: Number(totals?.lessons_completed || 0),
    },
    per_course: perCourse,
    exams,
  });
});

// ── GET /parent/children/:id/notes — ملاحظات الأستاذ ──
parent.get('/parent/children/:id/notes', requireAuth, rateLimit('parent_notes', 60, 60), async (c) => {
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const studentId = c.req.param('id');

  if (!(await assertLinked(c.env.DB, platform, user.id, studentId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'هذا الطالب غير مرتبط بحسابك' } }, 403);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT n.id, n.body, n.created_at, n.read_at, p.full_name AS author_name
       FROM parent_notes n
       JOIN profiles p ON p.id = n.author_id
      WHERE n.platform = ? AND n.student_id = ?
      ORDER BY n.created_at DESC`
  )
    .bind(platform, studentId)
    .all();

  return c.json({ notes: results });
});

// ── POST /parent/children/:id/notes/read — تعليم الملاحظات كمقروءة ──
parent.post('/parent/children/:id/notes/read', requireAuth, rateLimit('parent_notes_read', 30, 60), async (c) => {
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const studentId = c.req.param('id');

  if (!(await assertLinked(c.env.DB, platform, user.id, studentId))) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'هذا الطالب غير مرتبط بحسابك' } }, 403);
  }

  await c.env.DB.prepare(
    `UPDATE parent_notes SET read_at = datetime('now')
      WHERE platform = ? AND student_id = ? AND read_at IS NULL`
  )
    .bind(platform, studentId)
    .run();

  return c.json({ ok: true });
});

// ── POST /admin/students/:id/parent-notes — الأستاذ يكتب ملاحظة لوليّ الأمر ──
parent.post('/admin/students/:id/parent-notes', requireAuth, requirePermission('can_manage_courses'), async (c) => {
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const studentId = c.req.param('id');

  const schema = z.object({ body: z.string().min(3).max(2000) });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'يرجى إدخال نص الملاحظة' } }, 400);
  }

  const student = await c.env.DB.prepare('SELECT id FROM profiles WHERE id = ? AND platform = ?')
    .bind(studentId, platform)
    .first();
  if (!student) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO parent_notes (id, platform, student_id, author_id, body, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(id, platform, studentId, user.id, parsed.data.body)
    .run();

  return c.json({ id }, 201);
});

// ── POST /admin/students/:id/link-parent — ربط وليّ أمر بطالب ──
parent.post('/admin/students/:id/link-parent', requireAuth, requirePermission('can_manage_courses'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const studentId = c.req.param('id');

  const schema = z.object({
    parent_id: z.string().min(1),
    relation: z.string().max(40).optional(),
  });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات الربط غير صحيحة' } }, 400);
  }

  const both = await c.env.DB.prepare(
    `SELECT (SELECT id FROM profiles WHERE id = ?  AND platform = ?) AS student_id,
            (SELECT id FROM profiles WHERE id = ?  AND platform = ?) AS parent_id`
  )
    .bind(studentId, platform, parsed.data.parent_id, platform)
    .first<{ student_id: string | null; parent_id: string | null }>();

  if (!both?.student_id || !both?.parent_id) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب أو وليّ الأمر غير موجود' } }, 404);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO parent_links (id, platform, parent_id, student_id, relation, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(platform, parent_id, student_id) DO UPDATE SET relation = excluded.relation`
  )
    .bind(id, platform, parsed.data.parent_id, studentId, parsed.data.relation || null)
    .run();

  return c.json({ id }, 201);
});

export default parent;

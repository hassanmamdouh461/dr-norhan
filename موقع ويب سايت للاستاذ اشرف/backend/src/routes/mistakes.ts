import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requirePermission } from '../middleware/auth';
import { generateId } from '../utils/id';

const mistakes = new Hono<HonoBindings>();

// مسارات /admin/* تحتاج تحميل المستخدم أولاً — requirePermission وحدها لا تقرأ التوكن.
mistakes.use('/admin/*', requireAuth);

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.4). */
const MISTAKE_LABELS = {
  title: 'الأخطاء',
  subtitle: '{n} خطأ تم تسجيله',
  export_pdf: 'تصدير PDF',
  empty_title: 'ممتاز! لا توجد أخطاء',
  empty_subtitle: 'استمر في المذاكرة والتدريب',
  your_answer: 'إجابتك',
  correct_answer: 'الإجابة الصحيحة',
  loading: 'جاري تحميل الأخطاء...',
  load_error: 'حدث خطأ أثناء تحميل الأخطاء',
  mark_resolved: 'تعليم كمحلول',
  delete: 'حذف',
  report: {
    title: 'تقرير الأخطاء',
    subtitle: 'ملخص شامل لجميع الأخطاء في الامتحانات',
    generated_at: 'تاريخ التقرير:',
    total_mistakes: 'إجمالي الأخطاء:',
    total_points_lost: 'إجمالي النقاط المفقودة:',
    mistake_index: 'خطأ #{i}',
    points_lost: '-{n} نقطة',
    footer: 'تم إنشاء هذا التقرير تلقائياً من تطبيق اختبارات ثانوية عامة',
    export_action: 'تصدير تقرير الأخطاء',
    error_empty: 'لا توجد أخطاء لتصديرها',
    generating: 'جاري الإنشاء...',
    please_wait: 'يرجى الانتظار',
    success: 'تم تصدير التقرير بنجاح',
    error_failed: 'حدث خطأ أثناء إنشاء PDF',
  },
} as const;

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.5). */
const COMMON_MISTAKE_LABELS = {
  title: 'الأخطاء الشائعة',
  subtitle: 'تعرّف على الأخطاء المتكررة في الامتحانات وكيفية تجنبها',
  loading: 'جاري تحميل الأخطاء الشائعة...',
  load_error: 'حدث خطأ أثناء تحميل المحتوى',
  empty: 'لا توجد أخطاء شائعة متاحة حالياً',
} as const;

// ════════════════════════════════════════════════════════════
// كتاب الأخطاء — الطالب
// ════════════════════════════════════════════════════════════

// ── GET /me/mistakes — قائمة أخطائي + الإحصائيات ──
mistakes.get('/me/mistakes', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  const onlyUnresolved = c.req.query('unresolved') === '1';

  const where = ['student_id = ?', 'platform = ?'];
  const binds: unknown[] = [user.id, platform];
  if (onlyUnresolved) where.push('is_resolved = 0');

  const { results } = await c.env.DB.prepare(
    `SELECT id, question_id, question_source, quiz_id, exam_id, question_text,
            given_answer, correct_answer, points_lost, is_resolved, resolved_at, created_at
     FROM student_mistakes
     WHERE ${where.join(' AND ')}
     ORDER BY created_at DESC`
  ).bind(...binds).all<any[]>();

  const list = results as any[];
  const stats = {
    total_mistakes: list.length,
    unresolved_count: list.filter(m => m.is_resolved === 0).length,
    total_points_lost: list.reduce((sum, m) => sum + (m.points_lost || 0), 0),
  };

  return c.json({
    mistakes: list,
    stats: {
      ...stats,
      header: `${stats.total_mistakes} خطأ تم تسجيله`,
      points_lost_label: `${stats.total_points_lost} نقطة`,
    },
    labels: MISTAKE_LABELS,
  });
});

// ── PATCH /me/mistakes/:id/resolve — تعليم كمحلول ──
mistakes.patch('/me/mistakes/:id/resolve', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ is_resolved: z.boolean().optional() }).safeParse(body);
  const isResolved = parsed.success && parsed.data.is_resolved === false ? 0 : 1;

  const existing = await c.env.DB.prepare(
    'SELECT id FROM student_mistakes WHERE id = ? AND student_id = ? AND platform = ?'
  ).bind(id, user.id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الخطأ غير موجود' } }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE student_mistakes
     SET is_resolved = ?, resolved_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END
     WHERE id = ?`
  ).bind(isResolved, isResolved, id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM student_mistakes WHERE id = ?').bind(id).first();
  return c.json({ ok: true, mistake: updated });
});

// ── DELETE /me/mistakes/:id — حذف خطأ ──
mistakes.delete('/me/mistakes/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM student_mistakes WHERE id = ? AND student_id = ? AND platform = ?'
  ).bind(id, user.id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الخطأ غير موجود' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM student_mistakes WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ── DELETE /me/mistakes — حذف كل الأخطاء ──
mistakes.delete('/me/mistakes', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  await c.env.DB.prepare('DELETE FROM student_mistakes WHERE student_id = ? AND platform = ?').bind(user.id, platform).run();
  return c.json({ ok: true });
});

// ════════════════════════════════════════════════════════════
// الأخطاء الشائعة
// ════════════════════════════════════════════════════════════

// ── GET /common-mistakes — عرض عام (المنشور فقط) ──
mistakes.get('/common-mistakes', async (c) => {
  const platform = platformOf(c.env);
  const subject = c.req.query('subject');

  const where = ['platform = ?', 'is_published = 1'];
  const binds: unknown[] = [platform];
  if (subject) {
    where.push('subject = ?');
    binds.push(subject);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, subject, title, content, sort_order
     FROM common_mistakes
     WHERE ${where.join(' AND ')}
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(...binds).all<any[]>();

  // شارات المواد تُشتق من البيانات — لا تُثبَّت في الواجهة.
  const subjects = [...new Set((results as any[]).map(r => r.subject))];

  return c.json({ common_mistakes: results, subjects, labels: COMMON_MISTAKE_LABELS });
});

// ── GET /admin/common-mistakes ──
mistakes.get('/admin/common-mistakes', requirePermission('can_manage_courses'), async (c) => {
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM common_mistakes WHERE platform = ? ORDER BY subject ASC, sort_order ASC'
  ).bind(platform).all();
  return c.json({ common_mistakes: results });
});

const commonMistakeSchema = z.object({
  subject: z.string().trim().min(1).max(100),
  title: z.string().trim().min(2).max(300),
  content: z.string().max(20000).optional().nullable(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  is_published: z.boolean().optional(),
});

// ── POST /admin/common-mistakes ──
mistakes.post('/admin/common-mistakes', requirePermission('can_manage_courses'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = commonMistakeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO common_mistakes (id, platform, subject, title, content, sort_order, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    platformOf(c.env),
    d.subject,
    d.title,
    d.content ?? null,
    d.sort_order ?? 0,
    d.is_published ? 1 : 0
  ).run();

  const created = await c.env.DB.prepare('SELECT * FROM common_mistakes WHERE id = ?').bind(id).first();
  return c.json({ ok: true, common_mistake: created }, 201);
});

// ── PATCH /admin/common-mistakes/:id ──
mistakes.patch('/admin/common-mistakes/:id', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM common_mistakes WHERE id = ? AND platform = ?'
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'العنصر غير موجود' } }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = commonMistakeSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;

  const sets: string[] = [];
  const values: unknown[] = [];
  const assign = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    values.push(value);
  };

  if (d.subject !== undefined) assign('subject', d.subject);
  if (d.title !== undefined) assign('title', d.title);
  if (d.content !== undefined) assign('content', d.content);
  if (d.sort_order !== undefined) assign('sort_order', d.sort_order);
  if (d.is_published !== undefined) assign('is_published', d.is_published ? 1 : 0);

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    await c.env.DB.prepare(`UPDATE common_mistakes SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM common_mistakes WHERE id = ?').bind(id).first();
  return c.json({ ok: true, common_mistake: updated });
});

// ── DELETE /admin/common-mistakes/:id ──
mistakes.delete('/admin/common-mistakes/:id', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM common_mistakes WHERE id = ? AND platform = ?'
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'العنصر غير موجود' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM common_mistakes WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export default mistakes;

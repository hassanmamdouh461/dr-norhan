import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requireRole } from '../middleware/auth';
import { awardPoints, getPointsState, POINTS_PER_LEVEL } from '../lib/points';

const points = new Hono<HonoBindings>();

// مسارات /admin/* تحتاج تحميل المستخدم أولاً — requireRole وحدها لا تقرأ التوكن.
points.use('/admin/*', requireAuth);

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.12). */
const POINTS_LABELS = {
  level: 'المستوى {n}',
  total_points: 'إجمالي النقاط',
  points: 'النقاط',
  percentage: 'النسبة',
  completed_exams: 'اختبارات مكتملة',
  purchases: 'مشتريات',
  success_rate: 'نسبة النجاح',
  level_up: 'ارتقيت مستوى!',
  empty_history: 'لا يوجد سجل نقاط',
  tabs: {
    exam_history: 'سجل الاختبارات',
    mistakes: 'الأخطاء',
    points: 'النقاط',
  },
} as const;

const REASON_LABELS: Record<string, string> = {
  exam_completed: 'إتمام اختبار',
  challenge: 'تحدي',
  referral: 'إحالة',
  admin: 'من الإدارة',
};

// ── GET /me/points — النقاط والمستوى وسجل النقاط ──
points.get('/me/points', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const state = await getPointsState(c.env, user.id);

  const attempts = await c.env.DB.prepare(
    `SELECT COUNT(*) AS completed,
            COALESCE(AVG(CASE WHEN q.max_score > 0 THEN qa.score * 100.0 / q.max_score ELSE 0 END), 0) AS success_rate
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON q.id = qa.quiz_id
     WHERE qa.student_id = ? AND qa.is_submitted = 1`
  ).bind(user.id).first<{ completed: number; success_rate: number }>();

  const purchasesRow = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM purchase_requests WHERE student_id = ? AND platform = ? AND status = 'approved'"
  ).bind(user.id, platform).first<{ count: number }>();

  const { results: history } = await c.env.DB.prepare(
    `SELECT id, points, reason, reference_id, note, created_at
     FROM points_ledger
     WHERE student_id = ? AND platform = ?
     ORDER BY created_at DESC
     LIMIT 100`
  ).bind(user.id, platform).all<any[]>();

  const completed = attempts?.completed ?? 0;
  const successRate = Math.round(attempts?.success_rate ?? 0);

  return c.json({
    level: state.level,
    total_points: state.total_points,
    points_to_next_level: Math.max(0, state.level * POINTS_PER_LEVEL - state.total_points),
    stats: {
      completed_exams: completed,
      purchases: purchasesRow?.count ?? 0,
      success_rate: successRate,
    },
    history: (history as any[]).map(row => ({
      ...row,
      reason_label: REASON_LABELS[row.reason] || row.reason,
    })),
    labels: POINTS_LABELS,
  });
});

// ── POST /admin/students/:id/points — منح نقاط يدوياً ──
points.post('/admin/students/:id/points', requireRole('admin'), async (c) => {
  const studentId = c.req.param('id');
  const platform = platformOf(c.env);

  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    points: z.number().int().min(-100000).max(100000),
    note: z.string().trim().max(500).optional(),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const student = await c.env.DB.prepare(
    "SELECT id FROM profiles WHERE id = ? AND platform = ? AND role = 'student'"
  ).bind(studentId, platform).first();
  if (!student) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const result = await awardPoints(c.env, studentId, parsed.data.points, 'admin', {
    note: parsed.data.note ?? null,
  });

  return c.json({ ok: true, ...result });
});

// ── GET /admin/students/:id/points — سجل نقاط طالب ──
points.get('/admin/students/:id/points', requireRole('admin'), async (c) => {
  const studentId = c.req.param('id');
  const platform = platformOf(c.env);

  const student = await c.env.DB.prepare(
    'SELECT id, points, level FROM profiles WHERE id = ? AND platform = ?'
  ).bind(studentId, platform).first<{ id: string; points: number; level: number }>();
  if (!student) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, points, reason, reference_id, note, created_at
     FROM points_ledger WHERE student_id = ? AND platform = ?
     ORDER BY created_at DESC LIMIT 200`
  ).bind(studentId, platform).all();

  return c.json({
    total_points: student.points,
    level: student.level,
    history: results,
    labels: POINTS_LABELS,
  });
});

export default points;

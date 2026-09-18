import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, rateLimit } from '../middleware/auth';
import { generateId } from '../utils/id';

const questions = new Hono<HonoBindings>();

// ── POST /questions — Ask a question (student) ──
questions.post('/', requireAuth, rateLimit('post_question', 5, 60), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const schema = z.object({
    lesson_id: z.string().optional(),
    course_id: z.string().optional(),
    body: z.string().min(5).max(2000),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'يرجى إدخال سؤال صحيح', details: parsed.error.flatten() } }, 400);
  }

  const d = parsed.data;
  const id = generateId();

  // If lesson_id is given, get its course_id
  let courseId = d.course_id || null;
  const platform = c.env.PLATFORM_KEY || 'dr-physics';

  if (d.lesson_id) {
    const lesson = await c.env.DB.prepare(
      `SELECT l.course_id FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND c.platform = ?`
    ).bind(d.lesson_id, platform).first<{ course_id: string }>();
    if (!lesson) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
    }
    courseId = lesson.course_id;
  } else if (courseId) {
    const course = await c.env.DB.prepare(
      'SELECT id FROM courses WHERE id = ? AND platform = ?'
    ).bind(courseId, platform).first();
    if (!course) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } }, 404);
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO questions (id, student_id, lesson_id, course_id, body, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', datetime('now'), datetime('now'))`
  ).bind(id, user.id, d.lesson_id || null, courseId, d.body).run();

  return c.json(await c.env.DB.prepare('SELECT * FROM questions WHERE id = ?').bind(id).first(), 201);
});

// ── GET /questions — List questions for a lesson ──
questions.get('/', requireAuth, async (c) => {
  const lessonId = c.req.query('lesson_id');
  const courseId = c.req.query('course_id');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const user = c.get('user');

  const isStaff = user.role === 'admin' || user.role === 'assistant';

  const platform = c.env.PLATFORM_KEY || 'dr-physics';
  let targetCourseId: string | null = null;
  let isFreePreview = false;

  if (lessonId) {
    const lesson = await c.env.DB.prepare(
      `SELECT l.course_id, l.is_free_preview, c.is_free as course_is_free
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
    ).bind(lessonId, platform).first<{ course_id: string; is_free_preview: number; course_is_free: number }>();

    if (!lesson) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
    }
    targetCourseId = lesson.course_id;
    isFreePreview = lesson.is_free_preview === 1 || lesson.course_is_free === 1;
  } else if (courseId) {
    const course = await c.env.DB.prepare(
      'SELECT id FROM courses WHERE id = ? AND platform = ?'
    ).bind(courseId, platform).first();
    if (!course) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } }, 404);
    }
    targetCourseId = courseId;
  }

  if (!isStaff && targetCourseId && !isFreePreview) {
    const enrollment = await c.env.DB.prepare(
      `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
    ).bind(user.id, targetCourseId).first<{ id: string; expires_at: string | null }>();

    if (!enrollment) {
      return c.json({ error: { code: 'NOT_ENROLLED', message: 'لم يتم تفعيل الكورس لمشاهدة الأسئلة' } }, 403);
    }

    if (enrollment.expires_at && new Date(enrollment.expires_at) < new Date()) {
      return c.json({ error: { code: 'ENROLLMENT_EXPIRED', message: 'انتهت صلاحية اشتراكك' } }, 403);
    }
  }

  let where = "q.status != 'hidden'";
  const params: unknown[] = [];

  if (lessonId) { 
    where += ' AND q.lesson_id = ?'; 
    params.push(lessonId); 
  } else if (courseId) { 
    where += ' AND q.course_id = ?'; 
    params.push(courseId); 
  } else {
    // If no course/lesson is specified, only return the user's own questions (my questions tab)
    where += ' AND q.student_id = ?';
    params.push(user.id);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT q.*, p.full_name as student_name,
       (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count
     FROM questions q
     JOIN profiles p ON p.id = q.student_id
     WHERE ${where}
     ORDER BY q.is_pinned DESC, q.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return c.json({ questions: results });
});

// ── GET /questions/:id — Question with answers ──
questions.get('/:id', requireAuth, async (c) => {
  const questionId = c.req.param('id');
  const user = c.get('user');
  const isStaff = user.role === 'admin' || user.role === 'assistant';

  const platform = c.env.PLATFORM_KEY || 'dr-physics';
  const question = await c.env.DB.prepare(
    `SELECT q.*, p.full_name as student_name
     FROM questions q JOIN profiles p ON p.id = q.student_id
     WHERE q.id = ? AND p.platform = ?`
  ).bind(questionId, platform).first<any>();

  if (!question) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'السؤال غير موجود' } }, 404);
  }

  // Check access if student and not their own question
  if (!isStaff && question.student_id !== user.id) {
    let isFreePreview = false;
    if (question.lesson_id) {
      const lesson = await c.env.DB.prepare(
        'SELECT is_free_preview FROM lessons WHERE id = ?'
      ).bind(question.lesson_id).first<{ is_free_preview: number }>();
      isFreePreview = lesson?.is_free_preview === 1;
    }

    if (question.course_id && !isFreePreview) {
      const enrollment = await c.env.DB.prepare(
        `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, question.course_id).first<{ id: string; expires_at: string | null }>();

      if (!enrollment) {
        return c.json({ error: { code: 'NOT_ENROLLED', message: 'لم يتم تفعيل الكورس لمشاهدة هذا السؤال' } }, 403);
      }

      if (enrollment.expires_at && new Date(enrollment.expires_at) < new Date()) {
        return c.json({ error: { code: 'ENROLLMENT_EXPIRED', message: 'انتهت صلاحية اشتراكك' } }, 403);
      }
    }
  }

  const { results: answers } = await c.env.DB.prepare(
    `SELECT a.*, p.full_name as author_name, p.role as author_role
     FROM answers a JOIN profiles p ON p.id = a.author_id
     WHERE a.question_id = ?
     ORDER BY a.is_accepted DESC, a.created_at ASC`
  ).bind(questionId).all();

  return c.json({ ...question, answers });
});

export default questions;

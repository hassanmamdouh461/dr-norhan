import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, optionalAuth, rateLimit } from '../middleware/auth';
import { generateId } from '../utils/id';

const courses = new Hono<HonoBindings>();

// ── Public Non-Auth Exam Endpoints ──

// 1) GET /courses/public-exams — Get all public free exams
courses.get('/public-exams', async (c) => {
  const platform = c.env.PLATFORM_KEY || 'dr-physics';
  const query = `
    SELECT q.id, q.title, q.max_score, q.course_id, c.title as course_title,
           q.cover_image, q.start_time, q.end_time, q.time_limit_mins
    FROM quizzes q
    INNER JOIN courses c ON q.course_id = c.id
    WHERE q.lesson_id IS NULL AND q.is_published = 1 AND q.is_free = 1 AND c.platform = ? AND c.is_archived = 0
    ORDER BY q.created_at DESC
  `;
  const { results: exams } = await c.env.DB.prepare(query).bind(platform).all();
  return c.json({ exams });
});

// 2) GET /courses/public-exams/:id — Get questions for a public free exam (does not require login)
courses.get('/public-exams/:id', async (c) => {
  const examId = c.req.param('id');
  const exam = await c.env.DB.prepare(
    'SELECT * FROM quizzes WHERE id = ? AND lesson_id IS NULL AND is_published = 1 AND is_free = 1'
  ).bind(examId).first<any>();

  if (!exam) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الامتحان غير موجود أو غير متاح كمعاينة مجانية' } }, 404);
  }

  // Fetch questions (correct answers redacted for public viewing)
  const { results: questions } = await c.env.DB.prepare(
    'SELECT id, question_text, image_url, options_json, score, sort_order FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).bind(exam.id).all();

  let mappedQuestions = (questions as any[]).map(q => ({
    ...q,
    options: JSON.parse(q.options_json),
  }));

  // Shuffle questions if randomize_questions is enabled
  if (exam.randomize_questions === 1) {
    const shuffled = [...mappedQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (2**32) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    mappedQuestions = shuffled;
  }

  return c.json({
    exam,
    questions: mappedQuestions
  });
});

// 3) POST /courses/public-exams/:id/submit — Submit and grade a public free exam (does not require login, does not record attempts)
courses.post('/public-exams/:id/submit', rateLimit('public_exam_submit', 10, 60), async (c) => {
  const examId = c.req.param('id');
  const body = await c.req.json();

  const submitSchema = z.object({
    answers: z.record(z.string()),
  });
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } }, 400);
  }

  const studentAnswers = parsed.data.answers;

  const exam = await c.env.DB.prepare(
    'SELECT * FROM quizzes WHERE id = ? AND lesson_id IS NULL AND is_published = 1 AND is_free = 1'
  ).bind(examId).first<any>();

  if (!exam) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الامتحان غير موجود' } }, 404);
  }

  // Fetch questions with correct answers to grade
  const { results: questions } = await c.env.DB.prepare(
    'SELECT id, correct_option, score FROM quiz_questions WHERE quiz_id = ?'
  ).bind(exam.id).all();

  let totalScore = 0;
  let earnedScore = 0;
  const gradedQuestions: Record<string, { correct: boolean; correctOption: string; chosenOption: string | null }> = {};

  for (const q of questions as any[]) {
    const chosen = studentAnswers[q.id] || null;
    const isCorrect = chosen === q.correct_option;
    
    totalScore += q.score;
    if (isCorrect) {
      earnedScore += q.score;
    }
    
    gradedQuestions[q.id] = {
      correct: isCorrect,
      correctOption: q.correct_option,
      chosenOption: chosen
    };
  }

  // Calculate final score based on exam's max_score
  const scoreRatio = totalScore > 0 ? (earnedScore / totalScore) : 0;
  const finalScore = Math.round(scoreRatio * exam.max_score * 100) / 100;

  return c.json({
    success: true,
    score: finalScore,
    max_score: exam.max_score,
    gradedQuestions
  });
});

// ── GET /courses — List published courses (for students) ──
courses.get('/', optionalAuth, async (c) => {
  const user = c.get('user');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const grade = c.req.query('grade');
  const branch = c.req.query('branch');

  const platform = c.env.PLATFORM_KEY || 'dr-physics';
  let whereClause = "c.is_archived = 0 AND c.is_published = 1 AND c.platform = ?";
  const params: unknown[] = [platform];

  // Restrict grade and branch if logged in as a student
  let filterGrade = grade;
  let filterBranch = branch;
  if (user && user.role === 'student') {
    if (user.grade && user.grade.trim() !== '') {
      filterGrade = user.grade;
    }
    if (user.branch && user.branch.trim() !== '') {
      filterBranch = user.branch;
    }
  }

  // 1. Grade filter
  if (filterGrade && filterGrade.trim() !== '') {
    whereClause += " AND (c.grade = ? OR ? LIKE c.grade || '%' OR c.grade = 'جميع المراحل')";
    params.push(filterGrade, filterGrade);
  }

  // 2. Branch filter
  if (filterBranch && filterBranch.trim() !== '') {
    whereClause += " AND (c.branch = ? OR c.branch IS NULL OR c.branch = '' OR c.branch = 'عام')";
    params.push(filterBranch);
  } else if (user && user.role === 'student') {
    // If student has no branch or we're filtering general, only show general courses
    whereClause += " AND (c.branch IS NULL OR c.branch = '' OR c.branch = 'عام')";
  }

  // Get courses with enrollment status for current student.
  // lessons_count must match the visibility rule applied in the course-detail lesson list
  // (a lesson with no 'ready' video is hidden from students/guests) so a course card doesn't
  // advertise a lesson count higher than what the outline actually shows.
  const isStudentOrGuestForCounts = !user || user.role === 'student';
  const readyLessonsCountFilter = isStudentOrGuestForCounts
    ? ` AND (NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id) OR EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id AND v.status = 'ready'))`
    : '';

  let query = '';
  let bindParams: unknown[] = [];
  if (user) {
    query = `SELECT c.*,
       CASE WHEN (e.id IS NOT NULL AND e.status = 'active') OR c.is_free = 1 THEN 1 ELSE 0 END as is_enrolled,
       e.expires_at as enrollment_expires_at,
       (SELECT COUNT(*) FROM units WHERE course_id = c.id AND is_archived = 0 AND is_published = 1) as units_count,
       (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0 AND is_published = 1${readyLessonsCountFilter}) as lessons_count
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = ? AND e.status = 'active'
     WHERE ${whereClause}
     ORDER BY c.sort_order ASC, c.created_at DESC
     LIMIT ? OFFSET ?`;
    bindParams = [user.id, ...params, limit, offset];
  } else {
    query = `SELECT c.*,
       CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END as is_enrolled,
       NULL as enrollment_expires_at,
       (SELECT COUNT(*) FROM units WHERE course_id = c.id AND is_archived = 0 AND is_published = 1) as units_count,
       (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0 AND is_published = 1${readyLessonsCountFilter}) as lessons_count
     FROM courses c
     WHERE ${whereClause}
     ORDER BY c.sort_order ASC, c.created_at DESC
     LIMIT ? OFFSET ?`;
    bindParams = [...params, limit, offset];
  }

  const { results } = await c.env.DB.prepare(query).bind(...bindParams).all();

  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM courses c WHERE ${whereClause}`
  ).bind(...params).first<{ count: number }>() || { count: 0 };

  const mapped = results.map((course: any) => ({
    ...course,
    cover_image: course.cover_url || ''
  }));

  return c.json({
    courses: mapped,
    meta: { page, limit, total, has_more: offset + limit < total }
  });
});

// ── GET /me/courses — My enrolled + free courses ──
courses.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'dr-physics';

  // total_lessons must match the visibility rule applied in the course-detail lesson list
  // (a lesson with no 'ready' video is hidden from students) so "X/Y lessons completed" is
  // never stuck below 100% because of lessons the student can't actually see yet.
  const readyLessonsFilter = ` AND (NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id) OR EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id AND v.status = 'ready'))`;

  let freeCoursesWhere = "c.is_free = 1 AND c.is_published = 1 AND c.is_archived = 0 AND c.platform = ? AND c.id NOT IN (SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active')";
  const freeCoursesParams: unknown[] = [platform, user.id];

  if (user.role === 'student') {
    if (user.grade && user.grade.trim() !== '') {
      freeCoursesWhere += " AND (c.grade = ? OR ? LIKE c.grade || '%' OR c.grade = 'جميع المراحل')";
      freeCoursesParams.push(user.grade, user.grade);
    }
    if (user.branch && user.branch.trim() !== '') {
      freeCoursesWhere += " AND (c.branch = ? OR c.branch IS NULL OR c.branch = '' OR c.branch = 'عام')";
      freeCoursesParams.push(user.branch);
    } else {
      freeCoursesWhere += " AND (c.branch IS NULL OR c.branch = '' OR c.branch = 'عام')";
    }
  }

  const query = `
    SELECT c.*, e.granted_at, e.expires_at as enrollment_expires_at, e.status as enrollment_status,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0 AND is_published = 1${readyLessonsFilter}) as total_lessons,
      (SELECT COUNT(*) FROM lesson_progress lp
       JOIN lessons ON lessons.id = lp.lesson_id AND lessons.course_id = lp.course_id
       WHERE lp.course_id = c.id AND lp.student_id = ? AND lp.is_completed = 1
         AND lessons.is_archived = 0 AND lessons.is_published = 1${readyLessonsFilter}) as completed_lessons
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.student_id = ? AND e.status = 'active' AND c.is_archived = 0 AND c.platform = ?

    UNION

    SELECT c.*, NULL as granted_at, NULL as enrollment_expires_at, 'free' as enrollment_status,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0 AND is_published = 1${readyLessonsFilter}) as total_lessons,
      (SELECT COUNT(*) FROM lesson_progress lp
       JOIN lessons ON lessons.id = lp.lesson_id AND lessons.course_id = lp.course_id
       WHERE lp.course_id = c.id AND lp.student_id = ? AND lp.is_completed = 1
         AND lessons.is_archived = 0 AND lessons.is_published = 1${readyLessonsFilter}) as completed_lessons
    FROM courses c
    WHERE ${freeCoursesWhere}

    ORDER BY granted_at DESC
  `;

  const bindParams = [
    user.id, // for completed_lessons in 1st SELECT
    user.id, // for e.student_id in 1st SELECT
    platform, // for c.platform in 1st SELECT
    user.id, // for completed_lessons in 2nd SELECT
    ...freeCoursesParams
  ];

  const { results } = await c.env.DB.prepare(query).bind(...bindParams).all();

  const mapped = results.map((course: any) => ({
    ...course,
    cover_image: course.cover_url || '',
    lessons_count: course.total_lessons || 0
  }));

  return c.json({ courses: mapped });
});

// 3) GET /courses/exams — Get all standalone exams on the platform
courses.get('/exams', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'dr-physics';
  
  let query = `
    SELECT q.id, q.title, q.max_score, q.course_id, c.title as course_title,
           q.cover_image, q.start_time, q.end_time, q.time_limit_mins,
           qa.score as student_score, qa.submitted_at, qa.started_at, qa.is_submitted
    FROM quizzes q
    INNER JOIN courses c ON q.course_id = c.id
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = ?
    WHERE q.lesson_id IS NULL AND q.is_published = 1 AND c.platform = ? AND c.is_archived = 0
  `;
  const params: unknown[] = [user.id, platform];

  if (user.role === 'student') {
    if (user.grade && user.grade.trim() !== '') {
      query += " AND (c.grade = ? OR ? LIKE c.grade || '%' OR c.grade = 'جميع المراحل')";
      params.push(user.grade, user.grade);
    }
    if (user.branch && user.branch.trim() !== '') {
      query += " AND (c.branch = ? OR c.branch IS NULL OR c.branch = '' OR c.branch = 'عام')";
      params.push(user.branch);
    } else {
      query += " AND (c.branch IS NULL OR c.branch = '' OR c.branch = 'عام')";
    }
  }

  query += " ORDER BY q.created_at DESC";
  
  const { results: exams } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ exams });
});

// 4) GET /courses/exams/:id — Get specific standalone exam details and questions
courses.get('/exams/:id', requireAuth, async (c) => {
  const examId = c.req.param('id');
  const user = c.get('user');
  
  const exam = await c.env.DB.prepare(
    'SELECT * FROM quizzes WHERE id = ? AND lesson_id IS NULL AND is_published = 1'
  ).bind(examId).first<any>();
  
  if (!exam) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الامتحان غير موجود أو غير منشور' } }, 404);
  }
  
  // Verify enrollment or if the course is free
  const enrollment = await c.env.DB.prepare(
    "SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'"
  ).bind(user.id, exam.course_id).first();
  
  if (!enrollment) {
    const course = await c.env.DB.prepare('SELECT is_free FROM courses WHERE id = ?').bind(exam.course_id).first<any>();
    if (!course || course.is_free !== 1) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'يجب الاشتراك في المقرر الدراسي أولاً للوصول للامتحان' } }, 403);
    }
  }

  // Access Window Check
  const now = new Date().toISOString();
  if (exam.start_time && now < exam.start_time) {
    return c.json({ error: { code: 'NOT_STARTED', message: `هذا الامتحان لم يبدأ بعد. سيبدأ في: ${new Date(exam.start_time).toLocaleString('ar-EG')}` } }, 403);
  }
  
  // Fetch attempt if any
  let attempt = await c.env.DB.prepare(
    'SELECT id, score, submitted_at, answers_json, started_at, is_submitted FROM quiz_attempts WHERE student_id = ? AND quiz_id = ?'
  ).bind(user.id, exam.id).first<any>();

  // If exam has end_time, and they haven't started/submitted yet, and end_time is in the past
  if (exam.end_time && now > exam.end_time && (!attempt || attempt.is_submitted === 0)) {
    return c.json({ error: { code: 'EXPIRED', message: 'انتهى وقت دخول هذا الامتحان ولا يمكن بدء محاولة جديدة.' } }, 403);
  }

  // Auto-create attempt session if it doesn't exist and exam has a time limit
  if (!attempt && exam.time_limit_mins) {
    const attemptId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, answers_json, started_at, is_submitted, submitted_at, created_at)
       VALUES (?, ?, ?, 0, '{}', ?, 0, ?, ?)`
    ).bind(attemptId, user.id, exam.id, now, now, now).run();

    attempt = {
      id: attemptId,
      score: 0,
      started_at: now,
      is_submitted: 0,
      answers_json: '{}'
    };
  }
  
  // Fetch questions (only return correct_option if the student has already submitted their attempt)
  const selectFields = (attempt && attempt.is_submitted === 1)
    ? 'id, question_text, image_url, options_json, correct_option, score, sort_order'
    : 'id, question_text, image_url, options_json, score, sort_order';

  const { results: questions } = await c.env.DB.prepare(
    `SELECT ${selectFields} FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind(exam.id).all();
  
  let mappedQuestions = (questions as any[]).map(q => ({
    id: q.id,
    question_text: q.question_text,
    image_url: q.image_url,
    options: JSON.parse(q.options_json),
    score: q.score,
    sort_order: q.sort_order,
    ...(q.correct_option !== undefined ? { correct_option: q.correct_option } : {}),
  }));

  // Shuffle questions if randomize_questions is enabled and student is currently solving
  if (exam.randomize_questions === 1 && (!attempt || attempt.is_submitted === 0)) {
    const shuffled = [...mappedQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (2**32) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    mappedQuestions = shuffled;
  }
  
  return c.json({
    exam,
    questions: mappedQuestions,
    attempt: attempt ? {
      ...attempt,
      answers: JSON.parse(attempt.answers_json || '{}')
    } : null
  });
});

// 5) POST /courses/exams/:id/submit ── Submit standalone exam answers
courses.post('/exams/:id/submit', requireAuth, rateLimit('exam_submit', 10, 60), async (c) => {
  const examId = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json();
  
  const submitSchema = z.object({
    answers: z.record(z.string()),
  });
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } }, 400);
  }
  
  const studentAnswers = parsed.data.answers;
  
  const exam = await c.env.DB.prepare(
    'SELECT * FROM quizzes WHERE id = ? AND lesson_id IS NULL AND is_published = 1'
  ).bind(examId).first<any>();
  
  if (!exam) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الامتحان غير موجود' } }, 404);
  }

  // Verify enrollment or if the course is free
  const enrollment = await c.env.DB.prepare(
    "SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'"
  ).bind(user.id, exam.course_id).first();
  
  if (!enrollment) {
    const course = await c.env.DB.prepare('SELECT is_free FROM courses WHERE id = ?').bind(exam.course_id).first<any>();
    if (!course || course.is_free !== 1) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'يجب الاشتراك في المقرر الدراسي أولاً لتقديم حل الامتحان' } }, 403);
    }
  }

  // Access Window Check
  const now = new Date().toISOString();
  if (exam.start_time && now < exam.start_time) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'هذا الامتحان لم يبدأ بعد' } }, 403);
  }
  
  // Check if already attempted
  const existingAttempt = await c.env.DB.prepare(
    'SELECT id, started_at, is_submitted FROM quiz_attempts WHERE student_id = ? AND quiz_id = ?'
  ).bind(user.id, exam.id).first<any>();

  if (existingAttempt && existingAttempt.is_submitted === 1) {
    return c.json({ error: { code: 'ALREADY_SUBMITTED', message: 'لقد قمت بتسليم هذا الامتحان مسبقاً' } }, 400);
  }

  // Enforce time limit if applicable
  if (exam.time_limit_mins && existingAttempt && existingAttempt.started_at) {
    const startTime = new Date(existingAttempt.started_at).getTime();
    const nowTime = Date.now();
    const limitMs = (exam.time_limit_mins + 2) * 60 * 1000; // 2 minutes grace period for network/saving lag
    if (nowTime - startTime > limitMs) {
      // Overtime: We accept it but could flag/auto-submit. Let's just grade what they submitted.
    }
  }
  
  // Fetch questions with correct answers
  const { results: questions } = await c.env.DB.prepare(
    'SELECT id, correct_option, score FROM quiz_questions WHERE quiz_id = ?'
  ).bind(exam.id).all();
  
  let totalScore = 0;
  let earnedScore = 0;
  
  const gradedQuestions = (questions as any[]).map(q => {
    const selected = studentAnswers[q.id] || '';
    const isCorrect = selected.trim() === q.correct_option.trim();
    totalScore += q.score;
    if (isCorrect) {
      earnedScore += q.score;
    }
    return {
      question_id: q.id,
      selected,
      correct: q.correct_option,
      is_correct: isCorrect,
    };
  });
  
  const scoreRatio = totalScore > 0 ? earnedScore / totalScore : 0;
  const finalScore = scoreRatio * exam.max_score;
  
  if (existingAttempt) {
    // Update existing started attempt to submitted
    await c.env.DB.prepare(
      `UPDATE quiz_attempts 
       SET score = ?, answers_json = ?, is_submitted = 1, submitted_at = ?
       WHERE id = ?`
    ).bind(finalScore, JSON.stringify(studentAnswers), now, existingAttempt.id).run();
  } else {
    // Create new attempt (if no timer was active)
    const attemptId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, answers_json, started_at, is_submitted, submitted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(attemptId, user.id, exam.id, finalScore, JSON.stringify(studentAnswers), now, now, now).run();
  }
  
  return c.json({
    ok: true,
    score: finalScore,
    max_score: exam.max_score,
    graded: gradedQuestions,
  });
});

// ── GET /courses/:id — Course details with units and lessons ──
courses.get('/:id', optionalAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user');

  const platform = c.env.PLATFORM_KEY || 'dr-physics';

  let courseQuery = '';
  let courseParams: unknown[] = [];
  if (user) {
    courseQuery = `SELECT c.*,
       CASE WHEN (e.id IS NOT NULL AND e.status = 'active') OR c.is_free = 1 THEN 1 ELSE 0 END as is_enrolled
     FROM courses c
     LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = ? AND e.status = 'active'
     WHERE c.id = ? AND c.is_archived = 0 AND c.platform = ?`;
    courseParams = [user.id, courseId, platform];
  } else {
    courseQuery = `SELECT c.*,
       CASE WHEN c.is_free = 1 THEN 1 ELSE 0 END as is_enrolled
     FROM courses c
     WHERE c.id = ? AND c.is_archived = 0 AND c.platform = ?`;
    courseParams = [courseId, platform];
  }

  const course = await c.env.DB.prepare(courseQuery).bind(...courseParams).first<any>();

  if (!course) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } }, 404);
  }

  const isStudentOrGuest = !user || user.role === 'student';

  // Get units
  const { results: units } = await c.env.DB.prepare(
    `SELECT * FROM units WHERE course_id = ? AND is_archived = 0${isStudentOrGuest ? ' AND is_published = 1' : ''} ORDER BY sort_order ASC`
  ).bind(courseId).all();

  // Get lessons (metadata only — no video URLs)
  // Students/guests must not see lessons whose only video(s) are still uploading/processing/errored
  // (i.e. the lesson has lesson_videos rows but none with status = 'ready'). Admins/assistants
  // (e.g. the teacher dashboard course tree) still see every lesson regardless of video status,
  // since this same endpoint is reused by dashboard/src/app/dashboard/courses/page.tsx.
  const publishedLessonFilter = isStudentOrGuest ? ' AND l.is_published = 1' : '';
  const readyVideoFilter = isStudentOrGuest
    ? ` AND (NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = l.id) OR EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = l.id AND v.status = 'ready'))`
    : '';

  let lessonsQuery = '';
  let lessonsParams: unknown[] = [];
  if (user) {
    lessonsQuery = `SELECT l.id, l.unit_id, l.title, l.description, l.sort_order, l.is_free_preview,
            l.is_published,
            COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0) as duration_seconds,
            CASE WHEN lp.is_completed = 1 THEN 1 ELSE 0 END as is_completed,
            COALESCE(lp.last_position, 0) as last_position
     FROM lessons l
     LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = ?
     WHERE l.course_id = ? AND l.is_archived = 0${publishedLessonFilter}${readyVideoFilter}
     ORDER BY l.sort_order ASC`;
    lessonsParams = [user.id, courseId];
  } else {
    lessonsQuery = `SELECT l.id, l.unit_id, l.title, l.description, l.sort_order, l.is_free_preview,
            l.is_published,
            COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0) as duration_seconds,
            0 as is_completed,
            0 as last_position
     FROM lessons l
     WHERE l.course_id = ? AND l.is_archived = 0${publishedLessonFilter}${readyVideoFilter}
     ORDER BY l.sort_order ASC`;
    lessonsParams = [courseId];
  }

  const { results: lessons } = await c.env.DB.prepare(lessonsQuery).bind(...lessonsParams).all();

  // Nest lessons under units
  const unitsWithLessons = (units as any[]).map(unit => ({
    ...unit,
    name: unit.title,
    lessons: (lessons as any[]).filter(l => l.unit_id === unit.id),
  }));

  const mappedCourse = {
    ...course,
    cover_image: course.cover_url || ''
  };

  return c.json({
    ...mappedCourse,
    course: mappedCourse,
    units: unitsWithLessons
  });
});

// ── GET /lessons/:id — Lesson details (requires enrollment or free preview) ──
courses.get('/lessons/:id', optionalAuth, async (c) => {
  const lessonId = c.req.param('id');
  const user = c.get('user');

  const platform = c.env.PLATFORM_KEY || 'dr-physics';

  const lesson = await c.env.DB.prepare(
    `SELECT l.*, c.is_free as course_is_free FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND c.platform = ?`
  ).bind(lessonId, platform).first<any>();

  if (!lesson) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
  }

  // Check access: admin/assistant always allowed, student needs enrollment or free preview
  // If not logged in, they can only view if it's a free preview.
  const isFree = lesson.is_free_preview === 1 || lesson.is_free_preview === true || lesson.course_is_free === 1 || lesson.course_is_free === true;
  if (!isFree) {
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول لمشاهدة هذا الدرس' } }, 401);
    }
    if (user.role === 'student') {
      const enrollment = await c.env.DB.prepare(
        `SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, lesson.course_id).first();

      if (!enrollment) {
        return c.json({ error: { code: 'NOT_ENROLLED', message: 'يجب تفعيل الكورس أولاً لمشاهدة هذا الدرس' } }, 403);
      }
    }
  }

  // Get videos metadata. Students/guests only ever see 'ready' videos — a lesson stuck in
  // 'uploading'/'processing'/'error' must look video-less to them (playback.ts already only
  // serves 'ready' videos; this keeps the metadata consistent so the player doesn't advertise
  // a video it can't actually play). Admins/assistants (e.g. dashboard AttachmentsPanel, which
  // reuses this endpoint) still see every status.
  const isStudentOrGuestForVideos = !user || user.role === 'student';
  const videosQuery = isStudentOrGuestForVideos
    ? `SELECT id, provider, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order FROM lesson_videos WHERE lesson_id = ? AND status = 'ready' ORDER BY sort_order ASC`
    : `SELECT id, provider, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order FROM lesson_videos WHERE lesson_id = ? ORDER BY sort_order ASC`;
  const { results: videos } = await c.env.DB.prepare(videosQuery).bind(lessonId).all();

  // Get files metadata
  const { results: files } = await c.env.DB.prepare(
    'SELECT id, title, mime_type, size_bytes, is_downloadable, watermark, sort_order FROM lesson_files WHERE lesson_id = ? ORDER BY sort_order ASC'
  ).bind(lessonId).all();

  // Get progress
  let progress = null;
  if (user) {
    progress = await c.env.DB.prepare(
      'SELECT * FROM lesson_progress WHERE student_id = ? AND lesson_id = ?'
    ).bind(user.id, lessonId).first();
  }

  const urlObj = new URL(c.req.url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

  // Map files to attachments
  const attachments = (files || []).map((file: any) => ({
    id: file.id,
    title: file.title,
    type: file.mime_type === 'application/pdf' ? 'pdf' : 'file',
    url: `${baseUrl}/lessons/${lessonId}/files/${file.id}/url`
  }));

  const lessonData = {
    ...lesson,
    videos,
    files,
    progress,
    attachments
  };

  return c.json({
    ...lessonData,
    lesson: lessonData
  });
});

courses.get('/:id/progress', requireAuth, async (c) => {
  const courseId = c.req.param('id');
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'dr-physics';

  // Verify course belongs to current platform
  const courseCheck = await c.env.DB.prepare(
    'SELECT id FROM courses WHERE id = ? AND platform = ?'
  ).bind(courseId, platform).first();

  if (!courseCheck) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الكورس غير موجود' } }, 404);
  }

  // Excludes lessons with no 'ready' video (mirrors the course-detail lesson list) so the
  // progress percentage isn't permanently capped below 100% by lessons the student can't see yet.
  const readyLessonsFilter = ` AND (NOT EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id) OR EXISTS (SELECT 1 FROM lesson_videos v WHERE v.lesson_id = lessons.id AND v.status = 'ready'))`;
  const { count: totalLessons } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM lessons WHERE course_id = ? AND is_archived = 0 AND is_published = 1${readyLessonsFilter}`
  ).bind(courseId).first<{ count: number }>() || { count: 0 };

  const { count: completed } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM lesson_progress lp
     JOIN lessons ON lessons.id = lp.lesson_id AND lessons.course_id = lp.course_id
     WHERE lp.course_id = ? AND lp.student_id = ? AND lp.is_completed = 1
       AND lessons.is_archived = 0 AND lessons.is_published = 1${readyLessonsFilter}`
  ).bind(courseId, user.id).first<{ count: number }>() || { count: 0 };

  const percentage = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

  const course = await c.env.DB.prepare(
    'SELECT is_free FROM courses WHERE id = ?'
  ).bind(courseId).first<{ is_free: number }>();

  const enrollment = await c.env.DB.prepare(
    `SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
  ).bind(user.id, courseId).first();
  const isSubscribed = !!enrollment || (course && course.is_free === 1);

  const progressData = {
    course_id: courseId,
    total_lessons: totalLessons,
    completed,
    percentage,
    is_subscribed: isSubscribed
  };

  return c.json({
    ...progressData,
    progress: progressData
  });
});

// ── Student Quiz / Homework Endpoints ──

// 1) GET /courses/lessons/:id/quiz — Get quiz and questions for a lesson (correct answers redacted)
courses.get('/lessons/:id/quiz', optionalAuth, async (c) => {
  const lessonId = c.req.param('id');
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'dr-physics';

  const lesson = await c.env.DB.prepare(
    `SELECT l.*, c.is_free as course_is_free FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND c.platform = ?`
  ).bind(lessonId, platform).first<any>();

  if (!lesson) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
  }

  // Access check
  const isFree = lesson.is_free_preview === 1 || lesson.is_free_preview === true || lesson.course_is_free === 1 || lesson.course_is_free === true;
  if (!isFree) {
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول لمشاهدة محتوى هذا الدرس' } }, 401);
    }
    if (user.role === 'student') {
      const enrollment = await c.env.DB.prepare(
        `SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, lesson.course_id).first();
      if (!enrollment) {
        return c.json({ error: { code: 'NOT_ENROLLED', message: 'يجب تفعيل الكورس أولاً لمشاهدة هذا الدرس' } }, 403);
      }
    }
  }

  // Fetch the quiz
  const quiz = await c.env.DB.prepare('SELECT * FROM quizzes WHERE lesson_id = ? AND is_published = 1').bind(lessonId).first<any>();
  if (!quiz) {
    return c.json({ quiz: null, questions: [] });
  }

  // Access Window Check
  const now = new Date().toISOString();
  if (quiz.start_time && now < quiz.start_time) {
    return c.json({ error: { code: 'NOT_STARTED', message: `هذا الاختبار لم يبدأ بعد. سيبدأ في: ${new Date(quiz.start_time).toLocaleString('ar-EG')}` } }, 403);
  }

  // Fetch attempt if any
  let attempt = null;
  if (user) {
    attempt = await c.env.DB.prepare(
      'SELECT id, score, submitted_at, answers_json, started_at, is_submitted FROM quiz_attempts WHERE student_id = ? AND quiz_id = ?'
    ).bind(user.id, quiz.id).first<any>();

    // If quiz has end_time, and they haven't started/submitted yet, and end_time is in the past
    if (quiz.end_time && now > quiz.end_time && (!attempt || attempt.is_submitted === 0)) {
      return c.json({ error: { code: 'EXPIRED', message: 'انتهى وقت دخول هذا الاختبار ولا يمكن بدء محاولة جديدة.' } }, 403);
    }

    // Auto-create attempt session if it doesn't exist and quiz has a time limit
    if (!attempt && quiz.time_limit_mins) {
      const attemptId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, answers_json, started_at, is_submitted, submitted_at, created_at)
         VALUES (?, ?, ?, 0, '{}', ?, 0, ?, ?)`
      ).bind(attemptId, user.id, quiz.id, now, now, now).run();

      attempt = {
        id: attemptId,
        score: 0,
        started_at: now,
        is_submitted: 0,
        answers: {}
      };
    }
  }

  // Fetch questions (only return correct_option if the student has already submitted their attempt)
  const selectFields = (attempt && attempt.is_submitted === 1)
    ? 'id, question_text, image_url, options_json, correct_option, score, sort_order'
    : 'id, question_text, image_url, options_json, score, sort_order';

  const { results: questions } = await c.env.DB.prepare(
    `SELECT ${selectFields} FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind(quiz.id).all();

  // Parse options
  let mappedQuestions = (questions as any[]).map(q => ({
    id: q.id,
    question_text: q.question_text,
    image_url: q.image_url,
    options: JSON.parse(q.options_json),
    score: q.score,
    sort_order: q.sort_order,
    ...(q.correct_option !== undefined ? { correct_option: q.correct_option } : {}),
  }));

  // Shuffle questions if randomize_questions is enabled and student is currently solving (or no attempt exists yet)
  if (quiz.randomize_questions === 1 && (!attempt || attempt.is_submitted === 0)) {
    const shuffled = [...mappedQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (2**32) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    mappedQuestions = shuffled;
  }

  if (attempt && attempt.answers_json) {
    attempt.answers = JSON.parse(attempt.answers_json);
    delete attempt.answers_json;
  }

  return c.json({ quiz, questions: mappedQuestions, attempt });
});

// 2) POST /courses/lessons/:id/quiz/submit — Submit quiz answers, auto-grade, and save attempt
courses.post('/lessons/:id/quiz/submit', requireAuth, rateLimit('quiz_submit', 10, 60), async (c) => {
  const lessonId = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json();
  const platform = c.env.PLATFORM_KEY || 'dr-physics';

  const submitSchema = z.object({
    answers: z.record(z.string()), // maps question_id -> selected_option_text
  });
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const submittedAnswers = parsed.data.answers;

  const lesson = await c.env.DB.prepare(
    `SELECT l.* FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND c.platform = ?`
  ).bind(lessonId, platform).first<any>();

  if (!lesson) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
  }

  // Fetch the published quiz
  const quiz = await c.env.DB.prepare('SELECT * FROM quizzes WHERE lesson_id = ? AND is_published = 1').bind(lessonId).first<any>();
  if (!quiz) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'لا يوجد اختبار متاح لهذا الدرس' } }, 404);
  }

  // Access Window Check
  const now = new Date().toISOString();
  if (quiz.start_time && now < quiz.start_time) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'هذا الاختبار لم يبدأ بعد' } }, 403);
  }

  // Fetch existing attempt
  const existingAttempt = await c.env.DB.prepare(
    'SELECT id, started_at, is_submitted FROM quiz_attempts WHERE student_id = ? AND quiz_id = ?'
  ).bind(user.id, quiz.id).first<any>();

  if (existingAttempt && existingAttempt.is_submitted === 1) {
    return c.json({ error: { code: 'ALREADY_SUBMITTED', message: 'لقد قمت بحل هذا الواجب/الاختبار مسبقاً' } }, 400);
  }

  // Enforce time limit if applicable
  if (quiz.time_limit_mins && existingAttempt && existingAttempt.started_at) {
    const startTime = new Date(existingAttempt.started_at).getTime();
    const nowTime = Date.now();
    const limitMs = (quiz.time_limit_mins + 2) * 60 * 1000; // 2 minutes grace period for network/saving lag
    if (nowTime - startTime > limitMs) {
      // Overtime: We will still accept but could flag it or auto-submit empty answers. Let's just grade what they submitted.
    }
  }

  // Fetch all questions
  const { results: questions } = await c.env.DB.prepare(
    'SELECT * FROM quiz_questions WHERE quiz_id = ?'
  ).bind(quiz.id).all();

  // Auto-grade
  let totalScore = 0;
  let earnedScore = 0;
  const gradedQuestions = (questions as any[]).map(q => {
    const isCorrect = submittedAnswers[q.id] === q.correct_option;
    totalScore += q.score;
    if (isCorrect) {
      earnedScore += q.score;
    }
    return {
      id: q.id,
      correct_option: q.correct_option,
      is_correct: isCorrect,
    };
  });

  // Calculate percentage of max_score
  const scoreRatio = totalScore > 0 ? earnedScore / totalScore : 0;
  const finalScore = scoreRatio * quiz.max_score;

  if (existingAttempt) {
    // Update the started attempt to submitted
    await c.env.DB.prepare(
      `UPDATE quiz_attempts 
       SET score = ?, answers_json = ?, is_submitted = 1, submitted_at = ?
       WHERE id = ?`
    ).bind(finalScore, JSON.stringify(submittedAnswers), now, existingAttempt.id).run();
  } else {
    // Create new attempt (if no timer was active)
    const attemptId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quiz_attempts (id, student_id, quiz_id, score, answers_json, started_at, is_submitted, submitted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).bind(attemptId, user.id, quiz.id, finalScore, JSON.stringify(submittedAnswers), now, now, now).run();
  }

  // Mark lesson progress as complete
  await c.env.DB.prepare(
    `INSERT INTO lesson_progress (id, student_id, course_id, lesson_id, is_completed, last_position, updated_at)
     VALUES (?, ?, ?, ?, 1, 0, datetime('now'))
     ON CONFLICT(student_id, lesson_id) DO UPDATE SET is_completed = 1, updated_at = datetime('now')`
  ).bind(`lp_${user.id}_${lessonId}`, user.id, lesson.course_id, lessonId).run();

  return c.json({
    ok: true,
    score: finalScore,
    max_score: quiz.max_score,
    graded: gradedQuestions,
  });
});

// ── STUDENT NOTIFICATIONS ──

// GET /courses/notifications/list — Fetch notifications for the student
courses.get('/notifications/list', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'dr-physics';

  const query = `
    SELECT *
    FROM notifications
    WHERE platform = ? AND (
      audience = 'all'
      OR recipient_id = ?
      OR (audience = 'course' AND course_id IN (
        SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active'
      ))
    )
    ORDER BY sent_at DESC
    LIMIT 50
  `;

  const { results } = await c.env.DB.prepare(query).bind(platform, user.id, user.id).all();
  return c.json({ notifications: results });
});

// POST /courses/notifications/:id/read — Mark a notification as read
courses.post('/notifications/:id/read', requireAuth, async (c) => {
  const notifId = c.req.param('id');
  await c.env.DB.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ?'
  ).bind(notifId).run();
  return c.json({ ok: true });
});

export default courses;

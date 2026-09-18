/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import type { DatabaseSync as SQLiteDatabase, SQLInputValue } from 'node:sqlite';
import { Hono } from 'hono';
import type { Env, HonoBindings } from '../types';
import courses from './courses';
import bundles from './bundles';
import news from './news';
import purchases from './purchases';
import examBuilds from './examBuilds';
import mistakes from './mistakes';
import points from './points';
import wallets from './wallets';
import challenges from './challenges';
import conversations from './conversations';
import config from './config';

// Vitest 1 / Vite 5 predate node:sqlite; load the built-in without Vite resolution.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const platform = 'fusha';

// نفس ترتيب التركيب في src/index.ts حتى تُحلّ المسارات بنفس الشكل.
const app = new Hono<HonoBindings>()
  .route('/courses', courses)
  .route('/', bundles)
  .route('/', news)
  .route('/', purchases)
  .route('/', examBuilds)
  .route('/', mistakes)
  .route('/', points)
  .route('/', wallets)
  .route('/', challenges)
  .route('/', conversations)
  .route('/', config);

// المخطط الحقيقي + الهجرات الإضافية ذات الصلة (بدون إعادة بناء الجداول في 0009).
const schema = [
  '0000_init.sql',
  '0001_student_tracking_and_quizzes.sql',
  '0005_platform_isolation.sql',
  '0007_quizzes_questions_and_answers.sql',
  '0008_quiz_advanced_settings.sql',
  '0010_complete_platform_isolation.sql',
  '0011_add_branch_field.sql',
  '0012_add_quiz_is_free.sql',
  '0013_add_quiz_cover_image.sql',
  '0018_question_bank.sql',
  '0023_legacy_features.sql',
  '0024_challenges_conversations.sql',
].map(name => readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'));

let sqlite: SQLiteDatabase;
let env: Env;
const kv = new Map<string, string>();
const network = vi.fn(async () => { throw new Error('Network access is forbidden in legacy-feature tests'); });

function run(sql: string, ...values: SQLInputValue[]) {
  sqlite.prepare(sql).run(...values);
}

function scalar(sql: string, ...values: SQLInputValue[]) {
  return sqlite.prepare(sql).get(...values) as any;
}

/** يبني محوّل D1 مصغّر: كل SQL والارتباطات تُنفَّذ فعلياً في SQLite. */
function createDb(): any {
  const prepare = (sql: string) => {
    const statement = sqlite.prepare(sql);
    let values: SQLInputValue[] = [];
    const api = {
      bind(...params: SQLInputValue[]) { values = params; return api; },
      async first() { return statement.get(...values) ?? null; },
      async all() { return { success: true, results: statement.all(...values) }; },
      async run() {
        const result = statement.run(...values);
        return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
      },
    };
    return api;
  };

  return {
    prepare,
    async batch(statements: any[]) {
      const out = [];
      for (const statement of statements) out.push(await statement.run());
      return out;
    },
  };
}

function request(path: string, init: RequestInit = {}, token: string | null = null) {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.method && init.method !== 'GET') headers.set('Content-Type', 'application/json');
  return app.request(path, { ...init, headers }, env);
}

function post(path: string, body: unknown, token: string | null = null) {
  return request(path, { method: 'POST', body: JSON.stringify(body) }, token);
}

function patch(path: string, body: unknown, token: string | null = null) {
  return request(path, { method: 'PATCH', body: JSON.stringify(body) }, token);
}

function addProfile(id: string, role: string, tenant = platform, studentCode: string | null = null) {
  run(`INSERT INTO profiles (id, supabase_user_id, email, role, full_name, status, platform, last_seen_at, student_code)
       VALUES (?, ?, ?, ?, ?, 'active', ?, datetime('now'), ?)`,
    id, id, `${id}@example.invalid`, role, id, tenant, studentCode);
}

function addCourse(id: string, options: { free?: number; price?: number; tenant?: string; published?: number } = {}) {
  run(`INSERT INTO courses (id, title, slug, cover_url, is_free, is_published, is_archived, platform, price, sort_order)
       VALUES (?, ?, ?, '/cover.png', ?, ?, 0, ?, ?, 0)`,
    id, `كورس ${id}`, id, options.free ?? 0, options.published ?? 1, options.tenant ?? platform, options.price ?? 0);
}

function addExam(id: string, courseId: string, options: {
  free?: number; price?: number; custom?: number; maxScore?: number;
} = {}) {
  run(`INSERT INTO quizzes (id, course_id, lesson_id, title, max_score, is_published, is_free, price, is_custom, sort_order)
       VALUES (?, ?, NULL, ?, ?, 1, ?, ?, ?, 0)`,
    id, courseId, `امتحان ${id}`, options.maxScore ?? 10, options.free ?? 0,
    options.price ?? 0, options.custom ?? 0);
}

function addQuestion(id: string, quizId: string, options: {
  text: string; choices: string[]; correct: string; explanation?: string | null; score?: number;
}) {
  run(`INSERT INTO quiz_questions (id, quiz_id, question_text, options_json, correct_option, explanation, score, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    id, quizId, options.text, JSON.stringify(options.choices), options.correct,
    options.explanation ?? null, options.score ?? 5);
}

beforeEach(() => {
  network.mockClear();
  vi.stubGlobal('fetch', network);
  sqlite = new DatabaseSync(':memory:');
  for (const migration of schema) sqlite.exec(migration);
  kv.clear();

  // المصادقة في هذه الاختبارات عبر توكنات opaque مسجّلة في KV (نفس نهج بقية الاختبارات).
  addProfile('student', 'student', platform, 'FSH-AAAA-1111');
  addProfile('other-student', 'student');
  addProfile('admin', 'admin');
  addProfile('foreign-admin', 'admin', 'other-platform');
  kv.set('playback_token:tok-student', JSON.stringify({ userId: 'student', scope: 'auth' }));
  kv.set('playback_token:tok-other', JSON.stringify({ userId: 'other-student', scope: 'auth' }));
  kv.set('playback_token:tok-admin', JSON.stringify({ userId: 'admin', scope: 'auth' }));
  kv.set('playback_token:tok-foreign-admin', JSON.stringify({ userId: 'foreign-admin', scope: 'auth' }));

  env = {
    PLATFORM_KEY: platform,
    KV: {
      get: async (key: string) => kv.get(key) ?? null,
      put: async (key: string, value: string) => { kv.set(key, value); },
    },
    DB: createDb(),
  } as unknown as Env;

  addCourse('paid-course', { price: 100 });
  addCourse('free-course', { free: 1 });
  addExam('locked-exam', 'paid-course', { price: 50 });
  addQuestion('q-wrong', 'locked-exam', {
    text: 'ما إعراب الفاعل؟',
    choices: ['منصوب', 'مرفوع بالضمة'],
    correct: 'مرفوع بالضمة',
    explanation: 'الفاعل مرفوع بالضمة',
  });
  addQuestion('q-correct', 'locked-exam', {
    text: 'ما نوع الفعل «كتب»؟',
    choices: ['ماضٍ', 'مضارع'],
    correct: 'ماضٍ',
    explanation: 'يدل على زمن مضى',
  });
  addExam('free-exam', 'free-course', { free: 1 });
  addQuestion('q-free', 'free-exam', {
    text: 'مرادف «سعيد»؟',
    choices: ['مسرور', 'حزين'],
    correct: 'مسرور',
  });
});

afterEach(() => {
  sqlite?.close();
  vi.unstubAllGlobals();
  expect(network).not.toHaveBeenCalled();
});

// ════════════════════════════════════════════════════════════
// 1) سبب الإجابة الصحيحة + 4) منع غير المعتمد
// ════════════════════════════════════════════════════════════
describe('سبب الإجابة الصحيحة وحالات الوصول', () => {
  it('يمنع فتح امتحان مدفوع لغير المشترك بـ 403 EXAM_LOCKED', async () => {
    const response = await request('/courses/exams/locked-exam', {}, 'tok-student');
    expect(response.status).toBe(403);
    const body = await response.json() as any;
    expect(body.error.code).toBe('EXAM_LOCKED');
    expect(body.error.access_state).toBe('locked');
    expect(body.error.price).toBe(50);
  });

  it('يمنع تسليم امتحان مدفوع لغير المشترك بـ 403 EXAM_LOCKED', async () => {
    const response = await post('/courses/exams/locked-exam/submit', { answers: { 'q-wrong': 'منصوب' } }, 'tok-student');
    expect(response.status).toBe(403);
    expect((await response.json() as any).error.code).toBe('EXAM_LOCKED');
    // لا يجب تسجيل أي خطأ ولا أي محاولة عند الرفض
    expect(scalar('SELECT COUNT(*) AS c FROM student_mistakes').c).toBe(0);
    expect(scalar('SELECT COUNT(*) AS c FROM quiz_attempts').c).toBe(0);
  });

  it('يُرجع 403 PURCHASE_PENDING عندما يكون الطلب قيد المراجعة', async () => {
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, exam_id, amount, transfer_image_url, status)
         VALUES ('pr-pending', ?, 'student', 'exam', 'locked-exam', 50, '/t.png', 'pending')`, platform);

    const open = await request('/courses/exams/locked-exam', {}, 'tok-student');
    expect(open.status).toBe(403);
    expect((await open.json() as any).error.code).toBe('PURCHASE_PENDING');

    const submit = await post('/courses/exams/locked-exam/submit', { answers: { 'q-wrong': 'منصوب' } }, 'tok-student');
    expect(submit.status).toBe(403);
    expect((await submit.json() as any).error.code).toBe('PURCHASE_PENDING');
  });

  it('يسمح بالوصول بعد الموافقة على طلب الشراء', async () => {
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, exam_id, amount, transfer_image_url, status)
         VALUES ('pr-approved', ?, 'student', 'exam', 'locked-exam', 50, '/t.png', 'approved')`, platform);

    const open = await request('/courses/exams/locked-exam', {}, 'tok-student');
    expect(open.status).toBe(200);
  });

  it('يعرض حالة الوصول والتسميات في قائمة الامتحانات', async () => {
    const response = await request('/courses/exams', {}, 'tok-student');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.currency).toBe('جنيه');

    const locked = body.exams.find((e: any) => e.id === 'locked-exam');
    expect(locked).toMatchObject({
      access_state: 'locked',
      access_label: 'مقفل',
      can_access: false,
      action_label: 'شراء الامتحان (50 جنيه)',
      category_label: 'مدفوع',
    });

    const free = body.exams.find((e: any) => e.id === 'free-exam');
    expect(free).toMatchObject({ access_state: 'free', can_access: true, action_label: 'حل الامتحان', category_label: 'مجاني' });
  });

  it('يُرجع سبب الإجابة الصحيحة للأسئلة الخطأ فقط بالنص الحرفي', async () => {
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, exam_id, amount, transfer_image_url, status)
         VALUES ('pr-approved', ?, 'student', 'exam', 'locked-exam', 50, '/t.png', 'approved')`, platform);

    const response = await post('/courses/exams/locked-exam/submit', {
      answers: { 'q-wrong': 'منصوب', 'q-correct': 'ماضٍ' },
    }, 'tok-student');

    expect(response.status).toBe(200);
    const body = await response.json() as any;

    const wrong = body.graded.find((g: any) => g.question_id === 'q-wrong');
    expect(wrong.is_correct).toBe(false);
    expect(wrong.correct_option_text).toBe('مرفوع بالضمة');
    expect(wrong.explanation).toBe('الفاعل مرفوع بالضمة');
    expect(wrong.correct_answer_reason).toBe('الإجابة الصحيحة هي «مرفوع بالضمة» لأن الفاعل مرفوع بالضمة');

    const correct = body.graded.find((g: any) => g.question_id === 'q-correct');
    expect(correct.is_correct).toBe(true);
    expect(correct).not.toHaveProperty('correct_option_text');
    expect(correct).not.toHaveProperty('explanation');
    expect(correct).not.toHaveProperty('correct_answer_reason');
  });

  it('يسمح بتسليم الامتحان المجاني دون اشتراك', async () => {
    const response = await post('/courses/exams/free-exam/submit', { answers: { 'q-free': 'مسرور' } }, 'tok-other');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.graded[0].is_correct).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
// 6) كتاب الأخطاء — تسجيل تلقائي
// ════════════════════════════════════════════════════════════
describe('كتاب الأخطاء', () => {
  beforeEach(() => {
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, exam_id, amount, transfer_image_url, status)
         VALUES ('pr-approved', ?, 'student', 'exam', 'locked-exam', 50, '/t.png', 'approved')`, platform);
  });

  it('يسجّل الخطأ تلقائياً عند الإجابة الخطأ فقط', async () => {
    await post('/courses/exams/locked-exam/submit', {
      answers: { 'q-wrong': 'منصوب', 'q-correct': 'ماضٍ' },
    }, 'tok-student');

    const rows = sqlite.prepare('SELECT * FROM student_mistakes').all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      student_id: 'student',
      question_id: 'q-wrong',
      question_source: 'quiz',
      quiz_id: 'locked-exam',
      given_answer: 'منصوب',
      correct_answer: 'مرفوع بالضمة',
      points_lost: 5,
      is_resolved: 0,
      platform,
    });
  });

  it('لا يُكرّر السطر عند إعادة الخطأ بل يُحدّثه ويُعيده غير محلول', async () => {
    const answers = { 'q-wrong': 'منصوب', 'q-correct': 'ماضٍ' };
    await post('/courses/exams/locked-exam/submit', { answers }, 'tok-student');
    run("UPDATE student_mistakes SET is_resolved = 1, resolved_at = datetime('now') WHERE question_id = 'q-wrong'");

    // محاولة جديدة: نُصفّر المحاولة السابقة ليسمح الخادم بالتسليم مرة أخرى
    run("DELETE FROM quiz_attempts WHERE student_id = 'student'");
    await post('/courses/exams/locked-exam/submit', { answers }, 'tok-student');

    const rows = sqlite.prepare('SELECT * FROM student_mistakes').all() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].is_resolved).toBe(0);
    expect(rows[0].resolved_at).toBeNull();
  });

  it('يعرض القائمة والإحصائيات بالنص الحرفي', async () => {
    await post('/courses/exams/locked-exam/submit', {
      answers: { 'q-wrong': 'منصوب', 'q-correct': 'ماضٍ' },
    }, 'tok-student');

    const response = await request('/me/mistakes', {}, 'tok-student');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.stats.total_mistakes).toBe(1);
    expect(body.stats.header).toBe('1 خطأ تم تسجيله');
    expect(body.stats.points_lost_label).toBe('5 نقطة');
    expect(body.labels.title).toBe('الأخطاء');
    expect(body.labels.correct_answer).toBe('الإجابة الصحيحة');
  });

  it('لا يُسرّب أخطاء طالب آخر', async () => {
    await post('/courses/exams/locked-exam/submit', { answers: { 'q-wrong': 'منصوب' } }, 'tok-student');
    const response = await request('/me/mistakes', {}, 'tok-other');
    expect(response.status).toBe(200);
    expect((await response.json() as any).stats.total_mistakes).toBe(0);
  });

  it('يعلّم الخطأ كمحلول ويحذفه', async () => {
    await post('/courses/exams/locked-exam/submit', {
      answers: { 'q-wrong': 'منصوب', 'q-correct': 'ماضٍ' },
    }, 'tok-student');
    const id = (scalar("SELECT id FROM student_mistakes WHERE question_id = 'q-wrong'")).id;

    const resolve = await patch(`/me/mistakes/${id}/resolve`, { is_resolved: true }, 'tok-student');
    expect(resolve.status).toBe(200);
    expect((await resolve.json() as any).mistake.is_resolved).toBe(1);

    const remove = await request(`/me/mistakes/${id}`, { method: 'DELETE' }, 'tok-student');
    expect(remove.status).toBe(200);
    expect(scalar('SELECT COUNT(*) AS c FROM student_mistakes').c).toBe(0);
  });

  it('يمنع طالباً آخر من حذف خطأ ليس له', async () => {
    await post('/courses/exams/locked-exam/submit', { answers: { 'q-wrong': 'منصوب' } }, 'tok-student');
    const id = (scalar("SELECT id FROM student_mistakes WHERE question_id = 'q-wrong'")).id;
    const response = await request(`/me/mistakes/${id}`, { method: 'DELETE' }, 'tok-other');
    expect(response.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════
// 8) النقاط والمستوى
// ════════════════════════════════════════════════════════════
describe('النقاط والمستوى', () => {
  it('يمنح نقاطاً عند إتمام الامتحان ويحدّث المستوى', async () => {
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, exam_id, amount, transfer_image_url, status)
         VALUES ('pr-approved', ?, 'student', 'exam', 'locked-exam', 50, '/t.png', 'approved')`, platform);

    const response = await post('/courses/exams/locked-exam/submit', { answers: { 'q-wrong': 'منصوب' } }, 'tok-student');
    const body = await response.json() as any;
    expect(body.points).toMatchObject({ awarded: 10, total_points: 10, level: 1, level_up: false });

    const profile = scalar("SELECT points, level FROM profiles WHERE id = 'student'");
    expect(profile).toMatchObject({ points: 10, level: 1 });

    const ledger = scalar("SELECT * FROM points_ledger WHERE student_id = 'student'");
    expect(ledger).toMatchObject({ points: 10, reason: 'exam_completed', platform });
  });

  it('يعرض GET /me/points بالنص الحرفي', async () => {
    run("UPDATE profiles SET points = 150, level = 2 WHERE id = 'student'");
    run(`INSERT INTO points_ledger (id, platform, student_id, points, reason, note)
         VALUES ('pl-1', ?, 'student', 150, 'admin', 'منحة')`, platform);

    const response = await request('/me/points', {}, 'tok-student');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.level).toBe(2);
    expect(body.total_points).toBe(150);
    expect(body.points_to_next_level).toBe(50);
    expect(body.labels.level).toBe('المستوى {n}');
    expect(body.labels.total_points).toBe('إجمالي النقاط');
    expect(body.history[0].reason_label).toBe('من الإدارة');
  });

  it('يرفض مسارات النقاط الإدارية بلا توكن', async () => {
    const response = await request('/admin/students/student/points');
    expect(response.status).toBe(401);
  });

  it('يمنح المدير نقاطاً يدوياً', async () => {
    const response = await post('/admin/students/student/points', { points: 250, note: 'تفوق' }, 'tok-admin');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body).toMatchObject({ total_points: 250, level: 3, awarded: 250, level_up: true });
  });
});

// ════════════════════════════════════════════════════════════
// 5) طلب امتحان مخصص
// ════════════════════════════════════════════════════════════
describe('طلب امتحان مخصص', () => {
  it('يعرض خريطة الأسعار الحرفية ٥→١٠ · ١٠→١٥ · ١٥→٢٠ · ٢٠→٢٥', async () => {
    const response = await request('/exam-builds/options', {}, 'tok-student');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.currency).toBe('جنيه');
    expect(body.question_count_options.map((o: any) => [o.question_count, o.price]))
      .toEqual([[5, 10], [10, 15], [15, 20], [20, 25]]);
    expect(body.labels.form_price).toBe('السعر الإجمالي: {n} جنيه');
    expect(body.labels.entry_button).toBe('أنشئ امتحانك');
  });

  it('يرفض إنشاء طلب بعدد أسئلة غير مدعوم', async () => {
    const response = await post('/exam-builds', {
      title: 'امتحان تجريبي',
      duration_minutes: 30,
      question_count: 7,
      transfer_image_url: '/t.png',
    }, 'tok-student');
    expect(response.status).toBe(400);
    expect((await response.json() as any).error.code).toBe('VALIDATION_ERROR');
  });

  it('يرفض الطلب عند عدم كفاية الأسئلة في البنك', async () => {
    const response = await post('/exam-builds', {
      title: 'امتحان تجريبي',
      duration_minutes: 30,
      question_count: 5,
      transfer_image_url: '/t.png',
    }, 'tok-student');
    expect(response.status).toBe(400);
    expect((await response.json() as any).error.code).toBe('NOT_ENOUGH_QUESTIONS');
  });

  it('يُنشئ الطلب بالسعر الصحيح ويولّد امتحاناً عند الموافقة', async () => {
    for (let i = 0; i < 5; i++) {
      run(`INSERT INTO question_bank (id, platform, course_id, type, question_text, options_json, correct_answer_json, points)
           VALUES (?, ?, 'paid-course', 'mcq', ?, ?, ?, 2)`,
        `bank-${i}`, platform, `سؤال ${i}`, JSON.stringify(['أ', 'ب']), JSON.stringify({ option_index: 1 }));
    }

    const create = await post('/exam-builds', {
      title: 'امتحان النحو',
      duration_minutes: 30,
      question_count: 5,
      section_ids: ['paid-course'],
      transfer_image_url: '/t.png',
    }, 'tok-student');
    expect(create.status).toBe(201);
    const created = await create.json() as any;
    expect(created.exam_build_request.price).toBe(10);
    expect(created.success_title).toBe('تمام! طلبك جاهز وقيد التنفيذ ✅');

    const id = created.exam_build_request.id;
    const approve = await post(`/admin/exam-build-requests/${id}/approve`, {}, 'tok-admin');
    expect(approve.status).toBe(200);
    const approved = await approve.json() as any;
    expect(approved.generated_questions).toBe(5);

    const quiz = scalar('SELECT * FROM quizzes WHERE id = ?', approved.generated_quiz_id);
    expect(quiz).toMatchObject({ is_custom: 1, price: 10, title: 'امتحان النحو' });

    // الأسئلة المولّدة تُخزَّن كنص الخيار الصحيح (لا حرفه) ليعمل التصحيح النصي
    const generated = sqlite.prepare('SELECT correct_option FROM quiz_questions WHERE quiz_id = ?').all(approved.generated_quiz_id) as any[];
    expect(generated).toHaveLength(5);
    expect(generated.every(g => g.correct_option === 'ب')).toBe(true);

    // الطالب يملك وصولاً فورياً لامتحانه عبر طلب شراء معتمد
    const access = scalar("SELECT status FROM purchase_requests WHERE exam_id = ? AND student_id = 'student'", approved.generated_quiz_id);
    expect(access.status).toBe('approved');

    const financial = scalar("SELECT * FROM financial_transactions WHERE student_id = 'student'");
    expect(financial).toMatchObject({ amount: 10, transaction_type: 'online_payment' });
  });
});

// ════════════════════════════════════════════════════════════
// 4) المشتريات + موافقة الإدارة
// ════════════════════════════════════════════════════════════
describe('المشتريات وموافقة الإدارة', () => {
  it('يحسب السعر على الخادم ويتجاهل أي سعر من العميل', async () => {
    const response = await post('/purchases', {
      target_type: 'exam',
      exam_id: 'locked-exam',
      transfer_image_url: '/t.png',
      amount: 1,
    }, 'tok-student');

    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.purchase_request.amount).toBe(50);
    expect(body.purchase_request.status).toBe('pending');
  });

  it('يمنع تكرار الطلب بنفس الهدف', async () => {
    await post('/purchases', { target_type: 'exam', exam_id: 'locked-exam', transfer_image_url: '/t.png' }, 'tok-student');
    const again = await post('/purchases', { target_type: 'exam', exam_id: 'locked-exam', transfer_image_url: '/t.png' }, 'tok-student');
    expect(again.status).toBe(409);
    expect((await again.json() as any).error.code).toBe('ALREADY_PENDING');
  });

  it('لا يسمح بشراء امتحان من منصة أخرى', async () => {
    run(`INSERT INTO courses (id, title, slug, is_free, is_published, is_archived, platform, price)
         VALUES ('foreign-course', 'خارجي', 'foreign', 0, 1, 0, 'other-platform', 0)`);
    run(`INSERT INTO quizzes (id, course_id, lesson_id, title, max_score, is_published, is_free, price, is_custom, sort_order)
         VALUES ('foreign-exam', 'foreign-course', NULL, 'خارجي', 10, 1, 0, 30, 0, 0)`);

    const response = await post('/purchases', {
      target_type: 'exam', exam_id: 'foreign-exam', transfer_image_url: '/t.png',
    }, 'tok-student');
    expect(response.status).toBe(404);
  });

  it('عند الموافقة يُنشئ اشتراكاً وسطراً مالياً', async () => {
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, course_id, amount, transfer_image_url, status)
         VALUES ('pr-course', ?, 'student', 'course', 'paid-course', 100, '/t.png', 'pending')`, platform);

    const response = await post('/admin/purchase-requests/pr-course/approve', {}, 'tok-admin');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.enrolled_courses).toBe(1);

    const enrollment = scalar("SELECT * FROM enrollments WHERE student_id = 'student' AND course_id = 'paid-course'");
    expect(enrollment).toMatchObject({ status: 'active', source: 'manual', platform });

    const financial = scalar("SELECT * FROM financial_transactions WHERE student_id = 'student'");
    expect(financial).toMatchObject({ amount: 100, transaction_type: 'online_payment', course_id: 'paid-course' });
    expect(financial.note).toBe('شراء مقرر: كورس paid-course');

    // بعد الموافقة يفتح الوصول للامتحان التابع للمقرر
    const open = await request('/courses/exams/locked-exam', {}, 'tok-student');
    expect(open.status).toBe(200);
  });

  it('يرفض الموافقة على طلب تمت مراجعته مسبقاً', async () => {
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, course_id, amount, transfer_image_url, status)
         VALUES ('pr-course', ?, 'student', 'course', 'paid-course', 100, '/t.png', 'approved')`, platform);
    const response = await post('/admin/purchase-requests/pr-course/approve', {}, 'tok-admin');
    expect(response.status).toBe(400);
    expect((await response.json() as any).error.code).toBe('ALREADY_REVIEWED');
  });

  it('لا يسمح للمدير من منصة أخرى بمراجعة الطلب', async () => {
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, course_id, amount, transfer_image_url, status)
         VALUES ('pr-course', ?, 'student', 'course', 'paid-course', 100, '/t.png', 'pending')`, platform);
    const response = await post('/admin/purchase-requests/pr-course/approve', {}, 'tok-foreign-admin');
    expect(response.status).toBe(403);
  });

  it('يعرض المشتريات بالنص الحرفي ويرفض الوصول بلا توكن', async () => {
    await post('/purchases', { target_type: 'exam', exam_id: 'locked-exam', transfer_image_url: '/t.png' }, 'tok-student');

    const list = await request('/purchases', {}, 'tok-student');
    expect(list.status).toBe(200);
    const body = await list.json() as any;
    expect(body.currency).toBe('جنيه');
    expect(body.purchases[0].status_label).toBe('قيد المراجعة');
    expect(body.purchases[0].target_title).toBe('امتحان locked-exam');

    const anonymous = await request('/purchases');
    expect(anonymous.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
// 2) حزم الكورسات
// ════════════════════════════════════════════════════════════
describe('حزم الكورسات', () => {
  beforeEach(() => {
    run(`INSERT INTO bundles (id, title, description, cover_url, reference_price, is_published, platform, price, is_price_hidden, features_json, sort_order)
         VALUES ('bundle-1', 'باقة النحو', 'شرح وافٍ', '/b.png', 200, 1, ?, 150, 0, '["شرح","امتحانات"]', 0)`, platform);
    run("INSERT INTO bundle_courses (bundle_id, course_id, platform) VALUES ('bundle-1', 'paid-course', ?)", platform);
    run(`INSERT INTO bundles (id, title, is_published, platform, price, sort_order)
         VALUES ('bundle-draft', 'مسودة', 0, ?, 0, 1)`, platform);
  });

  it('يعرض الباقات المنشورة مع كورساتها والتسميات', async () => {
    const response = await request('/bundles');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.bundles.map((b: any) => b.id)).toEqual(['bundle-1']);
    expect(body.bundles[0]).toMatchObject({
      title: 'باقة النحو',
      price: 150,
      features: ['شرح', 'امتحانات'],
      course_count: 1,
      is_current: false,
      action_label: 'ترقية',
    });
    expect(body.bundles[0].courses).toEqual([{ id: 'paid-course', title: 'كورس paid-course' }]);
    expect(body.labels.title).toBe('الباقات والخطط');
    expect(body.labels.current_badge).toBe('الحالية');
  });

  it('يعلّم الباقة الحالية عند اشتراك الطالب في كل كورساتها', async () => {
    run(`INSERT INTO enrollments (id, student_id, course_id, status, platform)
         VALUES ('e1', 'student', 'paid-course', 'active', ?)`, platform);
    const body = await (await request('/bundles', {}, 'tok-student')).json() as any;
    expect(body.bundles[0].is_current).toBe(true);
    expect(body.bundles[0].status_label).toBe('الحالية');
  });

  it('يخفي السعر ويستبدل زر الترقية بزر التغيير عند إخفاء السعر', async () => {
    run("UPDATE bundles SET is_price_hidden = 1 WHERE id = 'bundle-1'");
    const body = await (await request('/bundles')).json() as any;
    expect(body.bundles[0].is_price_hidden).toBe(true);
    expect(body.bundles[0].action_label).toBe('تغيير');
  });

  it('يرفض مسارات إدارة الباقات بلا توكن', async () => {
    expect((await request('/admin/bundles')).status).toBe(401);
  });

  it('يسمح للمدير بإنشاء باقة وربط كورسات بها', async () => {
    const create = await post('/admin/bundles', {
      title: 'باقة جديدة',
      price: 300,
      features: ['ميزة'],
      is_published: true,
      course_ids: ['paid-course'],
    }, 'tok-admin');
    expect(create.status).toBe(201);
    const created = await create.json() as any;
    expect(created.bundle.platform).toBe(platform);

    const link = sqlite.prepare('SELECT course_id FROM bundle_courses WHERE bundle_id = ?').all(created.bundle.id) as any[];
    expect(link.map(l => l.course_id)).toEqual(['paid-course']);
  });
});

// ════════════════════════════════════════════════════════════
// 3) الأخبار
// ════════════════════════════════════════════════════════════
describe('الأخبار', () => {
  it('يعرض المنشور فقط مرتباً', async () => {
    run(`INSERT INTO news (id, platform, title, body, is_published, sort_order) VALUES
         ('n2', ?, 'ثاني خبر', 'نص', 1, 2),
         ('n1', ?, 'أول خبر', 'نص', 1, 1),
         ('n3', ?, 'مسودة', 'نص', 0, 0)`, platform, platform, platform);

    const response = await request('/news');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.news.map((n: any) => n.id)).toEqual(['n1', 'n2']);
  });

  it('لا يُسرّب أخبار منصة أخرى', async () => {
    run(`INSERT INTO news (id, platform, title, is_published, sort_order) VALUES ('nx', 'other-platform', 'خارجي', 1, 0)`);
    const body = await (await request('/news')).json() as any;
    expect(body.news).toHaveLength(0);
  });

  it('يمنع إدارة الأخبار بلا توكن', async () => {
    expect((await request('/admin/news')).status).toBe(401);
  });

  it('يسمح للمدير بإنشاء خبر', async () => {
    const response = await post('/admin/news', { title: 'خبر جديد', body: 'نص', is_published: true }, 'tok-admin');
    expect(response.status).toBe(201);
    expect((await response.json() as any).news.title).toBe('خبر جديد');
  });
});

// ════════════════════════════════════════════════════════════
// 7) الأخطاء الشائعة
// ════════════════════════════════════════════════════════════
describe('الأخطاء الشائعة', () => {
  beforeEach(() => {
    run(`INSERT INTO common_mistakes (id, platform, subject, title, content, sort_order, is_published) VALUES
         ('cm1', ?, 'النحو', 'التمييز بين الفاعل والمفعول', 'شرح', 1, 1),
         ('cm2', ?, 'البلاغة', 'الاستعارة المكنية', 'شرح', 2, 0)`, platform, platform);
  });

  it('يعرض المنشور فقط ويشتق المواد من البيانات', async () => {
    const response = await request('/common-mistakes');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.common_mistakes.map((m: any) => m.id)).toEqual(['cm1']);
    expect(body.subjects).toEqual(['النحو']);
    expect(body.labels.title).toBe('الأخطاء الشائعة');
  });

  it('يصفّي حسب المادة', async () => {
    const body = await (await request('/common-mistakes?subject=البلاغة')).json() as any;
    expect(body.common_mistakes).toHaveLength(0);
  });

  it('يمنع إدارة الأخطاء الشائعة بلا توكن', async () => {
    expect((await request('/admin/common-mistakes')).status).toBe(401);
  });

  it('يسمح للمدير بالإضافة والتعديل والحذف', async () => {
    const create = await post('/admin/common-mistakes', {
      subject: 'الصرف', title: 'الهمزة المتوسطة', content: 'شرح', is_published: true,
    }, 'tok-admin');
    expect(create.status).toBe(201);
    const id = (await create.json() as any).common_mistake.id;

    const update = await patch(`/admin/common-mistakes/${id}`, { is_published: false }, 'tok-admin');
    expect(update.status).toBe(200);
    expect((await update.json() as any).common_mistake.is_published).toBe(0);

    const remove = await request(`/admin/common-mistakes/${id}`, { method: 'DELETE' }, 'tok-admin');
    expect(remove.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════
// 9) المحافظ + الإحالة
// ════════════════════════════════════════════════════════════
describe('محافظ الدفع والإحالة', () => {
  it('يعرض المحافظ النشطة فقط مع الأرقام العربية', async () => {
    run(`INSERT INTO payment_wallets (id, platform, name, phone, is_active, sort_order) VALUES
         ('w2', ?, 'فودافون كاش', '01012345678', 1, 2),
         ('w1', ?, 'فودافون كاش', '01111111111', 1, 1),
         ('w3', ?, 'معطّلة', '01222222222', 0, 0)`, platform, platform, platform);

    const response = await request('/payment-wallets');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.payment_wallets.map((w: any) => w.id)).toEqual(['w1', 'w2']);
    expect(body.payment_wallets[0].phone_ar).toBe('٠١١١١١١١١١١');
    expect(body.labels.section_title).toBe('محافظ الدفع');
  });

  it('لا يُسرّب محافظ منصة أخرى', async () => {
    run(`INSERT INTO payment_wallets (id, platform, name, phone, is_active, sort_order)
         VALUES ('wx', 'other-platform', 'خارجي', '01000000000', 1, 0)`);
    const body = await (await request('/payment-wallets')).json() as any;
    expect(body.payment_wallets).toHaveLength(0);
  });

  it('يمنع إدارة المحافظ بلا توكن', async () => {
    expect((await request('/admin/payment-wallets')).status).toBe(401);
  });

  it('يعرض كود الشريك وإحصاءاته', async () => {
    const response = await request('/me/referral', {}, 'tok-student');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.partner_code).toBe('FSH-AAAA-1111');
    expect(body.uses_count).toBe(0);
    expect(body.labels.button).toBe('خليك شريك معانا');
  });

  it('يُنشئ كود شريك للبيانات القديمة عند غيابه', async () => {
    const response = await request('/me/referral', {}, 'tok-other');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.partner_code).toMatch(/^FSH-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(scalar("SELECT student_code FROM profiles WHERE id = 'other-student'").student_code).toBe(body.partner_code);
  });

  it('يمنع عرض الإحالات الإدارية بلا توكن', async () => {
    expect((await request('/admin/referrals')).status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
// 10) تحدي 1v1
// ════════════════════════════════════════════════════════════
function seedBank(count: number, courseId = 'paid-course') {
  for (let i = 0; i < count; i++) {
    run(`INSERT INTO question_bank (id, platform, course_id, type, question_text, options_json, correct_answer_json, points)
         VALUES (?, ?, ?, 'mcq', ?, ?, ?, 2)`,
      `bank-${i}`, platform, courseId, `سؤال ${i}`, JSON.stringify(['أ', 'ب']), JSON.stringify({ option_index: 1 }));
  }
}

describe('تحدي 1v1', () => {
  beforeEach(() => {
    seedBank(5);
    run("UPDATE profiles SET points = 300, level = 4 WHERE id = 'other-student'");
  });

  it('يعرض لوحة المتصدرين بالنص الحرفي', async () => {
    const response = await request('/challenges/leaderboard', {}, 'tok-student');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.leaderboard[0]).toMatchObject({
      rank: 1,
      student_id: 'other-student',
      points: 300,
      level: 4,
      level_label: 'المستوى 4',
      points_label: '300 نقطة',
    });
    expect(body.leaderboard.find((r: any) => r.student_id === 'student').is_me).toBe(true);
    expect(body.labels.leaderboard_title).toBe('لوحة المتصدرين');
  });

  it('يرسل طلب تحدٍّ ويظهر في الوارد والمرسل', async () => {
    const create = await post('/challenges', { opponent_id: 'other-student', question_count: 5 }, 'tok-student');
    expect(create.status).toBe(201);
    const created = await create.json() as any;
    expect(created.challenge.status).toBe('pending');
    expect(created.challenge.duration_minutes).toBe(5);

    const incoming = await (await request('/challenges/incoming', {}, 'tok-other')).json() as any;
    expect(incoming.incoming).toHaveLength(1);
    expect(incoming.incoming[0].accept_label).toBe('قبول');
    expect(incoming.incoming[0].reject_label).toBe('رفض');

    const outgoing = await (await request('/challenges/outgoing', {}, 'tok-student')).json() as any;
    expect(outgoing.outgoing).toHaveLength(1);
    expect(outgoing.outgoing[0].status_label).toBe('قيد الانتظار');
  });

  it('يرفض إرسال تحدٍّ لنفس الطالب ولطالب غير موجود', async () => {
    expect((await post('/challenges', { opponent_id: 'student' }, 'tok-student')).status).toBe(400);
    expect((await post('/challenges', { opponent_id: 'ghost' }, 'tok-student')).status).toBe(404);
  });

  it('يقبل المنافس الطلب ثم يخوض الطرفان التحدي وتظهر النتيجة', async () => {
    const create = await post('/challenges', { opponent_id: 'other-student', question_count: 5 }, 'tok-student');
    const challengeId = (await create.json() as any).challenge.id;

    // قبل القبول لا يمكن الدخول
    const beforeAccept = await request(`/challenges/${challengeId}`, {}, 'tok-student');
    expect(beforeAccept.status).toBe(403);

    const accept = await post(`/challenges/${challengeId}/accept`, {}, 'tok-other');
    expect(accept.status).toBe(200);
    expect((await accept.json() as any).duration_seconds).toBe(300);

    // الأسئلة تُعرض بلا إجابة صحيحة ولا تفسير
    const enter = await request(`/challenges/${challengeId}`, {}, 'tok-student');
    expect(enter.status).toBe(200);
    const round = await enter.json() as any;
    expect(round.questions).toHaveLength(5);
    expect(round.challenge.duration_seconds).toBe(300);
    for (const question of round.questions) {
      expect(question).not.toHaveProperty('correct_answer_json');
      expect(question).not.toHaveProperty('explanation');
      expect(question).not.toHaveProperty('correct_answer');
    }

    // الطالب يجيب كل الأسئلة صحيحة، المنافس كلها خطأ
    const allCorrect: Record<string, unknown> = {};
    const allWrong: Record<string, unknown> = {};
    for (const question of round.questions) {
      allCorrect[question.id] = 1;
      allWrong[question.id] = 0;
    }

    const firstSubmit = await post(`/challenges/${challengeId}/submit`, { answers: allCorrect }, 'tok-student');
    expect(firstSubmit.status).toBe(200);
    const firstBody = await firstSubmit.json() as any;
    expect(firstBody.score).toBe(10);
    expect(firstBody.status).toBe('accepted');

    // بعد إرسال طرف واحد فقط: «بانتظار منافسك»
    const waiting = await (await request(`/challenges/${challengeId}/result`, {}, 'tok-student')).json() as any;
    expect(waiting.result_label).toBe('بانتظار منافسك');
    expect(waiting.both_submitted).toBe(false);

    const secondSubmit = await post(`/challenges/${challengeId}/submit`, { answers: allWrong }, 'tok-other');
    expect(secondSubmit.status).toBe(200);
    const secondBody = await secondSubmit.json() as any;
    expect(secondBody.status).toBe('completed');
    expect(secondBody.winner_id).toBe('student');
    expect(secondBody.points_awarded).toBe(20);

    const result = await (await request(`/challenges/${challengeId}/result`, {}, 'tok-student')).json() as any;
    expect(result.result_label).toBe('🎉 مبروك! فزت! 🎉');
    expect(result.your_points).toBe(10);
    expect(result.opponent_points).toBe(0);

    const loser = await (await request(`/challenges/${challengeId}/result`, {}, 'tok-other')).json() as any;
    expect(loser.result_label).toBe('حظ أوفر في المرة القادمة');

    // نقاط الفوز تُضاف لرصيد الفائز وتُسجَّل في السجل
    expect(scalar("SELECT points FROM profiles WHERE id = 'student'").points).toBe(20);
    expect(scalar("SELECT reason FROM points_ledger WHERE student_id = 'student'")).toMatchObject({ reason: 'challenge' });
  });

  it('يرفض المنافس الطلب فلا يمكن الدخول', async () => {
    const create = await post('/challenges', { opponent_id: 'other-student' }, 'tok-student');
    const challengeId = (await create.json() as any).challenge.id;

    const reject = await post(`/challenges/${challengeId}/reject`, {}, 'tok-other');
    expect(reject.status).toBe(200);

    const outgoing = await (await request('/challenges/outgoing', {}, 'tok-student')).json() as any;
    expect(outgoing.outgoing[0].status_label).toBe('مرفوض');

    expect((await request(`/challenges/${challengeId}`, {}, 'tok-student')).status).toBe(403);
  });

  it('يمنع طرفاً ثالثاً من رؤية التحدي أو قبوله', async () => {
    const create = await post('/challenges', { opponent_id: 'other-student' }, 'tok-student');
    const challengeId = (await create.json() as any).challenge.id;
    expect((await request(`/challenges/${challengeId}`, {}, 'tok-admin')).status).toBe(404);
    expect((await post(`/challenges/${challengeId}/accept`, {}, 'tok-admin')).status).toBe(404);
  });

  it('يرفض مسارات التحدي بلا توكن', async () => {
    expect((await request('/challenges/leaderboard')).status).toBe(401);
    expect((await request('/challenges/incoming')).status).toBe(401);
    expect((await request('/challenges/outgoing')).status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
// 11) المحادثات
// ════════════════════════════════════════════════════════════
describe('المحادثات', () => {
  it('يرسل رسالة نصية ويعرضها بالنص الحرفي', async () => {
    const send = await post('/conversations/messages', { body: 'السلام عليكم' }, 'tok-student');
    expect(send.status).toBe(201);
    const sent = await send.json() as any;
    expect(sent.message.body).toBe('السلام عليكم');
    expect(sent.message.sender_name).toBe('student');
    expect(sent.labels.placeholder).toBe('اكتب رسالتك...');
    expect(sent.labels.title).toBe('مجموعة الطلاب والمعلم');

    const list = await (await request('/conversations/messages', {}, 'tok-other')).json() as any;
    expect(list.messages).toHaveLength(1);
    expect(list.messages[0].body).toBe('السلام عليكم');
    expect(list.messages[0].is_teacher).toBe(false);
  });

  it('يرسل رسالة صوتية بتسمية المدة m:ss', async () => {
    const send = await post('/conversations/messages', {
      audio_url: '/files/voice/v1.mp3',
      audio_duration_seconds: 75,
    }, 'tok-student');
    expect(send.status).toBe(201);
    expect((await send.json() as any).message.audio_duration_label).toBe('رسالة صوتية (1:15)');
  });

  it('يرفض رسالة فارغة أو صوتاً بلا مدة', async () => {
    expect((await post('/conversations/messages', {}, 'tok-student')).status).toBe(400);
    expect((await post('/conversations/messages', { audio_url: '/v.mp3' }, 'tok-student')).status).toBe(400);
  });

  it('لا يعرض الرسائل المحذوفة', async () => {
    await post('/conversations/messages', { body: 'مؤقتة' }, 'tok-student');
    const id = (scalar("SELECT id FROM messages WHERE sender_id = 'student'")).id;

    const remove = await request(`/conversations/messages/${id}`, { method: 'DELETE' }, 'tok-student');
    expect(remove.status).toBe(200);
    expect((await (await request('/conversations/messages', {}, 'tok-student')).json() as any).messages).toHaveLength(0);
  });

  it('يمنع حذف رسالة طالب آخر لكن يسمح للمدير', async () => {
    await post('/conversations/messages', { body: 'رسالة الطالب' }, 'tok-student');
    const id = (scalar("SELECT id FROM messages WHERE sender_id = 'student'")).id;

    expect((await request(`/conversations/messages/${id}`, { method: 'DELETE' }, 'tok-other')).status).toBe(403);
    expect((await request(`/conversations/messages/${id}`, { method: 'DELETE' }, 'tok-admin')).status).toBe(200);
  });

  it('يرفض مسارات المحادثات بلا توكن', async () => {
    expect((await request('/conversations/messages')).status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
// ترتيب التبويبات + شريط الأخبار
// ════════════════════════════════════════════════════════════
describe('إعدادات الواجهة', () => {
  it('يعرض ترتيب التبويبات وإعداد شريط الأخبار', async () => {
    const response = await request('/tabs-config');
    expect(response.status).toBe(200);
    const body = await response.json() as any;

    expect(body.tabs.map((t: any) => t.label)).toEqual([
      'الرئيسية', 'الملف الشخصي', 'الامتحانات', 'المحادثات', 'التحدي', 'الأخطاء', 'الأخطاء الشائعة',
    ]);
    expect(body.tabs.map((t: any) => t.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(body.news_slider).toEqual({ position: 'top', interval_seconds: 7, show_dots: true });
    expect(body.currency).toBe('جنيه');
  });
});

// ════════════════════════════════════════════════════════════
// تصنيف «خطة ({n} امتحان)» عند الوصول عبر حزمة
// ════════════════════════════════════════════════════════════
describe('تصنيف الامتحان حسب مصدر الوصول', () => {
  it('يعرض «خطة (n امتحان)» عندما يفتح الطالب الامتحان عبر حزمة', async () => {
    run(`INSERT INTO bundles (id, title, is_published, platform, price, sort_order)
         VALUES ('bundle-plan', 'باقة', 1, ?, 150, 0)`, platform);
    run("INSERT INTO bundle_courses (bundle_id, course_id, platform) VALUES ('bundle-plan', 'paid-course', ?)", platform);
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, bundle_id, amount, transfer_image_url, status)
         VALUES ('pr-bundle', ?, 'student', 'bundle', 'bundle-plan', 150, '/t.png', 'approved')`, platform);

    const body = await (await request('/courses/exams', {}, 'tok-student')).json() as any;
    const exam = body.exams.find((e: any) => e.id === 'locked-exam');
    expect(exam.access_state).toBe('ready');
    expect(exam.can_access).toBe(true);
    expect(exam.category_label).toBe('خطة (1 امتحان)');
  });

  it('يعرض «منشأة» للامتحان المخصص و«مجاني» للمجاني', async () => {
    run("UPDATE quizzes SET is_custom = 1 WHERE id = 'locked-exam'");
    run(`INSERT INTO purchase_requests (id, platform, student_id, target_type, exam_id, amount, transfer_image_url, status)
         VALUES ('pr-exam', ?, 'student', 'exam', 'locked-exam', 50, '/t.png', 'approved')`, platform);

    const body = await (await request('/courses/exams', {}, 'tok-student')).json() as any;
    const exam = body.exams.find((e: any) => e.id === 'locked-exam');
    expect(exam.category_label).toBe('منشأة');

    const other = body.exams.find((e: any) => e.id === 'free-exam');
    expect(other.category_label).toBe('مجاني');
  });
});

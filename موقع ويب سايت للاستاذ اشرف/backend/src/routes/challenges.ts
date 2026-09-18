import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth } from '../middleware/auth';
import { generateId } from '../utils/id';
import { gradeAnswer } from './questionBank';
import { awardPoints } from '../lib/points';

const challenges = new Hono<HonoBindings>();

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

/** مدة التحدي: ٥ دقائق (الوثيقة 23 §3.3) — العدّاد يبدأ من 05:00. */
export const CHALLENGE_DURATION_MINUTES = 5;
export const CHALLENGE_DURATION_SECONDS = CHALLENGE_DURATION_MINUTES * 60;

/** نقاط الفوز بالتحدي. */
export const CHALLENGE_WIN_POINTS = 20;

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.3). */
export const CHALLENGE_LABELS = {
  leaderboard_title: 'لوحة المتصدرين',
  leaderboard_subtitle: 'ترتيب الطلاب حسب المستوى',
  incoming_title: 'طلبات التحدي الواردة',
  outgoing_title: 'طلباتك المرسلة',
  accept: 'قبول',
  reject: 'رفض',
  status_accepted: 'مقبول',
  status_pending: 'قيد الانتظار',
  status_rejected: 'مرفوض',
  enter: 'دخول التحدي',
  title: 'تحدي',
  level_label: 'المستوى {n}',
  points_label: '{n} نقطة',
  empty_students: 'لا يوجد طلاب متاحين',
  question_progress: 'سؤال {i} من {n}',
  previous: 'السابق',
  next: 'التالي',
  submit: 'إرسال الإجابات',
  result_title: 'النتيجة',
  your_points: 'نقاطك:',
  opponent_points: 'نقاط المنافس:',
  win: '🎉 مبروك! فزت! 🎉',
  lose: 'حظ أوفر في المرة القادمة',
  draw: 'تعادل!',
  waiting: 'بانتظار منافسك',
  back: 'العودة',
  share_facebook: 'شارك على فيسبوك',
  share_twitter: 'شارك على تويتر',
  beat: 'تغلبت على {name}',
  error_create: 'فشل إرسال طلب التحدي',
  error_accept: 'فشل قبول الطلب',
  error_reject: 'فشل رفض الطلب',
  error_no_questions: 'لا توجد أسئلة لهذا التحدي',
  loading: 'جاري تحميل التحدي...',
} as const;

/** يبني نص `المستوى {n}` / `{n} نقطة`. */
function studentBadge(level: number, points: number) {
  return {
    level_label: `المستوى ${level}`,
    points_label: `${points} نقطة`,
  };
}

/** الأسئلة المتاحة للتحدي: بنك أسئلة المنصة، غير مؤرشفة، وأنواعها قابلة للتصحيح الآلي. */
const GRADABLE_TYPES = ['mcq', 'true_false', 'short_answer', 'fill_blank'];

async function pickChallengeQuestions(
  env: HonoBindings['Bindings'],
  platform: string,
  count: number
): Promise<{ id: string; type: string; question_text: string; image_url: string | null; options_json: string | null; points: number }[]> {
  const placeholders = GRADABLE_TYPES.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, type, question_text, image_url, options_json, points
     FROM question_bank
     WHERE platform = ? AND is_archived = 0 AND type IN (${placeholders})
     ORDER BY RANDOM()
     LIMIT ?`
  ).bind(platform, ...GRADABLE_TYPES, count).all<any[]>();
  return results as any[];
}

// ── GET /challenges/leaderboard — لوحة المتصدرين ──
challenges.get('/challenges/leaderboard', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const { results } = await c.env.DB.prepare(
    `SELECT id, full_name, avatar_url, points, level
     FROM profiles
     WHERE platform = ? AND role = 'student' AND status = 'active'
     ORDER BY points DESC, full_name ASC
     LIMIT 50`
  ).bind(platform).all<any[]>();

  return c.json({
    leaderboard: (results as any[]).map((row, index) => ({
      rank: index + 1,
      student_id: row.id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      points: row.points,
      level: row.level,
      is_me: row.id === user.id,
      ...studentBadge(row.level, row.points),
    })),
    labels: CHALLENGE_LABELS,
  });
});

// ── GET /challenges/incoming — طلبات التحدي الواردة ──
challenges.get('/challenges/incoming', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const { results } = await c.env.DB.prepare(
    `SELECT ch.id, ch.status, ch.duration_minutes, ch.question_count, ch.created_at,
            p.id AS challenger_id, p.full_name AS challenger_name, p.avatar_url AS challenger_avatar,
            p.points AS challenger_points, p.level AS challenger_level
     FROM challenges ch
     INNER JOIN profiles p ON p.id = ch.challenger_id
     WHERE ch.platform = ? AND ch.opponent_id = ? AND ch.status = 'pending'
     ORDER BY ch.created_at DESC`
  ).bind(platform, user.id).all<any[]>();

  return c.json({
    incoming: (results as any[]).map(row => ({
      ...row,
      ...studentBadge(row.challenger_level, row.challenger_points),
      accept_label: CHALLENGE_LABELS.accept,
      reject_label: CHALLENGE_LABELS.reject,
    })),
    labels: CHALLENGE_LABELS,
  });
});

// ── GET /challenges/outgoing — طلباتك المرسلة ──
challenges.get('/challenges/outgoing', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const { results } = await c.env.DB.prepare(
    `SELECT ch.id, ch.status, ch.duration_minutes, ch.question_count, ch.created_at,
            ch.challenger_score, ch.opponent_score,
            p.id AS opponent_id, p.full_name AS opponent_name, p.avatar_url AS opponent_avatar,
            p.points AS opponent_points, p.level AS opponent_level
     FROM challenges ch
     INNER JOIN profiles p ON p.id = ch.opponent_id
     WHERE ch.platform = ? AND ch.challenger_id = ?
     ORDER BY ch.created_at DESC`
  ).bind(platform, user.id).all<any[]>();

  return c.json({
    outgoing: (results as any[]).map(row => ({
      ...row,
      ...studentBadge(row.opponent_level, row.opponent_points),
      status_label: row.status === 'accepted' || row.status === 'completed'
        ? CHALLENGE_LABELS.status_accepted
        : row.status === 'rejected'
          ? CHALLENGE_LABELS.status_rejected
          : CHALLENGE_LABELS.status_pending,
      action_label: row.status === 'accepted' ? CHALLENGE_LABELS.enter : null,
    })),
    labels: CHALLENGE_LABELS,
  });
});

// ── POST /challenges — إرسال طلب تحدٍّ ──
const createSchema = z.object({
  opponent_id: z.string().min(1),
  question_count: z.number().int().min(3).max(20).optional(),
});

challenges.post('/challenges', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: CHALLENGE_LABELS.error_create, details: parsed.error.flatten() } }, 400);
  }
  const opponentId = parsed.data.opponent_id;
  const questionCount = parsed.data.question_count ?? 5;

  if (opponentId === user.id) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: CHALLENGE_LABELS.error_create } }, 400);
  }

  const opponent = await c.env.DB.prepare(
    "SELECT id, full_name, points, level FROM profiles WHERE id = ? AND platform = ? AND role = 'student' AND status = 'active'"
  ).bind(opponentId, platform).first<any>();
  if (!opponent) {
    return c.json({ error: { code: 'NOT_FOUND', message: CHALLENGE_LABELS.empty_students } }, 404);
  }

  const duplicate = await c.env.DB.prepare(
    `SELECT id FROM challenges
     WHERE platform = ? AND challenger_id = ? AND opponent_id = ? AND status IN ('pending', 'accepted')
     LIMIT 1`
  ).bind(platform, user.id, opponentId).first();
  if (duplicate) {
    return c.json({ error: { code: 'ALREADY_PENDING', message: CHALLENGE_LABELS.error_create } }, 409);
  }

  const questions = await pickChallengeQuestions(c.env, platform, questionCount);
  if (questions.length === 0) {
    return c.json({ error: { code: 'NO_QUESTIONS', message: CHALLENGE_LABELS.error_no_questions } }, 400);
  }

  const challengeId = generateId();
  const statements: D1PreparedStatement[] = [
    c.env.DB.prepare(
      `INSERT INTO challenges
         (id, platform, challenger_id, opponent_id, status, duration_minutes, question_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))`
    ).bind(challengeId, platform, user.id, opponentId, CHALLENGE_DURATION_MINUTES, questions.length),
  ];

  questions.forEach((question, index) => {
    statements.push(
      c.env.DB.prepare(
        'INSERT INTO challenge_questions (id, challenge_id, question_id, sort_order) VALUES (?, ?, ?, ?)'
      ).bind(generateId(), challengeId, question.id, index)
    );
  });

  await c.env.DB.batch(statements);

  const created = await c.env.DB.prepare('SELECT * FROM challenges WHERE id = ?').bind(challengeId).first();
  return c.json({
    ok: true,
    challenge: created,
    opponent: { ...opponent, ...studentBadge(opponent.level, opponent.points) },
    labels: CHALLENGE_LABELS,
  }, 201);
});

// ── POST /challenges/:id/accept ──
challenges.post('/challenges/:id/accept', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  const id = c.req.param('id');

  const challenge = await c.env.DB.prepare(
    'SELECT * FROM challenges WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<any>();

  if (!challenge || challenge.opponent_id !== user.id) {
    return c.json({ error: { code: 'NOT_FOUND', message: CHALLENGE_LABELS.error_accept } }, 404);
  }
  if (challenge.status !== 'pending') {
    return c.json({ error: { code: 'ALREADY_REVIEWED', message: CHALLENGE_LABELS.error_accept } }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE challenges SET status = 'accepted', started_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM challenges WHERE id = ?').bind(id).first();
  return c.json({ ok: true, challenge: updated, duration_seconds: CHALLENGE_DURATION_SECONDS, labels: CHALLENGE_LABELS });
});

// ── POST /challenges/:id/reject ──
challenges.post('/challenges/:id/reject', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  const id = c.req.param('id');

  const challenge = await c.env.DB.prepare(
    'SELECT id, opponent_id, status FROM challenges WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<{ id: string; opponent_id: string; status: string }>();

  if (!challenge || challenge.opponent_id !== user.id) {
    return c.json({ error: { code: 'NOT_FOUND', message: CHALLENGE_LABELS.error_reject } }, 404);
  }
  if (challenge.status !== 'pending') {
    return c.json({ error: { code: 'ALREADY_REVIEWED', message: CHALLENGE_LABELS.error_reject } }, 400);
  }

  await c.env.DB.prepare(
    "UPDATE challenges SET status = 'rejected', updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();

  return c.json({ ok: true, labels: CHALLENGE_LABELS });
});

/** يجلب التحدي ويتحقق أن المستخدم أحد طرفيه. */
async function loadParticipantChallenge(env: HonoBindings['Bindings'], platform: string, id: string, userId: string) {
  const challenge = await env.DB.prepare(
    'SELECT * FROM challenges WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<any>();
  if (!challenge) return null;
  if (challenge.challenger_id !== userId && challenge.opponent_id !== userId) return null;
  return challenge;
}

// ── GET /challenges/:id — الدخول للتحدي: الأسئلة بلا إجابات ──
challenges.get('/challenges/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  const id = c.req.param('id');

  const challenge = await loadParticipantChallenge(c.env, platform, id, user.id);
  if (!challenge) {
    return c.json({ error: { code: 'NOT_FOUND', message: CHALLENGE_LABELS.error_no_questions } }, 404);
  }
  if (challenge.status === 'pending' || challenge.status === 'rejected') {
    return c.json({ error: { code: 'CHALLENGE_NOT_ACTIVE', message: CHALLENGE_LABELS.status_pending } }, 403);
  }

  // الأسئلة تُعرض بدون الإجابة الصحيحة ولا التفسير — كشفها يكون بعد التسليم فقط.
  const { results } = await c.env.DB.prepare(
    `SELECT cq.sort_order, q.id, q.type, q.question_text, q.image_url, q.options_json, q.points
     FROM challenge_questions cq
     INNER JOIN question_bank q ON q.id = cq.question_id
     WHERE cq.challenge_id = ?
     ORDER BY cq.sort_order ASC`
  ).bind(id).all<any[]>();

  const questions = (results as any[]).map(row => ({
    id: row.id,
    type: row.type,
    question_text: row.question_text,
    image_url: row.image_url,
    options: row.options_json ? JSON.parse(row.options_json) : null,
    points: row.points,
    sort_order: row.sort_order,
  }));

  const startedAt = challenge.started_at ? Date.parse(challenge.started_at.replace(' ', 'T') + 'Z') : Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

  const isChallenger = challenge.challenger_id === user.id;
  const alreadyDone = isChallenger ? challenge.challenger_done === 1 : challenge.opponent_done === 1;

  return c.json({
    challenge: {
      id: challenge.id,
      status: challenge.status,
      duration_seconds: CHALLENGE_DURATION_SECONDS,
      remaining_seconds: Math.max(0, CHALLENGE_DURATION_SECONDS - elapsed),
      already_submitted: alreadyDone,
      is_challenger: isChallenger,
    },
    questions,
    labels: CHALLENGE_LABELS,
  });
});

// ── POST /challenges/:id/submit — إرسال الإجابات والتصحيح ──
const submitSchema = z.object({ answers: z.record(z.unknown()) });

challenges.post('/challenges/:id/submit', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  const id = c.req.param('id');

  const body = await c.req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const challenge = await loadParticipantChallenge(c.env, platform, id, user.id);
  if (!challenge) {
    return c.json({ error: { code: 'NOT_FOUND', message: CHALLENGE_LABELS.error_no_questions } }, 404);
  }
  if (challenge.status !== 'accepted' && challenge.status !== 'completed') {
    return c.json({ error: { code: 'CHALLENGE_NOT_ACTIVE', message: CHALLENGE_LABELS.status_pending } }, 403);
  }

  const isChallenger = challenge.challenger_id === user.id;
  if ((isChallenger ? challenge.challenger_done : challenge.opponent_done) === 1) {
    return c.json({ error: { code: 'ALREADY_SUBMITTED', message: 'تم إرسال إجاباتك بالفعل' } }, 400);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT cq.question_id, q.type, q.correct_answer_json, q.points
     FROM challenge_questions cq
     INNER JOIN question_bank q ON q.id = cq.question_id
     WHERE cq.challenge_id = ?`
  ).bind(id).all<any[]>();

  if ((results as any[]).length === 0) {
    return c.json({ error: { code: 'NO_QUESTIONS', message: CHALLENGE_LABELS.error_no_questions } }, 400);
  }

  let score = 0;
  const graded: Array<{ question_id: string; correct: boolean | null; points: number }> = [];

  for (const row of results as any[]) {
    const key = row.correct_answer_json ? JSON.parse(row.correct_answer_json) : null;
    const given = parsed.data.answers[row.question_id];
    const { correct } = gradeAnswer(row.type, key, given);
    const points = correct === true ? (row.points || 1) : 0;
    score += points;
    graded.push({ question_id: row.question_id, correct, points });
  }

  const statements: D1PreparedStatement[] = graded.map(entry =>
    c.env.DB.prepare(
      `INSERT INTO challenge_answers (id, platform, challenge_id, student_id, question_id, answer_json, is_correct, points, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(challenge_id, student_id, question_id) DO UPDATE SET
         answer_json = excluded.answer_json,
         is_correct  = excluded.is_correct,
         points      = excluded.points`
    ).bind(
      generateId(),
      platform,
      id,
      user.id,
      entry.question_id,
      JSON.stringify(parsed.data.answers[entry.question_id] ?? null),
      entry.correct === true ? 1 : 0,
      entry.points
    )
  );

  statements.push(
    c.env.DB.prepare(
      isChallenger
        ? "UPDATE challenges SET challenger_score = ?, challenger_done = 1, updated_at = datetime('now') WHERE id = ?"
        : "UPDATE challenges SET opponent_score = ?, opponent_done = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(score, id)
  );

  await c.env.DB.batch(statements);

  const after = await c.env.DB.prepare('SELECT * FROM challenges WHERE id = ?').bind(id).first<any>();

  let result: { status: string; winner_id: string | null; points_awarded: number } = {
    status: after.status,
    winner_id: after.winner_id,
    points_awarded: 0,
  };

  if (after.challenger_done === 1 && after.opponent_done === 1 && after.status !== 'completed') {
    const winnerId = after.challenger_score === after.opponent_score
      ? null
      : after.challenger_score > after.opponent_score
        ? after.challenger_id
        : after.opponent_id;

    await c.env.DB.prepare(
      "UPDATE challenges SET status = 'completed', winner_id = ?, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).bind(winnerId, id).run();

    if (winnerId) {
      await awardPoints(c.env, winnerId, CHALLENGE_WIN_POINTS, 'challenge', {
        referenceId: id,
        note: 'الفوز بتحدٍّ 1v1',
      });
    }

    result = { status: 'completed', winner_id: winnerId, points_awarded: winnerId ? CHALLENGE_WIN_POINTS : 0 };
  }

  return c.json({ ok: true, score, graded, ...result, labels: CHALLENGE_LABELS });
});

// ── GET /challenges/:id/result — النتيجة ──
challenges.get('/challenges/:id/result', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  const id = c.req.param('id');

  const challenge = await loadParticipantChallenge(c.env, platform, id, user.id);
  if (!challenge) {
    return c.json({ error: { code: 'NOT_FOUND', message: CHALLENGE_LABELS.error_no_questions } }, 404);
  }

  const isChallenger = challenge.challenger_id === user.id;
  const myScore = isChallenger ? challenge.challenger_score : challenge.opponent_score;
  const opponentScore = isChallenger ? challenge.opponent_score : challenge.challenger_score;
  const iAmDone = (isChallenger ? challenge.challenger_done : challenge.opponent_done) === 1;
  const bothDone = challenge.challenger_done === 1 && challenge.opponent_done === 1;

  let result_label: string | null = null;
  if (!bothDone) {
    result_label = iAmDone ? CHALLENGE_LABELS.waiting : null;
  } else if (myScore === opponentScore) {
    result_label = CHALLENGE_LABELS.draw;
  } else if (myScore > opponentScore) {
    result_label = CHALLENGE_LABELS.win;
  } else {
    result_label = CHALLENGE_LABELS.lose;
  }

  const opponentId = isChallenger ? challenge.opponent_id : challenge.challenger_id;
  const opponent = await c.env.DB.prepare(
    'SELECT id, full_name, avatar_url, points, level FROM profiles WHERE id = ?'
  ).bind(opponentId).first<any>();

  return c.json({
    challenge_id: id,
    status: challenge.status,
    your_points: myScore,
    opponent_points: opponentScore,
    both_submitted: bothDone,
    winner_id: challenge.winner_id,
    result_label,
    opponent: opponent ? { ...opponent, ...studentBadge(opponent.level, opponent.points) } : null,
    labels: CHALLENGE_LABELS,
  });
});

export default challenges;

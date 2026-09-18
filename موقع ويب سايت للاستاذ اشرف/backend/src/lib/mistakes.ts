/**
 * كتاب الأخطاء — منطق مشترك
 * Error book (student mistakes) — shared logic.
 */

import type { Env } from '../types';

export type MistakeSource = 'quiz' | 'bank';

const LATIN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

function parseOptions(optionsJson: string | null | undefined): string[] | null {
  if (!optionsJson) return null;
  try {
    const parsed = JSON.parse(optionsJson);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((entry: unknown) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const value = obj.text ?? obj.label ?? obj.value ?? obj.title;
        if (typeof value === 'string') return value;
      }
      return '';
    });
  } catch {
    return null;
  }
}

/**
 * يحوّل قيمة `correct_option` إلى النص المعروض.
 * `correct_option` يُخزَّن عادةً كنص الخيار نفسه، لكن بعض البيانات القديمة
 * تخزّنه كحرف (A/B/C) — في هذه الحالة نعيد نص الخيار من `options_json`.
 */
export function resolveCorrectOptionText(
  optionsJson: string | null | undefined,
  correctOption: string | null | undefined
): string {
  const raw = (correctOption ?? '').trim();
  if (!raw) return '';

  const options = parseOptions(optionsJson);
  if (!options) return raw;

  const upper = raw.toUpperCase();
  const latinIndex = LATIN_LETTERS.indexOf(upper);
  if (latinIndex >= 0 && options[latinIndex]) return options[latinIndex];

  const arabicIndex = ARABIC_LETTERS.indexOf(raw);
  if (arabicIndex >= 0 && options[arabicIndex]) return options[arabicIndex];

  return raw;
}

/** معرّف ثابت لكل (طالب، سؤال، اختبار) لمنع التكرار وتحديث الإجابة عند إعادة الخطأ. */
function mistakeId(studentId: string, source: MistakeSource, questionId: string, quizId: string | null): string {
  return `mistake:${studentId}:${source}:${questionId}:${quizId || 'practice'}`;
}

export interface RecordMistakeInput {
  studentId: string;
  questionId: string;
  source: MistakeSource;
  quizId?: string | null;
  examId?: string | null;
  questionText?: string | null;
  givenAnswer?: string | null;
  correctAnswer?: string | null;
  pointsLost?: number;
}

/**
 * يسجّل خطأً في كتاب الأخطاء. آمن للتكرار: إعادة الخطأ في نفس السؤال
 * تُحدّث السطر القائم وتُعيده إلى «غير محلول».
 */
export async function recordMistake(env: Env, input: RecordMistakeInput): Promise<void> {
  const quizId = input.quizId || null;
  const id = mistakeId(input.studentId, input.source, input.questionId, quizId);
  const pointsLost = Number.isFinite(input.pointsLost) ? Math.max(0, Math.trunc(input.pointsLost as number)) : 0;

  await env.DB.prepare(
    `INSERT INTO student_mistakes
       (id, platform, student_id, question_id, question_source, quiz_id, exam_id, question_text, given_answer, correct_answer, points_lost, is_resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       question_text  = excluded.question_text,
       given_answer   = excluded.given_answer,
       correct_answer = excluded.correct_answer,
       points_lost    = excluded.points_lost,
       exam_id        = excluded.exam_id,
       is_resolved    = 0,
       resolved_at    = NULL`
  ).bind(
    id,
    env.PLATFORM_KEY || 'fusha',
    input.studentId,
    input.questionId,
    input.source,
    quizId || '',
    input.examId ?? null,
    input.questionText ?? null,
    input.givenAnswer ?? null,
    input.correctAnswer ?? null,
    pointsLost
  ).run();
}

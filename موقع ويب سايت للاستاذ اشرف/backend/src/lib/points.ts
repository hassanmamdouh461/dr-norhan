/**
 * النقاط والمستوى — منطق مشترك
 * Points & level — shared logic.
 *
 * المستوى يُحسب من إجمالي النقاط: كل 100 نقطة = مستوى.
 * Level is derived from total points: every 100 points is one level.
 */

import type { Env } from '../types';
import { generateId } from '../utils/id';

export const POINTS_PER_LEVEL = 100;

/** نقاط الإحالة: تُمنح للشريك عند تسجيل طالب جديد بكوده. */
export const REFERRAL_POINTS = 50;

export type PointsReason = 'exam_completed' | 'challenge' | 'referral' | 'admin';

/** المستوى المشتق من إجمالي النقاط (يبدأ من 1). */
export function levelFor(totalPoints: number): number {
  const points = Number.isFinite(totalPoints) && totalPoints > 0 ? Math.floor(totalPoints) : 0;
  return Math.floor(points / POINTS_PER_LEVEL) + 1;
}

export interface PointsState {
  total_points: number;
  level: number;
}

/** يقرأ رصيد النقاط الحالي للطالب. */
export async function getPointsState(env: Env, studentId: string): Promise<PointsState> {
  const row = await env.DB.prepare(
    'SELECT points, level FROM profiles WHERE id = ?'
  ).bind(studentId).first<{ points: number; level: number }>();

  const total = row?.points ?? 0;
  return { total_points: total, level: row?.level ?? levelFor(total) };
}

/**
 * يمنح (أو يخصم عند قيمة سالبة) نقاطاً ويسجّلها في السجل.
 * يعيد الحالة بعد التحديث + هل ارتقى المستوى.
 */
export async function awardPoints(
  env: Env,
  studentId: string,
  points: number,
  reason: PointsReason,
  opts: { referenceId?: string | null; note?: string | null } = {}
): Promise<PointsState & { awarded: number; level_up: boolean }> {
  const before = await getPointsState(env, studentId);
  const awarded = Number.isFinite(points) ? Math.trunc(points) : 0;

  if (awarded === 0) {
    return { ...before, awarded: 0, level_up: false };
  }

  const nextTotal = Math.max(0, before.total_points + awarded);
  const nextLevel = levelFor(nextTotal);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO points_ledger (id, platform, student_id, points, reason, reference_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      generateId(),
      env.PLATFORM_KEY || 'fusha',
      studentId,
      awarded,
      reason,
      opts.referenceId ?? null,
      opts.note ?? null
    ),
    env.DB.prepare(
      "UPDATE profiles SET points = ?, level = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(nextTotal, nextLevel, studentId),
  ]);

  return {
    total_points: nextTotal,
    level: nextLevel,
    awarded,
    level_up: nextLevel > before.level,
  };
}

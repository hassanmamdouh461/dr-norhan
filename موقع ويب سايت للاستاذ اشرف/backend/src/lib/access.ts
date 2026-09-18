/**
 * حالات الوصول للمحتوى المدفوع — منطق مشترك
 * Access states for paid content — shared logic.
 *
 * الحالات (الوثيقة 23 §3.2): free / locked / pending / ready
 *   free    → الامتحان مجاني أو المقرر مجاني
 *   ready   → مشترك فعلياً (enrollment) أو تمت الموافقة على طلب الشراء
 *   pending → يوجد طلب شراء قيد المراجعة
 *   locked  → لا شيء مما سبق
 */

import type { Env } from '../types';

export type AccessState = 'free' | 'locked' | 'pending' | 'ready';

/** مصدر الوصول — يُستخدم لاشتقاق تصنيف الامتحان في الواجهة. */
export type AccessVia =
  | 'free_exam'
  | 'free_course'
  | 'enrollment'
  | 'exam_purchase'
  | 'course_purchase'
  | 'bundle_purchase'
  | null;

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.2). */
export const ACCESS_LABELS = {
  free: 'مجاني',
  locked: 'مقفل',
  pending: 'قيد المراجعة',
  ready: 'جاهز',
  awaiting_approval: 'في انتظار الموافقة',
  buy_exam: 'شراء الامتحان',
  solve_exam: 'حل الامتحان',
  purchased_badge: 'منشأة',
  plan_badge: 'خطة',
  paid_badge: 'مدفوع',
  free_badge: 'مجاني',
} as const;

export const PURCHASE_LABELS = {
  page_title: 'مشترياتي',
  page_subtitle: 'تابع طلبات شراء الاختبارات',
  pending: 'قيد المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  empty: 'لا توجد طلبات شراء',
  price: 'السعر',
  requested_at: 'تاريخ الطلب',
  transfer_proof: 'إثبات التحويل',
  modal_title: 'طلب شراء الاختبار',
  modal_hint: 'ارفع لقطة شاشة لإثبات التحويل البنكي.',
  pick_image: 'اختر صورة',
  submit: 'إرسال الطلب',
  cancel: 'إلغاء',
  error_image_required: 'صورة التحويل مطلوبة',
  success: 'تم إرسال طلب الشراء بنجاح',
  dashboard_card: 'مشتريات معلقة',
} as const;

export const CURRENCY = 'جنيه';

export interface ExamAccess {
  state: AccessState;
  price: number;
  is_custom: number;
  via: AccessVia;
  bundle_id: string | null;
}

/**
 * يحسب حالة وصول الطالب لامتحان معيّن.
 * يعتمد على: مجانية الامتحان/المقرر، الاشتراك الفعلي، وطلبات الشراء
 * (سواء للامتحان نفسه أو لمقرره أو لحزمة تضم مقرره).
 */
export async function resolveExamAccess(
  env: Env,
  userId: string | null | undefined,
  exam: { id: string; course_id: string; is_free?: number | null }
): Promise<ExamAccess> {
  const platform = env.PLATFORM_KEY || 'fusha';

  const examRow = await env.DB.prepare(
    'SELECT price, is_custom, is_free FROM quizzes WHERE id = ?'
  ).bind(exam.id).first<{ price: number; is_custom: number; is_free: number }>();

  const price = examRow?.price ?? 0;
  const isCustom = examRow?.is_custom ?? 0;

  if (exam.is_free === 1 || examRow?.is_free === 1) {
    return { state: 'free', price, is_custom: isCustom, via: 'free_exam', bundle_id: null };
  }

  const course = await env.DB.prepare(
    'SELECT is_free FROM courses WHERE id = ? AND platform = ?'
  ).bind(exam.course_id, platform).first<{ is_free: number }>();

  if (course?.is_free === 1) {
    return { state: 'free', price, is_custom: isCustom, via: 'free_course', bundle_id: null };
  }

  if (!userId) {
    return { state: 'locked', price, is_custom: isCustom, via: null, bundle_id: null };
  }

  const enrollment = await env.DB.prepare(
    "SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'"
  ).bind(userId, exam.course_id).first();

  if (enrollment) {
    return { state: 'ready', price, is_custom: isCustom, via: 'enrollment', bundle_id: null };
  }

  // موافقة سابقة على الامتحان نفسه، أو على مقرره، أو على حزمة تضم مقرره.
  // نُعيد نوع الهدف (target_type) لنعرف مصدر الوصول ونشتق تصنيف «خطة».
  const approved = await env.DB.prepare(
    `SELECT target_type, bundle_id FROM purchase_requests
     WHERE student_id = ? AND platform = ? AND status = 'approved'
       AND (
         (target_type = 'exam' AND exam_id = ?)
         OR (target_type = 'course' AND course_id = ?)
         OR (target_type = 'bundle' AND bundle_id IN (
              SELECT bundle_id FROM bundle_courses WHERE course_id = ?
            ))
       )
     ORDER BY CASE target_type WHEN 'exam' THEN 0 WHEN 'course' THEN 1 ELSE 2 END
     LIMIT 1`
  ).bind(userId, platform, exam.id, exam.course_id, exam.course_id)
    .first<{ target_type: string; bundle_id: string | null }>();

  if (approved) {
    const via: AccessVia = approved.target_type === 'exam'
      ? 'exam_purchase'
      : approved.target_type === 'course'
        ? 'course_purchase'
        : 'bundle_purchase';
    return {
      state: 'ready',
      price,
      is_custom: isCustom,
      via,
      bundle_id: approved.target_type === 'bundle' ? approved.bundle_id : null,
    };
  }

  const pending = await env.DB.prepare(
    `SELECT id FROM purchase_requests
     WHERE student_id = ? AND platform = ? AND status = 'pending'
       AND (
         (target_type = 'exam' AND exam_id = ?)
         OR (target_type = 'course' AND course_id = ?)
         OR (target_type = 'bundle' AND bundle_id IN (
              SELECT bundle_id FROM bundle_courses WHERE course_id = ?
            ))
       )
     LIMIT 1`
  ).bind(userId, platform, exam.id, exam.course_id, exam.course_id).first();

  if (pending) {
    return { state: 'pending', price, is_custom: isCustom, via: null, bundle_id: null };
  }

  return { state: 'locked', price, is_custom: isCustom, via: null, bundle_id: null };
}

/** هل تسمح الحالة بالوصول الفعلي للمحتوى؟ */
export function canAccess(state: AccessState): boolean {
  return state === 'free' || state === 'ready';
}

/**
 * تصنيف الامتحان المعروض في الواجهة (الوثيقة 23 §3.2):
 * `مجاني` · `مدفوع` · `منشأة` · `خطة ({n} امتحان)`
 */
export function examCategoryLabel(
  exam: { is_free?: number | null; is_custom?: number | null },
  access: ExamAccess,
  planExamCount: number | null
): string {
  if (access.state === 'free' || exam.is_free === 1) return ACCESS_LABELS.free_badge;
  if (access.via === 'bundle_purchase' && planExamCount !== null) {
    return `${ACCESS_LABELS.plan_badge} (${planExamCount} امتحان)`;
  }
  if (exam.is_custom === 1) return ACCESS_LABELS.purchased_badge;
  return ACCESS_LABELS.paid_badge;
}

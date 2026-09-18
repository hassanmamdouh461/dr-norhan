import { describe, it, expect } from 'vitest';
import { assertLinked } from './parent';

/**
 * بوابة الملكية في عرض وليّ الأمر.
 *
 * لماذا هذه الاختبارات مهمة: `assertLinked` هي خط الدفاع الوحيد الذي يمنع
 * مستخدماً مسجّلاً من قراءة بيانات طالب لا يرتبط به بمجرّد تخمين المعرّف.
 * أي تراجع فيها يعني كشف بيانات حسّاسة (ساعات المذاكرة، الدرجات، ملاحظات الأستاذ).
 */

/** محاكاة مصغّرة لـ D1Database تكفي لاختبار `assertLinked`. */
function fakeDb(result: unknown) {
  return {
    prepare: (_sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => result,
      }),
    }),
  } as unknown as D1Database;
}

describe('assertLinked — بوابة ملكية وليّ الأمر', () => {
  it('يعيد true عندما يوجد رابط فعلي', async () => {
    await expect(assertLinked(fakeDb({ id: 'link-1' }), 'fusha', 'p1', 's1')).resolves.toBe(true);
  });

  it('يعيد false عندما لا يوجد رابط (طالب لشخص آخر)', async () => {
    await expect(assertLinked(fakeDb(null), 'fusha', 'p1', 's2')).resolves.toBe(false);
  });

  it('يعيد false عند undefined بدل null', async () => {
    await expect(assertLinked(fakeDb(undefined), 'fusha', 'p1', 's2')).resolves.toBe(false);
  });

  it('يرفض صفاً فارغاً (حماية من نتيجة بلا معنى)', async () => {
    await expect(assertLinked(fakeDb({}), 'fusha', 'p1', 's1')).resolves.toBe(false);
  });

  it('يمرّر كل المعاملات الأربعة إلى الاستعلام (platform, parent, student)', async () => {
    const calls: unknown[][] = [];
    const spy = {
      prepare: (_sql: string) => ({
        bind: (...args: unknown[]) => {
          calls.push(args);
          return { first: async () => ({ id: 'x' }) };
        },
      }),
    } as unknown as D1Database;

    await assertLinked(spy, 'fusha', 'parent-9', 'student-9');
    expect(calls).toHaveLength(1);
    // الترتيب في parent.ts: platform, parent_id, student_id
    expect(calls[0]).toEqual(['fusha', 'parent-9', 'student-9']);
  });
});

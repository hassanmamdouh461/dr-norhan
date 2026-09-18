import { describe, it, expect } from 'vitest';
import { gradeAnswer } from './questionBank';

/**
 * اختبارات التصحيح عند الخادم (server-side grading).
 *
 * السبب: كان هناك خلل حقيقي — العميل يرسل الإجابة مُغلَّفة ككائن
 * ({ option_index: 1 }) بينما كانت فروع التصحيح تختبر `typeof given === 'number'`
 * أو `'string'` فقط، فكانت **كل** الإجابات تُرجَّع خاطئة. لم يظهر الخلل إلا
 * بالاختبار على النشر الفعلي. هذه الاختبارات تمنع عودته.
 */
describe('gradeAnswer — تصحيح الإجابات', () => {
  const mcqKey = { option_index: 1, option_text: 'مفعول به ثانٍ' };

  it('يقبل الإجابة المُغلَّفة { option_index } (شكل العميل الفعلي)', () => {
    expect(gradeAnswer('mcq', mcqKey, { option_index: 1 }).correct).toBe(true);
    expect(gradeAnswer('mcq', mcqKey, { option_index: 0 }).correct).toBe(false);
    expect(gradeAnswer('mcq', mcqKey, { option_index: 2 }).correct).toBe(false);
  });

  it('يقبل الرقم المباشر', () => {
    expect(gradeAnswer('mcq', mcqKey, 1).correct).toBe(true);
    expect(gradeAnswer('mcq', mcqKey, 0).correct).toBe(false);
  });

  it('يقبل النص المباشر مع توحيد العربية (الهمزات)', () => {
    expect(gradeAnswer('mcq', mcqKey, 'مفعول به ثانٍ').correct).toBe(true);
    // توحيد الهمزات: أ/إ/آ → ا
    expect(gradeAnswer('mcq', { option_index: 0, option_text: 'الأطلال' }, 'الاطلال').correct).toBe(true);
    expect(gradeAnswer('mcq', mcqKey, 'تمييز').correct).toBe(false);
  });

  it('معروف: التنوين لا يُوحَّد بعد (فجوة مقبولة حالياً)', () => {
    // «ثانٍ» بتنوين الكسر مقابل «ثاني» بدونه — لا يُعدّان متطابقين اليوم.
    // موثّق كفجوة معروفة لا كسلوك مرغوب، حتى لا تنكسر المقارنة النصية الصارمة.
    expect(gradeAnswer('mcq', mcqKey, 'مفعول به ثاني').correct).toBe(false);
  });

  it('يتعامل مع صح/خطأ بالشكلين', () => {
    expect(gradeAnswer('true_false', { value: true }, { value: true }).correct).toBe(true);
    expect(gradeAnswer('true_false', { value: true }, { value: false }).correct).toBe(false);
    expect(gradeAnswer('true_false', { value: false }, false).correct).toBe(true);
  });

  it('السؤال المقالي لا يُصحَّح آلياً', () => {
    const r = gradeAnswer('essay', { text: '' }, { text: 'إجابة' });
    expect(r.correct).toBeNull();
    expect(r.reason).toBeTruthy();
  });

  it('الإجابة القصيرة تُقارن نصياً مع التوحيد', () => {
    expect(gradeAnswer('short_answer', { text: 'الأطلال' }, { text: 'الاطلال' }).correct).toBe(true);
    expect(gradeAnswer('short_answer', { text: 'الأطلال' }, { text: 'الديار' }).correct).toBe(false);
  });

  it('لا يُسقط التصحيح عند إجابة فارغة', () => {
    expect(gradeAnswer('mcq', mcqKey, null).correct).toBe(false);
    expect(gradeAnswer('mcq', mcqKey, undefined).correct).toBe(false);
  });

  it('matching/ordering تُقارن كـ JSON كامل (لا تتأثر بفكّ التغليف)', () => {
    const key = { pairs: [{ l: 'أ', r: '1' }] };
    expect(gradeAnswer('matching', key, { pairs: [{ l: 'أ', r: '1' }] }).correct).toBe(true);
    expect(gradeAnswer('matching', key, { pairs: [{ l: 'أ', r: '2' }] }).correct).toBe(false);
  });
});

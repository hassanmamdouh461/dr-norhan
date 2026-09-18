import { describe, it, expect } from 'vitest';
import { toPublicApi } from './questionBank';

/**
 * ضمان عدم تسرّب مفتاح الإجابة إلى المتصفح.
 *
 * لماذا: بنك الأسئلة سطح عام (لا يتطلب دخولاً)، فلو وصل `correct_answer_json`
 * أو `explanation` إلى العميل لأصبح بإمكان أي زائر قراءة كل الإجابات قبل المحاولة —
 * أي أن وضع التدريب يفقد معناه بالكامل. هذه الاختبارات تقفل هذا الباب.
 */

const FULL_ROW = {
  id: 'q1',
  platform: 'fusha',
  course_id: 'c1',
  unit_id: 'u1',
  lesson_id: 'l1',
  type: 'mcq',
  difficulty: 'medium',
  bloom_level: 'تطبيق',
  question_text: 'ما إعراب «الكوثر»؟',
  image_url: null,
  options_json: '["مفعول به أول","مفعول به ثانٍ","تمييز","حال"]',
  correct_answer_json: '{"option_index":1,"option_text":"مفعول به ثانٍ"}',
  explanation: 'الفعل «أعطى» ينصب مفعولين…',
  points: 1,
  tags_json: '["النحو"]',
  source: 'وزاري 2024',
  usage_count: 3,
  is_archived: 0,
  created_by: 'admin',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as any;

const FORBIDDEN = [
  'correct_answer',
  'correct_answer_json',
  'correct_option',
  'explanation',
  'is_archived',
  'created_by',
];

describe('toPublicApi — تجريد مفتاح الإجابة', () => {
  it('لا يُرجع أي حقل من حقول الإجابة أو الشرح', () => {
    const out = toPublicApi(FULL_ROW) as Record<string, unknown>;
    for (const key of FORBIDDEN) {
      expect(out).not.toHaveProperty(key);
    }
  });

  it('لا يحتوي الناتج المُسلسَل على مؤشّر الإجابة ولا على الشرح', () => {
    const serialized = JSON.stringify(toPublicApi(FULL_ROW));
    // نصوص الخيارات نفسها يجب أن تظهر (لولاها لما استطاع الطالب الإجابة) —
    // المخفي هو «أيّها الصحيح» وسببه.
    expect(serialized).toContain('مفعول به ثانٍ'); // خيار معروض بشكل مشروع
    expect(serialized).not.toContain('الفعل «أعطى»'); // الشرح
    expect(serialized).not.toContain('option_index'); // مؤشّر الصحيح
    expect(serialized).not.toContain('option_text'); // تكرار نص الصحيح
  });

  it('يُرجع الحقول العامة المطلوبة لبناء الشاشة', () => {
    const out = toPublicApi(FULL_ROW) as Record<string, unknown>;
    expect(out.id).toBe('q1');
    expect(out.question_text).toBe('ما إعراب «الكوثر»؟');
    expect(out.type).toBe('mcq');
    expect(out.difficulty).toBe('medium');
    expect(Array.isArray(out.options)).toBe(true);
    expect(out.points).toBe(1);
  });

  it('matching: لا يُرسل الأزواج المحلولة — العمود الأيمن يُرسل مبعثراً فقط', () => {
    const row = {
      ...FULL_ROW,
      type: 'matching',
      options_json: JSON.stringify([
        { left: 'الطَّلَل', right: 'أثر الديار' },
        { left: 'الدِّمْنَة', right: 'ما اسودّ من الآثار' },
      ]),
      correct_answer_json: JSON.stringify({
        pairs: [
          { l: 'الطَّلَل', r: 'أثر الديار' },
          { l: 'الدِّمْنَة', r: 'ما اسودّ من الآثار' },
        ],
      }),
    };
    const out = toPublicApi(row) as Record<string, unknown>;

    // العمود الأيسر يظهر كاملاً
    expect(out.options).toEqual(['الطَّلَل', 'الدِّمْنَة']);
    // العمود الأيمن يظهر مبعثراً (اختيارات) لا كحل مرتّب
    expect(Array.isArray(out.choices)).toBe(true);
    // ولا يُكشف الربط الصحيح
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('pairs');
    expect(serialized).not.toContain('"r":');
  });

  it('يبقى آمناً لو حمل الصف حقولاً غير متوقعة', () => {
    const row = { ...FULL_ROW, leaked_secret: 'ANSWER', correct_answer_json: '{"x":1}' };
    const out = toPublicApi(row) as Record<string, unknown>;
    expect(out).not.toHaveProperty('leaked_secret');
    expect(out).not.toHaveProperty('correct_answer_json');
  });
});

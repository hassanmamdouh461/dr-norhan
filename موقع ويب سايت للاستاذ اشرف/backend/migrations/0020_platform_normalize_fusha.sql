-- ============================================================
-- منصة فُصْحَى — D1 (SQLite)
-- Migration: 0020_platform_normalize_fusha.sql
-- ============================================================
-- الغرض: توحيد مفتاح المنصة إلى 'fusha' في كل قاعدة بيانات موجودة فعلاً.
--
-- الخلفية: وُرث هذا المشروع من منصة أخرى، فكانت قيمة DEFAULT لعمود platform
-- في الهجرات 0005/0009/0010 هي 'alhadaba-chemistry'، بينما يستخدم الكود
-- في وقت التشغيل `c.env.PLATFORM_KEY || 'fusha'`. هذا التناقض يجعل أي صف
-- يُدرج بدون تحديد platform صريح غير مرئي للمنصة بالكامل.
--
-- الهجرات نفسها صُحّحت إلى 'fusha'؛ هذه الهجرة تعالج قواعد البيانات التي
-- نُفّذت عليها الهجرات القديمة بالفعل (تصحيح بيانات + أمان مستقبلي).
-- ============================================================

-- ⚠️ تنبيه مهم:
-- هذه الهجرة تلمس **الجداول التي تحتوي عمود platform فعلاً فقط**.
-- جداول مثل lesson_videos و quizzes و quiz_attempts و quiz_questions
-- و exam_questions و lecture_playback_logs **لا تحتوي هذا العمود**، وأي
-- UPDATE عليها يُسقط الهجرة بخطأ "no such column: platform" (وهو ما حدث
-- فعلاً وأسقط اختبارات codes/security قبل هذا التصحيح). عزل تلك الجداول
-- يتمّ أصلاً عبر الربط مع courses في الاستعلامات، فلا تحتاج تصحيح بيانات.
-- قبل إضافة أي UPDATE جديد هنا: تحقّق أولاً بـ PRAGMA table_info(<الجدول>).

-- 1) تصحيح كل الصفوف الموجودة التي تحمل مفتاح المنصة القديم
UPDATE profiles        SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE courses         SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE units           SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE lessons         SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE lesson_files    SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE lesson_progress SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE code_batches    SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE activation_codes SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE enrollments     SET platform = 'fusha' WHERE platform <> 'fusha';

-- 2) جداول أُنشئت في هجرات لاحقة (0018/0019/0021) وتُنفَّد دائماً قبل هذه
--    الهجرة لأن الترتيب تصاعدي، لذا وجودها مضمون.
UPDATE question_bank      SET platform = 'fusha' WHERE platform <> 'fusha';
UPDATE dictionary_entries SET platform = 'fusha' WHERE platform <> 'fusha';

-- ملاحظة: SQLite لا يسمح بتغيير DEFAULT لعمود قائم. القيم الافتراضية الصحيحة
-- ('fusha') مُثبّتة في الهجرات 0005/0009/0010 و0018/0019 نفسها، لذا أي قاعدة
-- بيانات تُنشأ من الصفر تحصل على القيمة الصحيحة تلقائياً.

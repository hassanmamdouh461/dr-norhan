-- بيانات اختبار أدنى
INSERT INTO courses (id, title, slug, is_free, is_published, is_archived, platform, price)
VALUES ('fk-course', 'اختبار', 'fk-course', 0, 1, 0, 'fusha', 0);

INSERT INTO units (id, course_id, title, is_published, platform)
VALUES ('fk-unit', 'fk-course', 'وحدة', 1, 'fusha');

INSERT INTO profiles (id, supabase_user_id, email, role, full_name, status, platform, last_seen_at)
VALUES ('fk-student', 'fk-student', 'fk@test.invalid', 'student', 'طالب', 'active', 'fusha', datetime('now'));

INSERT INTO lessons (id, course_id, unit_id, title, is_published, platform)
VALUES ('fk-lesson', 'fk-course', 'fk-unit', 'درس', 1, 'fusha');

-- 1) امتحان مستقل (lesson_id = NULL) — الحالة الشائعة
INSERT INTO quizzes (id, course_id, lesson_id, title, max_score, is_published)
VALUES ('q-null', 'fk-course', NULL, 'امتحان مستقل', 10, 1);

-- 2) امتحان مرتبط بدرس (lesson_id غير NULL)
INSERT INTO quizzes (id, course_id, lesson_id, title, max_score, is_published)
VALUES ('q-lesson', 'fk-course', 'fk-lesson', 'امتحان درس', 10, 1);

-- 3) تقدم درس (lesson_id NOT NULL)
INSERT INTO lesson_progress (id, student_id, lesson_id, course_id)
VALUES ('lp-1', 'fk-student', 'fk-lesson', 'fk-course');

-- 4) سجل تشغيل (lesson_id NOT NULL)
INSERT INTO lecture_playback_logs (id, student_id, lesson_id, action, position_seconds)
VALUES ('lpl-1', 'fk-student', 'fk-lesson', 'open', 0);

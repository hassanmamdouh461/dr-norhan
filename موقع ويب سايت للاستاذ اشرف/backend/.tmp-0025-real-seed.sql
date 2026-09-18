-- End-to-end rehearsal seed. Runs against a fresh local D1 that already has all
-- 24 migrations applied (i.e. the broken production schema).
--
-- quizzes / lesson_progress / lecture_playback_logs cannot be written while the
-- dangling FK exists, so a temporary lessons_old parent is created exactly the
-- way migration 0025 creates it. Dropping that parent restores the broken state:
-- quizzes.lesson_id is SET NULL by the drop, and the two NO ACTION / CASCADE
-- children are left empty so the drop itself cannot fail.

INSERT INTO profiles(id, supabase_user_id, email, role, full_name)
VALUES ('admin','admin-auth','admin@example.invalid','admin','Admin'),
       ('student','student-auth','student@example.invalid','student','Student');

INSERT INTO courses(id, title, slug, subject, created_by, is_published)
VALUES ('course','Course','course','Test','admin',1);

INSERT INTO units(id, course_id, title, is_published)
VALUES ('unit','course','Unit',1);

INSERT INTO lessons(id, unit_id, course_id, title, is_published, duration_seconds)
VALUES ('lesson','unit','course','Lesson',1,300);

INSERT INTO question_bank(id, question_text)
VALUES ('bank-q','Bank question');

CREATE TABLE lessons_old (id TEXT PRIMARY KEY);
INSERT INTO lessons_old (id) SELECT id FROM lessons;

INSERT INTO quizzes(id, course_id, lesson_id, title, max_score, is_published, sort_order, price, is_custom)
VALUES ('quiz-linked','course','lesson','Linked exam',100,1,1,25,1),
       ('quiz-standalone','course',NULL,'Standalone exam',50,1,2,0,0);

INSERT INTO quiz_questions(id, quiz_id, question_text, options_json, correct_option, score, sort_order, explanation)
VALUES ('qq-1','quiz-linked','Question one','["A","B"]','A',1,1,'Synthetic explanation'),
       ('qq-2','quiz-standalone','Question two','["A","B"]','B',1,1,NULL);

INSERT INTO quiz_attempts(id, student_id, quiz_id, score)
VALUES ('attempt-1','student','quiz-linked',7.5);

INSERT INTO exam_questions(id, quiz_id, question_id, sort_order)
VALUES ('eq-1','quiz-linked','bank-q',1);

INSERT INTO purchase_requests(id, platform, student_id, target_type, exam_id, amount, status)
VALUES ('pr-1','fusha','student','exam','quiz-linked',25,'pending');

INSERT INTO exam_build_requests(id, platform, student_id, title, duration_minutes, question_count, price, generated_quiz_id)
VALUES ('ebr-1','fusha','student','Custom build',60,10,15,'quiz-linked');

DROP TABLE lessons_old;

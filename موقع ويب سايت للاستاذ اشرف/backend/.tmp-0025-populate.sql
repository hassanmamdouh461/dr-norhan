-- Production rehearsal: seed the BROKEN schema with realistic rows.
-- Inserts into quizzes / lesson_progress / lecture_playback_logs are impossible
-- while the dangling FK exists, so a temporary lessons_old compatibility parent
-- is created exactly the way migration 0025 itself does it. It is dropped again
-- below, restoring the broken production state before the repair is applied.

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

INSERT INTO lesson_progress(id, student_id, lesson_id, course_id, watched_seconds, last_position, highest_position_watched)
VALUES ('lp-1','student','lesson','course',137,121,150);

INSERT INTO lecture_playback_logs(id, student_id, lesson_id, action, position_seconds)
VALUES ('lpl-1','student','lesson','close',137);

DROP TABLE lessons_old;

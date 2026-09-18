INSERT INTO profiles(id, supabase_user_id, email, role, full_name)
VALUES ('admin','admin-auth','admin@example.invalid','admin','Admin'),
       ('student','student-auth','student@example.invalid','student','Student');

INSERT INTO courses(id, title, slug, subject, created_by, is_published)
VALUES ('course','Course','course','Test','admin',1);

INSERT INTO units(id, course_id, title, is_published)
VALUES ('unit','course','Unit',1);

INSERT INTO lessons(id, unit_id, course_id, title, is_published, duration_seconds)
VALUES ('lesson','unit','course','Lesson',1,300);

-- Must succeed both before and after the repair: lesson_id is NULL, so the
-- dangling FK is never resolved.
INSERT INTO quizzes(id, course_id, lesson_id, title, price, is_custom)
VALUES ('quiz-unlinked','course',NULL,'Unlinked',0,0);

-- Reference rows used to prove the repaired tables still enforce their FKs.
INSERT INTO question_bank(id, question_text) VALUES ('bank-q','Bank question');

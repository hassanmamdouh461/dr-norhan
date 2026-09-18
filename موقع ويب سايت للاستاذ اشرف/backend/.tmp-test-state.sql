SELECT
  (SELECT COUNT(*) FROM courses WHERE id = 'fk-course')            AS courses,
  (SELECT COUNT(*) FROM units WHERE id = 'fk-unit')                AS units,
  (SELECT COUNT(*) FROM profiles WHERE id = 'fk-student')          AS profiles,
  (SELECT COUNT(*) FROM lessons WHERE id = 'fk-lesson')            AS lessons,
  (SELECT COUNT(*) FROM quizzes WHERE id = 'q-null')               AS quiz_null_lesson,
  (SELECT COUNT(*) FROM quizzes WHERE id = 'q-lesson')             AS quiz_with_lesson,
  (SELECT COUNT(*) FROM lesson_progress WHERE id = 'lp-1')         AS lesson_progress,
  (SELECT COUNT(*) FROM lecture_playback_logs WHERE id = 'lpl-1')  AS playback_logs;

SELECT '--TABLE--' AS marker, name AS obj_name, sql AS ddl FROM sqlite_master
WHERE type = 'table' AND name IN ('lesson_progress', 'lecture_playback_logs', 'quizzes')
UNION ALL
SELECT '--INDEX--' AS marker, name AS obj_name, sql AS ddl FROM sqlite_master
WHERE type = 'index' AND tbl_name IN ('lesson_progress', 'lecture_playback_logs', 'quizzes')
ORDER BY marker, obj_name;

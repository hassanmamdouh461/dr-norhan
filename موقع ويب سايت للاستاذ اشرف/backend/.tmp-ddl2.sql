SELECT 'TABLE' AS kind, name AS obj_name, sql AS ddl
FROM sqlite_master
WHERE type = 'table' AND name IN ('lesson_progress', 'lecture_playback_logs', 'quizzes');

SELECT 'INDEX' AS kind, name AS obj_name, COALESCE(sql, '(implicit autoindex)') AS ddl
FROM sqlite_master
WHERE type = 'index'
  AND tbl_name IN ('lesson_progress', 'lecture_playback_logs', 'quizzes');

SELECT 'REFERENCES_QUIZZES' AS kind, name AS obj_name, sql AS ddl
FROM sqlite_master
WHERE type = 'table' AND name <> 'quizzes' AND sql LIKE '%REFERENCES quizzes(id)%';

SELECT 'REFERENCES_LESSONS_OLD' AS kind, name AS obj_name, sql AS ddl
FROM sqlite_master
WHERE type = 'table' AND sql LIKE '%lessons_old%';

SELECT 'FK_CHECK' AS kind, 'foreign_key_check' AS obj_name, COALESCE((
  SELECT group_concat(t) FROM (SELECT "table" || ':' || "rowid" AS t FROM pragma_foreign_key_check)
), '(none)') AS ddl;

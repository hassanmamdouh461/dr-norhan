-- 1) units
ALTER TABLE units ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE units SET platform = COALESCE((SELECT platform FROM courses WHERE courses.id = units.course_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_units_platform ON units(platform);

-- 2) lessons
ALTER TABLE lessons ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE lessons SET platform = COALESCE((SELECT platform FROM courses WHERE courses.id = lessons.course_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_lessons_platform ON lessons(platform);

-- 3) lesson_videos
ALTER TABLE lesson_videos ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE lesson_videos SET platform = COALESCE((SELECT platform FROM lessons WHERE lessons.id = lesson_videos.lesson_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_lesson_videos_platform ON lesson_videos(platform);

-- 4) lesson_files
ALTER TABLE lesson_files ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE lesson_files SET platform = COALESCE((SELECT platform FROM lessons WHERE lessons.id = lesson_files.lesson_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_lesson_files_platform ON lesson_files(platform);

-- 5) lesson_progress
ALTER TABLE lesson_progress ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE lesson_progress SET platform = COALESCE((SELECT platform FROM courses WHERE courses.id = lesson_progress.course_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_lesson_progress_platform ON lesson_progress(platform);

-- 6) questions
ALTER TABLE questions ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE questions SET platform = COALESCE((SELECT platform FROM profiles WHERE profiles.id = questions.student_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_questions_platform ON questions(platform);

-- 7) answers
ALTER TABLE answers ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE answers SET platform = COALESCE((SELECT platform FROM questions WHERE questions.id = answers.question_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_answers_platform ON answers(platform);

-- 8) reviews
ALTER TABLE reviews ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE reviews SET platform = COALESCE((SELECT platform FROM profiles WHERE profiles.id = reviews.student_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);

-- 9) bundles
ALTER TABLE bundles ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
CREATE INDEX IF NOT EXISTS idx_bundles_platform ON bundles(platform);

-- 10) bundle_courses
ALTER TABLE bundle_courses ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
UPDATE bundle_courses SET platform = COALESCE((SELECT platform FROM courses WHERE courses.id = bundle_courses.course_id), 'fusha');
CREATE INDEX IF NOT EXISTS idx_bundle_courses_platform ON bundle_courses(platform);


/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import type { DatabaseSync as SQLiteDatabase, SQLInputValue } from 'node:sqlite';
import { Hono } from 'hono';
import type { Env, HonoBindings } from '../types';
import courses from './courses';

// Vitest 1 / Vite 5 predate node:sqlite; load the built-in without Vite resolution.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const platform = 'legacy-tenant';
const app = new Hono<HonoBindings>().route('/courses', courses);

// Use the real schema and relevant additive migrations, without unrelated table rebuilds.
const schema = [
  '0000_init.sql',
  '0005_platform_isolation.sql',
  '0010_complete_platform_isolation.sql',
  '0011_add_branch_field.sql',
].map(name => readFileSync(new URL(`../../migrations/${name}`, import.meta.url), 'utf8'));

let sqlite: SQLiteDatabase;
let env: Env;
let videoNumber: number;
const network = vi.fn(async () => { throw new Error('Network access is forbidden in course regressions'); });

function run(sql: string, ...values: SQLInputValue[]) {
  sqlite.prepare(sql).run(...values);
}

function addCourse(id: string, free = 0, tenant = platform, archived = 0) {
  run(`INSERT INTO courses (id, title, slug, cover_url, is_free, is_published, is_archived, platform)
       VALUES (?, ?, ?, '/cover.png', ?, 1, ?, ?)`, id, id, id, free, archived, tenant);
  run(`INSERT INTO units (id, course_id, title, is_published, platform) VALUES (?, ?, ?, 1, ?)`,
    `${id}-unit`, id, `${id} unit`, tenant);
}

function addLesson(id: string, courseId = 'enrolled', options: {
  unitId?: string; published?: number; archived?: number; order?: number;
} = {}) {
  run(`INSERT INTO lessons (id, course_id, unit_id, title, description, is_published, is_archived, sort_order, platform)
       VALUES (?, ?, ?, ?, 'Lesson description', ?, ?, ?, ?)`,
    id, courseId, options.unitId ?? `${courseId}-unit`, id,
    options.published ?? 1, options.archived ?? 0, options.order ?? 0, platform);
}

function addVideo(lessonId: string, status: 'uploading' | 'processing' | 'ready' | 'error') {
  run(`INSERT INTO lesson_videos (id, lesson_id, provider, youtube_id, status, duration_seconds)
       VALUES (?, ?, 'youtube', 'private-video-id', ?, 120)`, `video-${videoNumber++}`, lessonId, status);
}

function complete(lessonId: string, courseId = 'enrolled', studentId = 'student') {
  run(`INSERT INTO lesson_progress (id, student_id, lesson_id, course_id, is_completed, last_position)
       VALUES (?, ?, ?, ?, 1, 42)`, `${studentId}-${lessonId}`, studentId, lessonId, courseId);
}

function request(path: string, token: string | null = 'student') {
  return app.request(`/courses${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }, env);
}

async function detail(token: string | null) {
  const response = await request('/enrolled', token);
  expect(response.status).toBe(200);
  return response.json() as Promise<any>;
}

async function expectProgress(courseId: string, total: number, completed: number, percentage: number) {
  const response = await request(`/${courseId}/progress`);
  expect(response.status).toBe(200);
  const body = await response.json() as any;
  const expected = {
    course_id: courseId, total_lessons: total, completed, percentage, is_subscribed: true,
  };
  expect(body).toEqual({ ...expected, progress: expected });

  const listResponse = await request('/me');
  expect(listResponse.status).toBe(200);
  const list = await listResponse.json() as any;
  expect(list.courses.map((course: any) => course.id).sort()).toEqual(['enrolled', 'free']);
  const course = list.courses.find((item: any) => item.id === courseId);
  expect(course).toMatchObject({
    total_lessons: total,
    completed_lessons: completed,
    lessons_count: total,
    cover_image: '/cover.png',
    enrollment_status: courseId === 'enrolled' ? 'active' : 'free',
  });
  expect(total > 0 ? Math.round(course.completed_lessons / course.total_lessons * 100) : 0).toBe(percentage);
}

beforeEach(() => {
  network.mockClear();
  vi.stubGlobal('fetch', network);
  sqlite = new DatabaseSync(':memory:');
  videoNumber = 0;
  for (const migration of schema) sqlite.exec(migration);

  // Real auth middleware resolves these auth-scoped sessions from an in-memory KV.
  const kv = new Map<string, string>();
  for (const [id, role, status, tenant] of [
    ['student', 'student', 'active', platform],
    ['other-student', 'student', 'active', platform],
    ['admin', 'admin', 'active', platform],
    ['assistant', 'assistant', 'active', platform],
    ['blocked-admin', 'admin', 'blocked', platform],
    ['foreign-admin', 'admin', 'active', 'other-platform'],
    ['blacklisted-admin', 'admin', 'active', platform],
  ]) {
    run(`INSERT INTO profiles (id, supabase_user_id, email, role, status, platform, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`, id, id, `${id}@example.invalid`, role, status, tenant);
    kv.set(`playback_token:${id}`, JSON.stringify({ userId: id, scope: 'auth' }));
  }
  kv.set('blacklist:user:blacklisted-admin', '1');
  kv.set('playback_token:playback-admin', JSON.stringify({ userId: 'admin', scope: 'playback' }));

  // Only the D1 transport is adapted: all handler SQL and bindings execute in SQLite.
  env = {
    PLATFORM_KEY: platform,
    KV: { get: async (key: string) => kv.get(key) ?? null },
    DB: {
      prepare(sql: string) {
        const statement = sqlite.prepare(sql);
        let values: SQLInputValue[] = [];
        return {
          bind(...params: SQLInputValue[]) { values = params; return this; },
          async first() { return statement.get(...values) ?? null; },
          async all() { return { success: true, results: statement.all(...values) }; },
        };
      },
    },
  } as unknown as Env;

  addCourse('enrolled');
  addCourse('free', 1);
  run(`INSERT INTO enrollments (id, student_id, course_id, status) VALUES ('enrollment', 'student', 'enrolled', 'active')`);
});

afterEach(() => {
  sqlite?.close();
  vi.unstubAllGlobals();
  expect(network).not.toHaveBeenCalled();
});

describe('GET /courses/:id publication and ready-video visibility', () => {
  beforeEach(() => {
    run(`INSERT INTO units (id, course_id, title, is_published, is_archived, sort_order)
         VALUES ('draft-unit', 'enrolled', 'Draft unit', 0, 0, -1),
                ('archived-unit', 'enrolled', 'Archived unit', 1, 1, -2)`);
    addLesson('text-only', 'enrolled', { order: 1 });
    addLesson('ready', 'enrolled', { order: 2 });
    addVideo('ready', 'ready');
    addVideo('ready', 'processing');
    complete('ready');
    addLesson('draft', 'enrolled', { published: 0, order: 3 });
    addVideo('draft', 'ready');
    addLesson('draft-processing', 'enrolled', { published: 0, order: 4 });
    addVideo('draft-processing', 'processing');
    for (const [index, status] of (['uploading', 'processing', 'error'] as const).entries()) {
      addLesson(status, 'enrolled', { order: 5 + index });
      addVideo(status, status);
    }
    addLesson('archived', 'enrolled', { archived: 1 });
    addVideo('archived', 'ready');
    addLesson('draft-unit-draft', 'enrolled', { unitId: 'draft-unit', published: 0, order: 1 });
    addLesson('draft-unit-published', 'enrolled', { unitId: 'draft-unit', order: 2 });
    addLesson('archived-unit-published', 'enrolled', { unitId: 'archived-unit' });
    addLesson('other-course-lesson', 'free');
  });

  it.each(['admin', 'assistant'])('shows draft units and lessons to %s without including archived content', async token => {
    const body = await detail(token);
    expect(body.units.map((unit: any) => unit.id)).toEqual(['draft-unit', 'enrolled-unit']);
    expect(body.units[0]).toMatchObject({ name: 'Draft unit', is_published: 0 });
    expect(body.units[0].lessons.map((lesson: any) => lesson.id)).toEqual(['draft-unit-draft', 'draft-unit-published']);
    expect(body.units[0].lessons[0].is_published).toBe(0);
    expect(body.units[1].lessons.map((lesson: any) => lesson.id)).toEqual([
      'text-only', 'ready', 'draft', 'draft-processing', 'uploading', 'processing', 'error',
    ]);
    expect(body.units[1].lessons.find((lesson: any) => lesson.id === 'draft')).toMatchObject({ is_published: 0 });
    expect(body.is_enrolled).toBe(0);
  });

  it.each(['student', 'other-student', null, 'invalid-token', 'blocked-admin', 'foreign-admin', 'blacklisted-admin', 'playback-admin'])(
    'does not expose drafts or unready lessons for token %s', async token => {
      const body = await detail(token);
      expect(body.units.map((unit: any) => unit.id)).toEqual(['enrolled-unit']);
      expect(body.units[0].lessons.map((lesson: any) => lesson.id)).toEqual(['text-only', 'ready']);
      expect(body.units[0].lessons[1]).toEqual({
        id: 'ready', unit_id: 'enrolled-unit', title: 'ready', description: 'Lesson description',
        sort_order: 2, is_free_preview: 0, is_published: 1, duration_seconds: 120,
        is_completed: token === 'student' ? 1 : 0,
        last_position: token === 'student' ? 42 : 0,
      });
      expect(body.units[0].lessons[0].duration_seconds).toBe(0);
      expect(body.cover_image).toBe('/cover.png');
      expect(body.is_enrolled).toBe(token === 'student' ? 1 : 0);
      const { course, units, ...topLevelCourse } = body;
      expect(course).toEqual(topLevelCourse);
    },
  );

  it.each(['admin', 'assistant', 'student', null])('preserves course archive and platform restrictions for %s', async token => {
    addCourse('archived-course', 1, platform, 1);
    addCourse('foreign-course', 1, 'other-platform');
    for (const id of ['archived-course', 'foreign-course', 'missing-course']) {
      const response = await request(`/${id}`, token);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    }
  });
});

describe.each(['enrolled', 'free'])('progress eligibility for the %s course-list branch', courseId => {
  function seedCompletedLessons() {
    addLesson('first', courseId);
    addLesson('second', courseId);
    addVideo('second', 'ready');
    complete('first', courseId);
    complete('second', courseId);
  }

  function excludeSecond(reason: string) {
    if (reason === 'archived') {
      run("UPDATE lessons SET is_archived = 1 WHERE id = 'second'");
    } else if (reason === 'unpublished') {
      run("UPDATE lessons SET is_published = 0 WHERE id = 'second'");
    } else {
      run("UPDATE lesson_videos SET status = ? WHERE lesson_id = 'second'", reason);
    }
  }

  it.each(['archived', 'unpublished', 'uploading', 'processing', 'error'])(
    'keeps two completed lessons at 100%, not 200%, when one becomes %s', async reason => {
      seedCompletedLessons();
      await expectProgress(courseId, 2, 2, 100);
      excludeSecond(reason);
      await expectProgress(courseId, 1, 1, 100);
      expect(sqlite.prepare('SELECT COUNT(*) AS count FROM lesson_progress WHERE is_completed = 1').get()).toEqual({ count: 2 });
    },
  );

  it('counts no-video lessons and mixed/multiple ready videos exactly once, not other students or incomplete rows', async () => {
    seedCompletedLessons();
    addVideo('second', 'processing');
    addVideo('second', 'ready');
    addLesson('incomplete', courseId);
    complete('incomplete', courseId, 'other-student');
    run(`INSERT INTO lesson_progress (id, student_id, lesson_id, course_id, is_completed)
         VALUES ('incomplete-progress', 'student', 'incomplete', ?, 0)`, courseId);
    await expectProgress(courseId, 3, 2, 67);
    excludeSecond('unpublished');
    await expectProgress(courseId, 2, 1, 50);
  });

  it('returns zero for a course with no lessons', async () => {
    await expectProgress(courseId, 0, 0, 0);
  });

  it('returns zero completed when the eligible population becomes empty but history remains', async () => {
    seedCompletedLessons();
    run("UPDATE lessons SET is_archived = 1 WHERE id = 'first'");
    excludeSecond('unpublished');
    addLesson('not-ready', courseId);
    addVideo('not-ready', 'processing');
    complete('not-ready', courseId);
    await expectProgress(courseId, 0, 0, 0);
  });

  it('requires completed progress to refer to a lesson in the denominator course', async () => {
    addLesson('in-course', courseId);
    const otherCourse = courseId === 'enrolled' ? 'free' : 'enrolled';
    addLesson('other-course', otherCourse);
    // Both foreign keys are valid, but progress.course_id need not match lessons.course_id.
    complete('other-course', courseId);
    await expectProgress(courseId, 1, 0, 0);
  });

  it('preserves the existing lesson-only denominator rather than adding a parent-unit filter', async () => {
    seedCompletedLessons();
    run('UPDATE units SET is_published = 0, is_archived = 1 WHERE course_id = ?', courseId);
    await expectProgress(courseId, 2, 2, 100);
  });
});

describe('course progress access boundaries', () => {
  it('still requires authentication for enrolled courses and progress', async () => {
    for (const path of ['/me', '/enrolled/progress']) {
      const response = await request(path, null);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    }
  });

  it('does not list archived/foreign courses or expose another platform progress', async () => {
    addCourse('foreign', 1, 'other-platform');
    addCourse('archived', 1, platform, 1);
    for (const id of ['foreign', 'archived']) {
      run('INSERT INTO enrollments (id, student_id, course_id) VALUES (?, ?, ?)', `enrollment-${id}`, 'student', id);
    }
    const response = await request('/foreign/progress');
    expect(response.status).toBe(404);
    await expectProgress('enrolled', 0, 0, 0);
  });
});

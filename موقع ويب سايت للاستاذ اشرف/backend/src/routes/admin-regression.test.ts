import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import type { SQLInputValue } from 'node:sqlite';
import { Hono, type Context, type Next } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, Env, HonoBindings } from '../types';
import admin from './admin';

// Vite 5 predates node:sqlite; load the native module without its import resolver.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

// Replace authentication only; keep the real role and permission middleware.
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('../middleware/auth')>(),
  requireAuth: async (c: Context<HonoBindings>, next: Next) => {
    c.set('user', {
      id: 'caller',
      supabaseUserId: 'offline-caller',
      email: 'caller@example.test',
      fullName: 'Offline Caller',
      role: (c.req.header('X-Test-Role') || 'admin') as AuthUser['role'],
      status: 'active',
      maxDevices: 2,
    });
    await next();
  },
}));

class SQLiteStatement {
  constructor(
    private db: SQLiteD1,
    readonly sql: string,
    private values: SQLInputValue[] = [],
  ) {}

  bind(...values: SQLInputValue[]) {
    return new SQLiteStatement(this.db, this.sql, values);
  }

  async first<T>() {
    return (this.db.sqlite.prepare(this.sql).get(...this.values) ?? null) as T | null;
  }

  async all<T>() {
    return { success: true, results: this.db.sqlite.prepare(this.sql).all(...this.values) as T[] };
  }

  async run() {
    const beforeWrite = this.db.beforeWrite;
    this.db.beforeWrite = undefined;
    beforeWrite?.();
    this.db.writes.push(this.sql);
    const result = this.db.sqlite.prepare(this.sql).run(...this.values);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
}

// In-memory SQLite executes the actual route SQL. Batch uses a real transaction,
// not a mock that pretends a failed insert restored deleted rows.
class SQLiteD1 {
  readonly sqlite = new DatabaseSync(':memory:');
  readonly writes: string[] = [];
  beforeWrite?: () => void;

  prepare(sql: string) {
    return new SQLiteStatement(this, sql);
  }

  batch = vi.fn(async (statements: SQLiteStatement[]) => {
    this.sqlite.exec('BEGIN TRANSACTION');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      this.sqlite.exec('ROLLBACK');
      throw error;
    }
  });
}

function tableDDL(filename: string, table: string) {
  const sql = readFileSync(new URL(`../../migrations/${filename}`, import.meta.url), 'utf8');
  const ddl = sql.match(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table} \\([\\s\\S]*?\\n\\);`));
  if (!ddl) throw new Error(`Missing ${table} DDL in ${filename}`);
  return ddl[0];
}

const videoDDL = tableDDL('0016_remove_cloudflare_stream_provider.sql', 'lesson_videos');
const permissionsDDL = tableDDL('0002_rbac_device_requests_and_advanced_stats.sql', 'assistant_permissions');
const permissions = {
  can_reset_devices: true,
  can_grade_quizzes: false,
  can_answer_questions: true,
  can_manage_codes: false,
  can_manage_courses: true,
};

let db: SQLiteD1;
let app: Hono<HonoBindings>;
let errors: Error[];
let network: ReturnType<typeof vi.fn<[], never>>;

beforeEach(() => {
  network = vi.fn(() => { throw new Error('Network access is forbidden in this regression suite'); });
  vi.stubGlobal('fetch', network);
  db = new SQLiteD1();
  db.sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY, role TEXT NOT NULL, platform TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT 'Test User', phone TEXT DEFAULT ''
    );
    CREATE TABLE lessons (id TEXT PRIMARY KEY);
    CREATE TABLE courses (id TEXT PRIMARY KEY, title TEXT NOT NULL, platform TEXT NOT NULL);
    CREATE TABLE quizzes (
      id TEXT PRIMARY KEY, course_id TEXT NOT NULL REFERENCES courses(id),
      lesson_id TEXT REFERENCES lessons(id), title TEXT NOT NULL,
      max_score INTEGER NOT NULL DEFAULT 100, created_at TEXT NOT NULL DEFAULT '2026-01-01'
    );
    CREATE TABLE quiz_attempts (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES profiles(id),
      quiz_id TEXT NOT NULL REFERENCES quizzes(id), score REAL NOT NULL DEFAULT 0,
      is_submitted INTEGER NOT NULL DEFAULT 1 CHECK(is_submitted IN (0, 1)),
      UNIQUE(student_id, quiz_id)
    );
    ${videoDDL}
    ${permissionsDDL}
  `);
  errors = [];
  app = new Hono<HonoBindings>();
  app.route('/admin', admin);
  app.onError((error, c) => {
    errors.push(error);
    return c.json({ error: { code: 'INTERNAL_ERROR' } }, 500);
  });
});

afterEach(() => {
  db.sqlite.close();
  vi.unstubAllGlobals();
  expect(network).not.toHaveBeenCalled();
});

function request(path: string, method = 'GET', body?: unknown, platform?: string, role = 'admin') {
  return app.request(`/admin${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Test-Role': role },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }, {
    DB: db as unknown as Env['DB'],
    KV: { get: async () => null, put: async () => undefined } as unknown as Env['KV'],
    ...(platform === undefined ? {} : { PLATFORM_KEY: platform }),
  } as Env);
}

function rows(table: 'lesson_videos' | 'profiles' | 'assistant_permissions') {
  return db.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
}

function seedProfile(id: string, role = 'assistant', platform = 'fusha') {
  db.sqlite.prepare('INSERT INTO profiles (id, role, platform) VALUES (?, ?, ?)').run(id, role, platform);
}

function seedPermissions(id: string) {
  db.sqlite.prepare('INSERT INTO assistant_permissions (id, assistant_id) VALUES (?, ?)').run(`permissions-${id}`, id);
}

describe('admin video registration', () => {
  beforeEach(() => {
    db.sqlite.exec(`
      INSERT INTO lessons (id) VALUES ('lesson-a'), ('lesson-b');
      INSERT INTO lesson_videos (id, lesson_id, provider, status, stream_uid, sort_order)
      VALUES ('old-a', 'lesson-a', 'r2_hls', 'ready', 'old/a', 0),
             ('old-b', 'lesson-a', 'r2', 'ready', 'old/b', 1),
             ('unrelated', 'lesson-b', 'youtube', 'ready', NULL, 0);
    `);
  });

  it.each(['pending', 'unknown', null])('rejects status %s without deleting existing videos', async (status) => {
    const before = rows('lesson_videos');
    const response = await request('/lessons/lesson-a/videos', 'POST', { status });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(rows('lesson_videos')).toEqual(before);
    expect(db.writes).toEqual([]);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it.each(['uploading', 'processing', 'ready', 'error'])('accepts DB status %s and atomically replaces only this lesson', async (status) => {
    const unrelated = rows('lesson_videos').find((row) => row.id === 'unrelated');
    const response = await request('/lessons/lesson-a/videos', 'POST', {
      provider: 'r2_hls', status, stream_uid: 'new/video', require_drm: false,
    });
    expect(response.status).toBe(201);
    const video = await response.json();
    expect(video).toMatchObject({ lesson_id: 'lesson-a', status, stream_uid: 'new/video', require_drm: 0 });
    expect(rows('lesson_videos')).toHaveLength(2);
    expect(rows('lesson_videos')).toContainEqual(video);
    expect(rows('lesson_videos')).toContainEqual(unrelated);
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.batch.mock.calls[0][0]).toHaveLength(2);
    expect(db.writes[0]).toMatch(/^DELETE FROM lesson_videos/);
    expect(db.writes[1]).toMatch(/^INSERT INTO lesson_videos/);
    expect(errors).toEqual([]);
  });

  it('keeps the existing ready/default-provider/default-DRM behavior', async () => {
    const response = await request('/lessons/lesson-a/videos', 'POST', {});
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ provider: 'r2_hls', status: 'ready', require_drm: 1 });
  });

  it('rolls back the real SQLite delete when the replacement insert fails', async () => {
    const before = rows('lesson_videos');
    db.sqlite.exec(`
      CREATE TRIGGER fail_video_replacement BEFORE INSERT ON lesson_videos
      WHEN NEW.lesson_id = 'lesson-a'
      BEGIN
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM lesson_videos WHERE lesson_id = 'lesson-a')
          THEN RAISE(ABORT, 'delete did not execute')
          ELSE RAISE(ABORT, 'forced video insert failure')
        END;
      END;
    `);
    const response = await request('/lessons/lesson-a/videos', 'POST', { status: 'uploading' });
    expect(response.status).toBe(500);
    expect(errors.map((error) => error.message)).toEqual(['forced video insert failure']);
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.writes).toHaveLength(2);
    expect(rows('lesson_videos')).toEqual(before);

    db.sqlite.exec('DROP TRIGGER fail_video_replacement');
    expect((await request('/lessons/lesson-a/videos', 'POST', { status: 'uploading' })).status).toBe(201);
  });
});

describe.each([
  { label: 'configured platform', configured: 'legacy-tenant', platform: 'legacy-tenant', foreign: 'fusha' },
  { label: 'default platform', configured: undefined, platform: 'fusha', foreign: 'legacy-tenant' },
])('assistant target isolation: $label', ({ configured, platform, foreign }) => {
  beforeEach(() => {
    seedProfile('target', 'assistant', platform);
    seedProfile('foreign', 'assistant', foreign);
    seedProfile('student', 'student', platform);
    seedProfile('admin', 'admin', platform);
  });

  it.each([false, true])('PATCH supports same-platform assistant (existing permissions: %s)', async (existing) => {
    if (existing) seedPermissions('target');
    seedPermissions('foreign');
    const profilesBefore = rows('profiles');
    const foreignBefore = rows('assistant_permissions').find((row) => row.assistant_id === 'foreign');
    const response = await request('/assistants/target', 'PATCH', { permissions }, configured);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(rows('profiles')).toEqual(profilesBefore);
    expect(rows('assistant_permissions')).toContainEqual(foreignBefore);
    expect(rows('assistant_permissions').find((row) => row.assistant_id === 'target')).toMatchObject({
      assistant_id: 'target', can_reset_devices: 1, can_grade_quizzes: 0,
      can_answer_questions: 1, can_manage_codes: 0, can_manage_courses: 1,
      ...(existing ? { id: 'permissions-target' } : {}),
    });
    expect(errors).toEqual([]);
  });

  it.each([
    ['foreign', false], ['foreign', true], ['student', false], ['student', true],
    ['admin', false], ['admin', true], ['missing', false],
  ] as const)('PATCH rejects %s (existing permissions: %s) without mutation', async (id, existing) => {
    if (existing) seedPermissions(id);
    const profilesBefore = rows('profiles');
    const permissionsBefore = rows('assistant_permissions');
    const response = await request(`/assistants/${id}`, 'PATCH', { permissions }, configured);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    expect(rows('profiles')).toEqual(profilesBefore);
    expect(rows('assistant_permissions')).toEqual(permissionsBefore);
    expect(errors).toEqual([]);
  });

  it.each([false, true])('DELETE supports same-platform assistant (existing permissions: %s)', async (existing) => {
    if (existing) seedPermissions('target');
    seedPermissions('foreign');
    const profilesBefore = rows('profiles');
    const foreignBefore = rows('assistant_permissions').find((row) => row.assistant_id === 'foreign');
    const response = await request('/assistants/target', 'DELETE', undefined, configured);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(rows('profiles')).toEqual(profilesBefore.filter((row) => row.id !== 'target'));
    expect(rows('assistant_permissions')).toEqual([foreignBefore]);
    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([]);
  });

  it.each(['foreign', 'student', 'admin', 'missing'])('DELETE rejects %s without touching profile or permissions', async (id) => {
    if (id !== 'missing') seedPermissions(id);
    const profilesBefore = rows('profiles');
    const permissionsBefore = rows('assistant_permissions');
    const response = await request(`/assistants/${id}`, 'DELETE', undefined, configured);
    expect(response.status).toBe(404);
    expect(rows('profiles')).toEqual(profilesBefore);
    expect(rows('assistant_permissions')).toEqual(permissionsBefore);
    expect(errors).toEqual([]);
  });

  it.each([
    ['PATCH', 'role', false], ['PATCH', 'role', true],
    ['PATCH', 'platform', false], ['PATCH', 'platform', true],
    ['DELETE', 'role', true], ['DELETE', 'platform', true],
  ] as const)('%s rechecks %s at write time (existing permissions: %s)', async (method, field, existing) => {
    if (existing) seedPermissions('target');
    const permissionsBefore = rows('assistant_permissions');
    const newValue = field === 'role' ? 'student' : foreign;
    let changedAtWrite = false;
    db.beforeWrite = () => {
      // Simulate a target that stops qualifying after any preflight but before SQL execution.
      db.sqlite.prepare(`UPDATE profiles SET ${field} = ? WHERE id = 'target'`).run(newValue);
      changedAtWrite = true;
    };
    const response = await request('/assistants/target', method, method === 'PATCH' ? { permissions } : undefined, configured);
    expect(changedAtWrite).toBe(true);
    expect(response.status).toBe(404);
    expect(rows('assistant_permissions')).toEqual(permissionsBefore);
    expect(rows('profiles').find((row) => row.id === 'target')).toMatchObject({ id: 'target', [field]: newValue });
    expect(errors).toEqual([]);
  });
});

describe('assistant management caller roles', () => {
  it.each([
    ['PATCH', 'assistant'], ['DELETE', 'assistant'],
    ['PATCH', 'student'], ['DELETE', 'student'],
  ])('keeps %s admin-only for %s callers', async (method, role) => {
    seedProfile('target');
    seedPermissions('target');
    const profilesBefore = rows('profiles');
    const permissionsBefore = rows('assistant_permissions');
    const response = await request('/assistants/target', method, method === 'PATCH' ? { permissions } : undefined, undefined, role);
    expect(response.status).toBe(403);
    expect(rows('profiles')).toEqual(profilesBefore);
    expect(rows('assistant_permissions')).toEqual(permissionsBefore);
    expect(db.writes).toEqual([]);
  });
});

describe.each([undefined, 'legacy-tenant'])('standalone grade sheet (platform: %s)', (configured) => {
  it('keeps unfinished/missing grades null, submitted zero 0, and totals submitted scores only', async () => {
    const platform = configured || 'fusha';
    seedProfile('student', 'student', platform);
    seedProfile('foreign-student', 'student', 'foreign-platform');
    db.sqlite.prepare('INSERT INTO courses (id, title, platform) VALUES (?, ?, ?)').run('course', 'Test Course', platform);
    db.sqlite.exec(`
      INSERT INTO courses (id, title, platform) VALUES ('foreign-course', 'Foreign Course', 'foreign-platform');
      INSERT INTO lessons (id) VALUES ('lesson');
      INSERT INTO quizzes (id, course_id, lesson_id, title) VALUES
        ('unfinished-zero', 'course', NULL, 'Unfinished Zero'),
        ('unfinished-positive', 'course', NULL, 'Unfinished Positive'),
        ('submitted-zero', 'course', NULL, 'Submitted Zero'),
        ('submitted-positive', 'course', NULL, 'Submitted Positive'),
        ('missing', 'course', NULL, 'Not Started'),
        ('lesson-quiz', 'course', 'lesson', 'Lesson Quiz'),
        ('foreign-exam', 'foreign-course', NULL, 'Foreign Exam');
      INSERT INTO quiz_attempts (id, student_id, quiz_id, score, is_submitted) VALUES
        ('a1', 'student', 'unfinished-zero', 0, 0),
        ('a2', 'student', 'unfinished-positive', 90, 0),
        ('a3', 'student', 'submitted-zero', 0, 1),
        ('a4', 'student', 'submitted-positive', 12.5, 1),
        ('a5', 'student', 'lesson-quiz', 100, 1),
        ('a6', 'foreign-student', 'foreign-exam', 100, 1);
    `);
    const response = await request('/exams/grades', 'GET', undefined, configured);
    expect(response.status).toBe(200);
    const data = await response.json() as {
      exams: { id: string }[];
      students: { student_id: string; grades: Record<string, number | null>; total_score: number }[];
    };
    expect(data.exams.map((exam) => exam.id).sort()).toEqual([
      'missing', 'submitted-positive', 'submitted-zero', 'unfinished-positive', 'unfinished-zero',
    ]);
    expect(data.students).toHaveLength(1);
    expect(data.students[0]).toMatchObject({
      student_id: 'student',
      grades: {
        'unfinished-zero': null, 'unfinished-positive': null, 'submitted-zero': 0,
        'submitted-positive': 12.5, missing: null,
      },
      total_score: 12.5,
    });
    expect(db.writes).toEqual([]);
    expect(errors).toEqual([]);
  });
});

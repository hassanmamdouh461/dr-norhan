import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { Miniflare } from 'miniflare';
import type { Env, HonoBindings } from '../types';
import codes from './codes';

// The existing codes.test.ts exercises real authentication. These tests isolate the
// redemption route, but every SQL statement and transaction runs in real Miniflare D1.
vi.mock('../middleware/auth', () => {
  const nextOnly: MiddlewareHandler<HonoBindings> = async (_c, next) => { await next(); };
  const requireAuth: MiddlewareHandler<HonoBindings> = async (c, next) => {
    c.set('user', {
      id: c.req.header('X-Test-Student') || 'student-1',
      supabaseUserId: 'fixture', email: 'student@example.test', role: 'student',
      status: 'active', fullName: 'Fixture Student', maxDevices: 2,
    });
    await next();
  };
  return { requireAuth, requireTrustedDevice: nextOnly, rateLimit: () => nextOnly, audit: () => nextOnly };
});

const platform = 'alhadaba-chemistry';
const otherPlatform = 'other-platform';
const app = new Hono<HonoBindings>().route('/codes', codes);
const blockedFetch = vi.fn(async () => { throw new Error('Unexpected outbound request in atomic redemption tests'); });
let mf: Miniflare;
let db: D1Database;

beforeAll(async () => {
  vi.stubGlobal('fetch', blockedFetch);
  mf = new Miniflare({
    script: 'export default { fetch() { return new Response("fixture"); } }',
    modules: true, host: '127.0.0.1', cf: false, outboundService: blockedFetch,
    d1Databases: ['DB'], d1Persist: false,
  });
  db = await mf.getD1Database('DB') as unknown as D1Database;
  // An isolated in-memory fixture reproduces the relevant production columns,
  // foreign keys, status checks, and unique enrollment key; no user DB is opened.
  const schema = [
    `CREATE TABLE profiles (id TEXT PRIMARY KEY, role TEXT NOT NULL DEFAULT 'student',
      status TEXT NOT NULL DEFAULT 'active', platform TEXT NOT NULL)`,
    `CREATE TABLE courses (id TEXT PRIMARY KEY, platform TEXT NOT NULL,
      is_published INTEGER NOT NULL DEFAULT 1, is_archived INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE code_batches (id TEXT PRIMARY KEY, platform TEXT NOT NULL, access_days INTEGER)`,
    `CREATE TABLE bundles (id TEXT PRIMARY KEY, platform TEXT NOT NULL)`,
    `CREATE TABLE bundle_courses (bundle_id TEXT NOT NULL REFERENCES bundles(id),
      course_id TEXT NOT NULL REFERENCES courses(id), platform TEXT NOT NULL, PRIMARY KEY(bundle_id, course_id))`,
    `CREATE TABLE activation_codes (
      id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, batch_id TEXT NOT NULL REFERENCES code_batches(id),
      scope_type TEXT NOT NULL CHECK(scope_type IN ('course','bundle','all')), course_id TEXT REFERENCES courses(id),
      bundle_id TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','expired','revoked')),
      max_uses INTEGER NOT NULL DEFAULT 10, used_count INTEGER NOT NULL DEFAULT 0,
      used_by TEXT REFERENCES profiles(id), used_at TEXT, valid_from TEXT, expires_at TEXT,
      access_days INTEGER, platform TEXT NOT NULL)`,
    `CREATE TABLE enrollments (
      id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      source TEXT NOT NULL DEFAULT 'code' CHECK(source IN ('code','manual','free')),
      code_id TEXT REFERENCES activation_codes(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','expired','revoked')),
      platform TEXT NOT NULL, granted_at TEXT NOT NULL DEFAULT '2000-01-01T00:00:00Z',
      expires_at TEXT, created_at TEXT NOT NULL DEFAULT '2000-01-01T00:00:00Z', UNIQUE(student_id, course_id))`,
  ];
  await db.batch(schema.map(sql => db.prepare(sql)));
}, 30000);

afterAll(async () => {
  try {
    await mf?.dispose();
    expect(blockedFetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

beforeEach(async () => {
  const reset = [
    'DROP TRIGGER IF EXISTS force_fail',
    'DELETE FROM enrollments', 'DELETE FROM activation_codes', 'DELETE FROM bundle_courses',
    'DELETE FROM bundles', 'DELETE FROM code_batches', 'DELETE FROM courses', 'DELETE FROM profiles',
  ];
  await db.batch(reset.map(sql => db.prepare(sql)));
  await db.batch([
    ...Array.from({ length: 12 }, (_, i) => db.prepare('INSERT INTO profiles (id, platform) VALUES (?, ?)')
      .bind(`student-${i + 1}`, platform)),
    db.prepare('INSERT INTO profiles (id, platform) VALUES (?, ?)').bind('foreign-student', otherPlatform),
    ...['course-1', 'course-2', 'course-3', 'unpublished', 'archived'].map(id =>
      db.prepare('INSERT INTO courses (id, platform) VALUES (?, ?)').bind(id, platform)),
    db.prepare('INSERT INTO courses (id, platform) VALUES (?, ?)').bind('foreign-course', otherPlatform),
    db.prepare("UPDATE courses SET is_published = 0 WHERE id = 'unpublished'"),
    db.prepare("UPDATE courses SET is_archived = 1 WHERE id = 'archived'"),
    db.prepare("INSERT INTO code_batches (id, platform, access_days) VALUES ('batch-1', ?, 30)").bind(platform),
    db.prepare("INSERT INTO bundles (id, platform) VALUES ('bundle-1', ?)").bind(platform),
    ...['course-1', 'course-2', 'course-3'].map(id => db.prepare(
      "INSERT INTO bundle_courses (bundle_id, course_id, platform) VALUES ('bundle-1', ?, ?)"
    ).bind(id, platform)),
    db.prepare(`INSERT INTO activation_codes (id, code, batch_id, scope_type, course_id, platform)
      VALUES ('code-1', 'ATOMIC-CODE', 'batch-1', 'course', 'course-1', ?)`).bind(platform),
    db.prepare(`INSERT INTO activation_codes
      (id, code, batch_id, scope_type, course_id, platform, status, used_count, used_by, used_at)
      VALUES ('observer', 'OBSERVER', 'batch-1', 'course', 'course-2', ?, 'revoked', 2, 'student-2', '2001-01-01T00:00:00Z')`).bind(platform),
  ]);
});

async function run(sql: string, ...args: (string | number | null)[]) {
  return db.prepare(sql).bind(...args).run();
}

async function codeState() {
  return db.prepare("SELECT * FROM activation_codes WHERE id = 'code-1'").first<Record<string, unknown>>();
}

async function snapshot() {
  const [codeRows, enrollmentRows] = await db.batch([
    db.prepare('SELECT * FROM activation_codes ORDER BY id'),
    db.prepare('SELECT * FROM enrollments ORDER BY id'),
  ]);
  return { codes: codeRows.results, enrollments: enrollmentRows.results };
}

function inspectDatabase(beforeBatch?: () => Promise<void>, afterFailure?: () => Promise<void>) {
  const queries: string[] = [];
  const batches: D1Result[][] = [];
  let batchCalls = 0;
  const database = {
    prepare(sql: string) { queries.push(sql); return db.prepare(sql); },
    async batch(statements: D1PreparedStatement[]) {
      batchCalls++;
      await beforeBatch?.();
      try {
        const result = await db.batch(statements);
        batches.push(result);
        return result;
      } catch (error) {
        await afterFailure?.();
        throw error;
      }
    },
  } as unknown as Env['DB'];
  return { database, queries, batches, get batchCalls() { return batchCalls; } };
}

async function redeem(options: { student?: string; course?: string; database?: Env['DB']; code?: string; rawBody?: string } = {}) {
  const response = await app.request('http://localhost/codes/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Student': options.student || 'student-1' },
    body: options.rawBody ?? JSON.stringify({ code: options.code || 'ATOMIC-CODE', course_id: options.course }),
  }, { DB: options.database || db, PLATFORM_KEY: platform } as Env);
  return { status: response.status, body: await response.json() as {
    ok?: boolean; enrolled_courses?: number; course_ids?: string[]; expires_at?: string | null;
    error?: { code: string; message: string };
  } };
}

function expectError(result: Awaited<ReturnType<typeof redeem>>, code: string, status = 400) {
  expect(result.status).toBe(status);
  expect(result.body).toEqual({ error: { code, message: expect.any(String) } });
}

async function enrollment(course: string, status: string, expiresAt: string | null, tenant = platform) {
  await run(`INSERT INTO enrollments
    (id, student_id, course_id, source, code_id, status, platform, expires_at)
    VALUES (?, 'student-1', ?, 'manual', 'observer', ?, ?, ?)`,
  `existing-${course}`, course, status, tenant, expiresAt);
}

async function bundle() {
  await run("UPDATE activation_codes SET scope_type = 'bundle', bundle_id = 'bundle-1', course_id = NULL WHERE id = 'code-1'");
}

function barrier(count: number) {
  let arrived = 0;
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  return async () => { if (++arrived === count) release(); await ready; };
}

describe('Redemption request validation', () => {
  it.each([
    ['empty body', ''],
    ['malformed JSON', '{"code":'],
    ['null body', 'null'],
    ['array body', '[]'],
    ['string body', '"ATOMIC-CODE"'],
    ['missing code', '{}'],
    ['null code', '{"code":null}'],
    ['numeric code', '{"code":123}'],
    ['boolean code', '{"code":true}'],
    ['object code', '{"code":{}}'],
    ['array code', '{"code":["ATOMIC-CODE"]}'],
    ['empty code', '{"code":""}'],
    ['whitespace code', JSON.stringify({ code: ' \t\n ' })],
    ['numeric course', '{"code":"ATOMIC-CODE","course_id":123}'],
    ['boolean course', '{"code":"ATOMIC-CODE","course_id":false}'],
    ['object course', '{"code":"ATOMIC-CODE","course_id":{}}'],
    ['array course', '{"code":"ATOMIC-CODE","course_id":["course-1"]}'],
  ])('returns a structured 400 for %s before redemption SQL', async (_name, rawBody) => {
    const before = await snapshot();
    const inspected = inspectDatabase();
    expectError(await redeem({ rawBody, database: inspected.database }), 'BAD_REQUEST');
    expect(inspected.queries).toEqual([]);
    expect(inspected.batchCalls).toBe(0);
    expect(await snapshot()).toEqual(before);
  });

  it.each([undefined, null, '', 'course-1'])('preserves normalization and optional course %s', async course => {
    const result = await redeem({ rawBody: JSON.stringify({ code: '  atOmic- coDe \t', course_id: course }) });
    expect(result.status).toBe(200);
    expect(result.body.course_ids).toEqual(['course-1']);
    expect((await codeState())?.used_count).toBe(1);
  });
});

describe('Miniflare D1 changes() and atomic redemption', () => {
  it('preserves changes() through real D1 bookkeeping and SELECT, including a zero-row INSERT', async () => {
    const insert = `INSERT INTO enrollments (id, student_id, course_id, platform)
      SELECT id, 'student-1', id, platform FROM courses WHERE id IN ('course-1','course-2')
      RETURNING course_id`;
    const result = await db.batch([
      db.prepare(insert),
      db.prepare('SELECT changes() AS inserted'),
      db.prepare("UPDATE activation_codes SET used_count = used_count + 1 WHERE id = 'code-1' AND changes() > 0"),
      db.prepare('SELECT changes() AS updated'),
    ]);
    expect(result[0].results).toHaveLength(2);
    expect(result[1].results).toEqual([{ inserted: 2 }]);
    expect(result[2].meta.changes).toBe(1);
    expect(result[3].results).toEqual([{ updated: 1 }]);
    expect((await codeState())?.used_count).toBe(1);
    const noop = await db.batch([
      db.prepare(insert.replace("id IN ('course-1','course-2')", '0')),
      db.prepare('SELECT changes() AS inserted'),
      db.prepare("UPDATE activation_codes SET used_count = used_count + 1 WHERE id = 'code-1' AND changes() > 0"),
    ]);
    expect(noop[1].results).toEqual([{ inserted: 0 }]);
    expect(noop[2].meta.changes).toBe(0);
    expect((await codeState())?.used_count).toBe(1);
  });

  it('returns exactly the inserted bundle IDs and increments usage once in one three-statement batch', async () => {
    await bundle();
    const inspected = inspectDatabase();
    const result = await redeem({ course: 'course-2', database: inspected.database });
    expect(result.status).toBe(200);
    expect(result.body.course_ids?.sort()).toEqual(['course-1', 'course-2', 'course-3']);
    expect(result.body.enrolled_courses).toBe(3);
    expect(inspected.batchCalls).toBe(1);
    expect(inspected.queries).toHaveLength(4);
    expect(inspected.queries[1]).toContain('ON CONFLICT(student_id, course_id)');
    expect(inspected.queries[2]).toContain('AND changes() > 0');
    expect(inspected.batches[0]).toHaveLength(3);
    expect(inspected.batches[0][0].meta.changes).toBe(3);
    expect(inspected.batches[0][1].meta.changes).toBe(1);
    expect((await codeState())?.used_count).toBe(1);
    const rows = await db.prepare('SELECT id, course_id, expires_at FROM enrollments').all();
    expect(new Set(rows.results.map(row => row.id)).size).toBe(3);
    expect(rows.results.map(row => row.expires_at)).toEqual(Array(3).fill(result.body.expires_at));
    const beforeRetry = await snapshot();
    expectError(await redeem(), 'ALREADY_ENROLLED');
    expect(await snapshot()).toEqual(beforeRetry);
  });

  it('returns only newly granted IDs from a partially enrolled bundle', async () => {
    await bundle();
    await enrollment('course-1', 'active', null);
    const retained = await db.prepare("SELECT * FROM enrollments WHERE course_id = 'course-1'").first();
    const result = await redeem({ course: 'course-1' });
    expect(result.status).toBe(200);
    expect(result.body.course_ids?.sort()).toEqual(['course-2', 'course-3']);
    expect(result.body.enrolled_courses).toBe(2);
    expect(await db.prepare("SELECT * FROM enrollments WHERE course_id = 'course-1'").first()).toEqual(retained);
    expect((await codeState())?.used_count).toBe(1);
  });

  it('serializes duplicate simultaneous requests without wasting multi-use capacity', async () => {
    await bundle();
    const inspected = inspectDatabase(barrier(8));
    const results = await Promise.all(Array.from({ length: 8 }, () => redeem({ database: inspected.database })));
    expect(results.filter(result => result.status === 200)).toHaveLength(1);
    results.filter(result => result.status !== 200).forEach(result => expectError(result, 'ALREADY_ENROLLED'));
    expect(inspected.batches.map(batch => batch[1].meta.changes).sort()).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect((await codeState())?.used_count).toBe(1);
    expect((await snapshot()).enrollments).toHaveLength(3);
  });

  it('charges only the final remaining use for duplicate concurrent renewal requests', async () => {
    await bundle();
    await enrollment('course-1', 'expired', null);
    await enrollment('course-2', 'revoked', null);
    await run("UPDATE activation_codes SET used_count = max_uses - 1 WHERE id = 'code-1'");
    const inspected = inspectDatabase(barrier(8));
    const results = await Promise.all(Array.from({ length: 8 }, () => redeem({ database: inspected.database })));
    const successes = results.filter(result => result.status === 200);
    expect(successes).toHaveLength(1);
    expect(successes[0].body.course_ids?.sort()).toEqual(['course-1', 'course-2', 'course-3']);
    results.filter(result => result.status !== 200).forEach(result => expectError(result, 'CODE_INVALID'));
    expect(inspected.batches.map(batch => batch[0].meta.changes).sort()).toEqual([0, 0, 0, 0, 0, 0, 0, 3]);
    expect(inspected.batches.map(batch => batch[1].meta.changes).sort()).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(await codeState()).toMatchObject({ used_count: 10, status: 'used', used_by: 'student-1' });
    expect((await snapshot()).enrollments).toHaveLength(3);
  });

  it.each([1, 3])('grants exactly %i remaining uses of a previously used code to concurrent students', async remaining => {
    await bundle();
    await run("UPDATE activation_codes SET used_count = max_uses - ? WHERE id = 'code-1'", remaining);
    const inspected = inspectDatabase(barrier(8));
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      redeem({ student: `student-${i + 1}`, database: inspected.database })));
    expect(results.filter(result => result.status === 200)).toHaveLength(remaining);
    for (const [i, result] of results.entries()) {
      const rows = await db.prepare('SELECT course_id FROM enrollments WHERE student_id = ? ORDER BY course_id')
        .bind(`student-${i + 1}`).all<{ course_id: string }>();
      if (result.status === 200) {
        expect(result.body.course_ids?.sort()).toEqual(['course-1', 'course-2', 'course-3']);
        expect(result.body.enrolled_courses).toBe(3);
        expect(rows.results.map(row => row.course_id)).toEqual(result.body.course_ids);
      } else {
        expectError(result, 'CODE_INVALID');
        expect(rows.results).toEqual([]);
      }
    }
    expect(inspected.batches.filter(batch => batch[1].meta.changes === 1)).toHaveLength(remaining);
    expect(await codeState()).toMatchObject({ used_count: 10, status: 'used' });
    expect((await snapshot()).enrollments).toHaveLength(3 * remaining);
  });

  it.each([1, 3, 8])('never oversubscribes capacity %i under simultaneous distinct-student bundle requests', async capacity => {
    await bundle();
    await run("UPDATE activation_codes SET max_uses = ? WHERE id = 'code-1'", capacity);
    const inspected = inspectDatabase(barrier(8));
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) =>
      redeem({ student: `student-${i + 1}`, database: inspected.database })));
    const successes = results.filter(result => result.status === 200);
    expect(successes).toHaveLength(capacity);
    successes.forEach(result => {
      expect(result.body.enrolled_courses).toBe(3);
      expect(result.body.course_ids?.sort()).toEqual(['course-1', 'course-2', 'course-3']);
    });
    results.filter(result => result.status !== 200).forEach(result => expectError(result, 'CODE_INVALID'));
    expect(await codeState()).toMatchObject({ used_count: capacity, status: 'used' });
    expect((await snapshot()).enrollments).toHaveLength(3 * capacity);
  });

  it.each(['insert', 'counter'])('rolls back all enrollments, code metadata, and trigger side effects after a failed %s', async failure => {
    await bundle();
    await run("UPDATE activation_codes SET used_count = 2, used_by = 'student-2', used_at = '2002-01-01T00:00:00Z' WHERE id = 'code-1'");
    if (failure === 'counter') {
      await enrollment('course-1', 'active', '2000-01-01T00:00:00Z');
      await enrollment('course-2', 'revoked', null);
    }
    const before = await snapshot();
    const trigger = failure === 'insert'
      ? `BEFORE INSERT ON enrollments WHEN (SELECT COUNT(*) FROM enrollments WHERE student_id = NEW.student_id) > 0`
      : `BEFORE UPDATE OF used_count ON activation_codes WHEN NEW.id = 'code-1'`;
    await run(`CREATE TRIGGER force_fail ${trigger} BEGIN
      UPDATE activation_codes SET status = 'active', used_count = 9 WHERE id = 'observer';
      SELECT RAISE(FAIL, 'Forced atomic rollback'); END`);
    const inspected = inspectDatabase();
    expectError(await redeem({ database: inspected.database }), 'ENROLLMENT_FAILED', 500);
    expect(inspected.batchCalls).toBe(1);
    expect(inspected.queries).toHaveLength(4);
    expect(await snapshot()).toEqual(before);
  });

  it('does not compensate over a revocation committed immediately after a failed batch', async () => {
    await run(`CREATE TRIGGER force_fail BEFORE INSERT ON enrollments BEGIN
      SELECT RAISE(FAIL, 'Forced insert failure'); END`);
    const inspected = inspectDatabase(undefined, async () => {
      await run("UPDATE activation_codes SET status = 'revoked', used_by = 'student-2', used_at = '2003-01-01T00:00:00Z' WHERE id = 'code-1'");
    });
    expectError(await redeem({ database: inspected.database }), 'ENROLLMENT_FAILED', 500);
    expect(await codeState()).toMatchObject({ status: 'revoked', used_count: 0, used_by: 'student-2', used_at: '2003-01-01T00:00:00Z' });
    expect((await snapshot()).enrollments).toEqual([]);
  });
});

describe('Live eligibility, not preflight snapshots', () => {
  it.each([
    ['revocation', "status = 'revoked'", 'CODE_INVALID'],
    ['expiry with SQLite date format', "expires_at = datetime('now', '-1 minute')", 'CODE_EXPIRED'],
    ['expiry with a positive timezone offset', "expires_at = strftime('%Y-%m-%dT%H:%M:%S', 'now', '+1 hour') || '+02:00'", 'CODE_EXPIRED'],
    ['malformed expiry', "expires_at = 'invalid-date'", 'CODE_EXPIRED'],
    ['full capacity', 'used_count = max_uses', 'CODE_USED'],
    ['future validity', "valid_from = datetime('now', '+1 day')", 'CODE_INVALID'],
    ['code tenant change', "platform = 'other-platform'", 'CODE_NOT_FOUND'],
  ])('rejects a live %s change without writes or status rewrites', async (_name, mutation, error) => {
    let expected: Awaited<ReturnType<typeof snapshot>>;
    const inspected = inspectDatabase(async () => {
      await run(`UPDATE activation_codes SET ${mutation} WHERE id = 'code-1'`);
      expected = await snapshot();
    });
    expectError(await redeem({ database: inspected.database }), error, error === 'CODE_NOT_FOUND' ? 404 : 400);
    expect(inspected.batches[0][0].meta.changes).toBe(0);
    expect(inspected.batches[0][1].meta.changes).toBe(0);
    expect(await snapshot()).toEqual(expected!);
  });

  it('uses the live course scope and denies a now-mismatched requested course', async () => {
    const inspected = inspectDatabase(async () => {
      await run("UPDATE activation_codes SET course_id = 'course-2' WHERE id = 'code-1'");
    });
    expectError(await redeem({ course: 'course-1', database: inspected.database }), 'CODE_SCOPE_MISMATCH');
    expect((await snapshot()).enrollments).toEqual([]);
    expect((await codeState())?.used_count).toBe(0);
  });

  it('uses live scope and access days instead of stale target and expiry calculations', async () => {
    const inspected = inspectDatabase(async () => {
      await bundle();
      await run("UPDATE activation_codes SET access_days = 7 WHERE id = 'code-1'");
      await run("DELETE FROM bundle_courses WHERE course_id = 'course-3'");
    });
    const result = await redeem({ database: inspected.database });
    expect(result.status).toBe(200);
    expect(result.body.course_ids?.sort()).toEqual(['course-1', 'course-2']);
    const duration = await db.prepare('SELECT julianday(expires_at) - julianday(granted_at) AS days FROM enrollments').all();
    expect(duration.results).toEqual([{ days: 7 }, { days: 7 }]);
  });

  it.each(['bundle', 'all'])('checks requested-course membership live for %s scope', async scope => {
    if (scope === 'bundle') await bundle();
    else await run("UPDATE activation_codes SET scope_type = 'all', course_id = NULL WHERE id = 'code-1'");
    const inspected = inspectDatabase(async () => {
      if (scope === 'bundle') await run("DELETE FROM bundle_courses WHERE course_id = 'course-1'");
      else await run("UPDATE courses SET is_published = 0 WHERE id = 'course-1'");
    });
    expectError(await redeem({ course: 'course-1', database: inspected.database }), 'CODE_SCOPE_MISMATCH');
    expect((await snapshot()).enrollments).toEqual([]);
    expect((await codeState())?.used_count).toBe(0);
  });

  it('rechecks an enrollment activated after the lookup and does not consume usage', async () => {
    const inspected = inspectDatabase(async () => { await enrollment('course-1', 'active', null); });
    expectError(await redeem({ database: inspected.database }), 'ALREADY_ENROLLED');
    expect((await codeState())?.used_count).toBe(0);
    expect((await snapshot()).enrollments).toMatchObject([{ id: 'existing-course-1', code_id: 'observer', source: 'manual' }]);
  });

  it.each(['course', 'bundle', 'all'])('never returns a zero-course success for an empty %s scope', async scope => {
    if (scope === 'course') await run("UPDATE activation_codes SET course_id = NULL WHERE id = 'code-1'");
    if (scope === 'bundle') { await bundle(); await run('DELETE FROM bundle_courses'); }
    if (scope === 'all') {
      await run("UPDATE activation_codes SET scope_type = 'all' WHERE id = 'code-1'");
      await run('UPDATE courses SET is_published = 0');
    }
    const before = await snapshot();
    expectError(await redeem(), 'NO_COURSES');
    expect(await snapshot()).toEqual(before);
  });
});

describe('Enrollment renewal and tenant isolation', () => {
  it.each([
    ['active', '2000-01-01 00:00:00'],
    ['active', '2000-01-01T00:00:00Z'],
    ['expired', null],
    ['revoked', '2999-01-01T00:00:00Z'],
  ])('reactivates %s enrollment expiring at %s, preserving its identity and creation time', async (status, expiresAt) => {
    await enrollment('course-1', status!, expiresAt);
    const inspected = inspectDatabase();
    const result = await redeem({ database: inspected.database });
    expect(result.status).toBe(200);
    expect(inspected.batches[0][0].meta.changes).toBe(1);
    expect(inspected.batches[0][1].meta.changes).toBe(1);
    expect(result.body.course_ids).toEqual(['course-1']);
    expect((await snapshot()).enrollments).toEqual([expect.objectContaining({
      id: 'existing-course-1', source: 'code', code_id: 'code-1', status: 'active',
      created_at: '2000-01-01T00:00:00Z', expires_at: result.body.expires_at, platform,
    })]);
    expect((await codeState())?.used_count).toBe(1);
    const after = await snapshot();
    expectError(await redeem(), 'ALREADY_ENROLLED');
    expect(await snapshot()).toEqual(after);
  });

  it.each([null, '2999-01-01 00:00:00', '2999-01-01T00:00:00Z'])('does not renew or consume for an active enrollment expiring at %s', async expiresAt => {
    await enrollment('course-1', 'active', expiresAt);
    const before = await snapshot();
    expectError(await redeem(), 'ALREADY_ENROLLED');
    expect(await snapshot()).toEqual(before);
  });

  it('does not treat malformed active enrollment expiry as an actually expired or valid enrollment', async () => {
    await enrollment('course-1', 'active', 'not-a-date');
    const before = await snapshot();
    expectError(await redeem(), 'CODE_INVALID');
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    ['course', "UPDATE courses SET platform = 'other-platform' WHERE id = 'course-1'", 'NO_COURSES', 400],
    ['bundle', "UPDATE bundles SET platform = 'other-platform' WHERE id = 'bundle-1'", 'NO_COURSES', 400],
    ['bundle membership', "UPDATE bundle_courses SET platform = 'other-platform'", 'NO_COURSES', 400],
    ['batch', "UPDATE code_batches SET platform = 'other-platform' WHERE id = 'batch-1'", 'CODE_NOT_FOUND', 404],
    ['profile', "UPDATE profiles SET platform = 'other-platform' WHERE id = 'student-1'", 'FORBIDDEN', 403],
    ['blocked profile', "UPDATE profiles SET status = 'blocked' WHERE id = 'student-1'", 'FORBIDDEN', 403],
    ['non-student profile', "UPDATE profiles SET role = 'admin' WHERE id = 'student-1'", 'FORBIDDEN', 403],
  ] as const)('enforces live %s eligibility and platform inside the batch', async (name, mutation, error, status) => {
    if (name.startsWith('bundle')) await bundle();
    let expected: Awaited<ReturnType<typeof snapshot>>;
    const inspected = inspectDatabase(async () => { await run(mutation); expected = await snapshot(); });
    expectError(await redeem({ database: inspected.database }), error, status);
    expect(inspected.batches[0][0].meta.changes).toBe(0);
    expect(inspected.batches[0][1].meta.changes).toBe(0);
    expect(await snapshot()).toEqual(expected!);
  });

  it.each(['active', 'expired', 'revoked'])('does not count or overwrite a foreign-platform %s enrollment', async status => {
    await enrollment('course-1', status, '2000-01-01T00:00:00Z', otherPlatform);
    const before = await snapshot();
    expectError(await redeem(), 'CODE_INVALID');
    expect(await snapshot()).toEqual(before);
  });

  it('filters all-scope targets by publication, archive status, and tenant', async () => {
    await run("UPDATE activation_codes SET scope_type = 'all' WHERE id = 'code-1'");
    const result = await redeem();
    expect(result.status).toBe(200);
    expect(result.body.course_ids?.sort()).toEqual(['course-1', 'course-2', 'course-3']);
    expect((await codeState())?.used_count).toBe(1);
  });

  it('excludes foreign courses even if bundle membership is incorrectly tagged as local', async () => {
    await bundle();
    await run("INSERT INTO bundle_courses (bundle_id, course_id, platform) VALUES ('bundle-1', 'foreign-course', ?)", platform);
    const result = await redeem();
    expect(result.status).toBe(200);
    expect(result.body.course_ids?.sort()).toEqual(['course-1', 'course-2', 'course-3']);
    expectError(await redeem({ student: 'student-2', course: 'foreign-course' }), 'CODE_SCOPE_MISMATCH');
    expect((await codeState())?.used_count).toBe(1);
  });

  it('accepts numeric future expiry in SQLite format and uses batch access days', async () => {
    await run("UPDATE activation_codes SET expires_at = datetime('now', '+1 hour'), access_days = 0 WHERE id = 'code-1'");
    const result = await redeem();
    expect(result.status).toBe(200);
    expect(await db.prepare('SELECT julianday(expires_at) - julianday(granted_at) AS days FROM enrollments').first()).toEqual({ days: 30 });
  });

  it('supports perpetual access without consuming again on retry', async () => {
    await run('UPDATE code_batches SET access_days = NULL');
    const result = await redeem();
    expect(result.status).toBe(200);
    expect(result.body.expires_at).toBeNull();
    expectError(await redeem(), 'ALREADY_ENROLLED');
    expect((await codeState())?.used_count).toBe(1);
  });
});

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { SQLInputValue } from 'node:sqlite';
import { URL } from 'node:url';
import { Hono, type Context, type Next } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, Env, HonoBindings } from '../types';
import { sendNotificationDirectly } from '../queues/notificationConsumer';
import admin from './admin';

// Vite 5 predates node:sqlite; bypass its resolver for the native module.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

// Stub identity and transport, not Hono, authorization, auditing, or route SQL.
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...await importOriginal<typeof import('../middleware/auth')>(),
  requireAuth: async (c: Context<HonoBindings>, next: Next) => {
    c.set('user', {
      id: 'caller', supabaseUserId: 'offline-caller', email: 'caller@example.test',
      fullName: 'Offline Caller', status: 'active', maxDevices: 2,
      role: (c.req.header('X-Test-Role') || 'admin') as AuthUser['role'],
    });
    await next();
  },
}));
vi.mock('../queues/notificationConsumer', () => ({
  sendNotificationDirectly: vi.fn(async () => undefined),
}));

class SQLiteStatement {
  constructor(private db: SQLiteD1, private sql: string, private values: SQLInputValue[] = []) {}

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
    this.db.writes.push(this.sql);
    const result = this.db.sqlite.prepare(this.sql).run(...this.values);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
}

class SQLiteD1 {
  readonly sqlite = new DatabaseSync(':memory:');
  readonly writes: string[] = [];

  prepare(sql: string) {
    return new SQLiteStatement(this, sql);
  }
}

function tableDDL(filename: string, table: string) {
  const sql = readFileSync(new URL(`../../migrations/${filename}`, import.meta.url), 'utf8');
  const ddl = sql.match(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table} \\([\\s\\S]*?\\n\\);`));
  if (!ddl) throw new Error(`Missing ${table} DDL in ${filename}`);
  return ddl[0];
}

const schema = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE profiles (id TEXT PRIMARY KEY, platform TEXT NOT NULL);
  CREATE TABLE courses (id TEXT PRIMARY KEY, platform TEXT NOT NULL);
  CREATE TABLE activation_codes (id TEXT PRIMARY KEY);
  ${tableDDL('0009_add_on_delete_cascade.sql', 'devices')}
  ${tableDDL('0009_add_on_delete_cascade.sql', 'enrollments')}
  ${tableDDL('0009_add_on_delete_cascade.sql', 'notifications')}
  ${tableDDL('0014_push_subscriptions.sql', 'push_subscriptions')}
  ${tableDDL('0000_init.sql', 'audit_logs')}
  ALTER TABLE audit_logs ADD COLUMN platform TEXT NOT NULL DEFAULT 'fusha';
`;
const message = { title: 'Offline announcement', body: 'Regression test only' };
type Audience = 'all' | 'course' | 'user';
type Source = 'subscription' | 'device' | 'both';
let db: SQLiteD1;
let app: Hono<HonoBindings>;
let errors: Error[];
let network: ReturnType<typeof vi.fn<[], never>>;
let pending: Promise<unknown>[];

beforeEach(() => {
  network = vi.fn(() => { throw new Error('Network access is forbidden in this regression suite'); });
  vi.stubGlobal('fetch', network);
  vi.mocked(sendNotificationDirectly).mockClear();
  db = new SQLiteD1();
  db.sqlite.exec(schema);
  pending = [];
  errors = [];
  app = new Hono<HonoBindings>();
  app.route('/admin', admin);
  app.onError((error, c) => {
    errors.push(error);
    return c.json({ error: { code: 'INTERNAL_ERROR' } }, 500);
  });
});

afterEach(async () => {
  try {
    await Promise.all(pending);
  } finally {
    db.sqlite.close();
    vi.unstubAllGlobals();
  }
  expect(network).not.toHaveBeenCalled();
  expect(errors).toEqual([]);
});

async function send(body: Record<string, unknown>, configured?: string, role = 'admin') {
  const response = await app.request('/admin/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Role': role },
    body: JSON.stringify({ ...message, ...body }),
  }, {
    DB: db as unknown as Env['DB'],
    KV: { get: async () => null, put: async () => undefined } as unknown as Env['KV'],
    ...(configured === undefined ? {} : { PLATFORM_KEY: configured }),
  } as Env, {
    waitUntil: (promise: Promise<unknown>) => { pending.push(promise); },
    passThroughOnException: () => undefined,
    props: {},
  });
  await Promise.all(pending);
  return response;
}

function target(audience: Audience) {
  return {
    audience,
    ...(audience === 'course' ? { course_id: 'course' } : {}),
    ...(audience === 'user' ? { recipient_id: 'student' } : {}),
  };
}

function addTokens(studentId: string | null, platform: string, source: Source, token: string) {
  if (source !== 'device') {
    const id = crypto.randomUUID();
    db.sqlite.prepare(`INSERT INTO push_subscriptions
      (id, device_id, platform, push_token, student_id, platform_key) VALUES (?, ?, 'android', ?, ?, ?)`)
      .run(id, id, token, studentId, platform);
  }
  if (source !== 'subscription') {
    const id = crypto.randomUUID();
    db.sqlite.prepare(`INSERT INTO devices
      (id, device_id, platform, push_token, student_id) VALUES (?, ?, 'ios', ?, ?)`)
      .run(id, id, token, studentId);
  }
}

function enroll(studentId: string, platform: string, expiresAt: string | null = null, status = 'active', courseId = 'course') {
  db.sqlite.prepare(`INSERT INTO enrollments
    (id, student_id, course_id, platform, expires_at, status) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(crypto.randomUUID(), studentId, courseId, platform, expiresAt, status);
}

function notifications() {
  return db.sqlite.prepare('SELECT * FROM notifications ORDER BY id').all();
}

async function expectSent(response: Response, audience: Audience, platform: string, tokens: string[]) {
  expect(response.status).toBe(200);
  const result = await response.json() as { notification_id: string; tokens_count: number; ok: boolean };
  expect(result).toEqual({ ok: true, notification_id: expect.any(String), tokens_count: tokens.length });
  const rows = notifications();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    id: result.notification_id, audience, platform, type: 'announcement', ...message,
    recipient_id: audience === 'user' ? 'student' : null,
    course_id: audience === 'course' ? 'course' : null,
    sent_at: expect.any(String), created_at: expect.any(String),
  });
  if (tokens.length === 0) {
    expect(sendNotificationDirectly).not.toHaveBeenCalled();
  } else {
    expect(sendNotificationDirectly).toHaveBeenCalledTimes(1);
    const [env, payload] = vi.mocked(sendNotificationDirectly).mock.calls[0];
    expect(env.DB).toBe(db);
    expect(payload).toEqual({
      type: 'multicast', tokens: expect.any(Array), ...message, notificationId: result.notification_id,
    });
    expect([...payload.tokens!].sort()).toEqual([...tokens].sort());
    expect(new Set(payload.tokens).size).toBe(tokens.length);
  }
}

async function expectRejected(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ error: { code } });
  expect(notifications()).toEqual([]);
  // Preserve audit logging of rejected attempts; the send handler must perform no writes.
  expect(db.writes.filter((sql) => !sql.startsWith('INSERT INTO audit_logs'))).toEqual([]);
  expect(sendNotificationDirectly).not.toHaveBeenCalled();
}

describe.each([
  { label: 'default platform', configured: undefined, platform: 'fusha', foreign: 'legacy-tenant' },
  { label: 'configured platform', configured: 'legacy-tenant', platform: 'legacy-tenant', foreign: 'fusha' },
])('admin notification sends: $label', ({ configured, platform, foreign }) => {
  beforeEach(() => {
    for (const id of ['caller', 'student', 'other']) {
      db.sqlite.prepare('INSERT INTO profiles (id, platform) VALUES (?, ?)').run(id, platform);
    }
    db.sqlite.prepare('INSERT INTO profiles (id, platform) VALUES (?, ?)').run('foreign', foreign);
    for (const id of ['course', 'other-course']) {
      db.sqlite.prepare('INSERT INTO courses (id, platform) VALUES (?, ?)').run(id, platform);
    }
    db.sqlite.prepare('INSERT INTO courses (id, platform) VALUES (?, ?)').run('foreign', foreign);
  });

  describe.each(['course', 'user'] as const)('%s audience', (audience) => {
    it.each(['subscription', 'device', 'both'] as const)('reaches %s recipients and deduplicates tokens', async (source) => {
      if (audience === 'course') enroll('student', platform);
      addTokens('student', platform, source, 'target-token');
      addTokens('student', platform, source, 'target-token');
      addTokens('other', platform, 'both', 'unrelated-token');
      addTokens(null, platform, 'subscription', 'anonymous-token');
      await expectSent(await send(target(audience), configured), audience, platform, ['target-token']);
    });

    it('unions distinct subscription-only and device-only tokens', async () => {
      if (audience === 'course') enroll('student', platform);
      addTokens('student', platform, 'subscription', 'subscription-token');
      addTokens('student', platform, 'device', 'device-token');
      await expectSent(await send(target(audience), configured), audience, platform, ['subscription-token', 'device-token']);
    });

    it.each([undefined, null, '', '   ', '\t\n', 7])('requires its matching target field (%s), even with the other field set', async (value) => {
      const body = audience === 'course'
        ? { audience, course_id: value, recipient_id: 'student' }
        : { audience, recipient_id: value, course_id: 'course' };
      await expectRejected(await send(body, configured), 400, 'VALIDATION_ERROR');
    });

    it.each(['missing', 'foreign'])('rejects a %s target before inserting any notification', async (id) => {
      addTokens('foreign', foreign, 'both', 'foreign-token');
      if (id === 'foreign' && audience === 'course') {
        // A local enrollment cannot turn a foreign course into a valid target.
        enroll('student', platform, null, 'active', 'foreign');
        addTokens('student', platform, 'both', 'local-token');
      }
      await expectRejected(await send({
        audience, [audience === 'course' ? 'course_id' : 'recipient_id']: id,
      }, configured), 404, 'NOT_FOUND');
    });

    it('excludes subscriptions from a foreign platform even when linked to the local target', async () => {
      if (audience === 'course') enroll('student', platform);
      addTokens('student', foreign, 'subscription', 'foreign-subscription');
      addTokens('student', platform, 'device', 'local-device');
      await expectSent(await send(target(audience), configured), audience, platform, ['local-device']);
    });
  });

  it('requires local profile and enrollment platforms on both course recipient sources', async () => {
    enroll('foreign', platform);
    addTokens('foreign', platform, 'both', 'foreign-profile');
    enroll('student', foreign);
    addTokens('student', platform, 'both', 'foreign-enrollment');
    enroll('other', platform);
    addTokens('other', platform, 'both', 'local-token');
    await expectSent(await send(target('course'), configured), 'course', platform, ['local-token']);
  });

  it('does not select enrollments from a different course', async () => {
    enroll('student', platform, null, 'active', 'other-course');
    addTokens('student', platform, 'both', 'other-course-token');
    await expectSent(await send(target('course'), configured), 'course', platform, []);
  });

  it('reaches separate subscription-only and device-only enrolled students', async () => {
    enroll('student', platform);
    enroll('other', platform);
    addTokens('student', platform, 'subscription', 'subscription-student');
    addTokens('other', platform, 'device', 'device-student');
    await expectSent(await send(target('course'), configured), 'course', platform, ['subscription-student', 'device-student']);
  });

  it.each([
    { label: 'no expiry', expression: 'NULL', status: 'active', included: true },
    { label: 'future SQLite timestamp', expression: "datetime('now', '+1 day')", status: 'active', included: true },
    { label: 'future ISO timestamp', expression: "strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '+1 day')", status: 'active', included: true },
    { label: 'expired SQLite timestamp', expression: "datetime('now', '-1 minute')", status: 'active', included: false },
    { label: 'expired ISO timestamp', expression: "strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 minute')", status: 'active', included: false },
    { label: 'expiry at now', expression: "datetime('now')", status: 'active', included: false },
    { label: 'expired status without expiry', expression: 'NULL', status: 'expired', included: false },
    { label: 'revoked future enrollment', expression: "datetime('now', '+1 day')", status: 'revoked', included: false },
    { label: 'empty expiry', expression: "''", status: 'active', included: false },
    { label: 'malformed expiry', expression: "'invalid-date'", status: 'active', included: false },
  ])('course eligibility handles $label on both sources', async ({ expression, status, included }) => {
    const row = db.sqlite.prepare(`SELECT ${expression} AS expiry`).get()!;
    enroll('student', platform, row.expiry as string | null, status);
    addTokens('student', platform, 'subscription', 'subscription-token');
    addTokens('student', platform, 'device', 'device-token');
    await expectSent(await send(target('course'), configured), 'course', platform,
      included ? ['subscription-token', 'device-token'] : []);
  });

  it.each(['all', 'course', 'user'] as const)('%s filters empty/null/whitespace tokens and deduplicates the union', async (audience) => {
    if (audience === 'course') enroll('student', platform);
    for (const token of ['', ' \t\n', 'valid-token']) addTokens('student', platform, 'both', token);
    addTokens('student', platform, 'both', 'valid-token');
    db.sqlite.exec("INSERT INTO devices (id, device_id, student_id, platform, push_token) VALUES ('null-token', 'null-token', 'student', 'web', NULL)");
    await expectSent(await send(target(audience), configured), audience, platform, ['valid-token']);
  });

  it.each(['all', 'course', 'user'] as const)('%s persists valid sends with no devices or subscriptions', async (audience) => {
    await expectSent(await send(target(audience), configured), audience, platform, []);
  });

  it.each(['all', 'course', 'user'] as const)('%s does not persist irrelevant foreign target fields', async (audience) => {
    await expectSent(await send({
      audience,
      course_id: audience === 'course' ? 'course' : 'foreign',
      recipient_id: audience === 'user' ? 'student' : 'foreign',
    }, configured), audience, platform, []);
  });

  it('all keeps anonymous installs and local devices without enrollments, but excludes foreign tenants', async () => {
    addTokens(null, platform, 'subscription', 'anonymous');
    addTokens(null, foreign, 'subscription', 'foreign-anonymous');
    addTokens('student', platform, 'subscription', 'local-subscription');
    addTokens('student', foreign, 'subscription', 'wrong-platform-key');
    addTokens('other', platform, 'device', 'local-device');
    addTokens('student', platform, 'both', 'shared');
    addTokens('foreign', platform, 'both', 'wrong-profile-platform');
    addTokens('foreign', foreign, 'both', 'foreign-token');
    await expectSent(await send(target('all'), configured), 'all', platform,
      ['anonymous', 'local-subscription', 'local-device', 'shared']);
  });

  it.each(['assistant', 'student'])('keeps sends admin-only for %s callers', async (role) => {
    await expectRejected(await send(target('all'), configured, role), 403, 'FORBIDDEN');
    expect(db.writes).toEqual([]);
  });
});

import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { SQLInputValue } from 'node:sqlite';
import { URL } from 'node:url';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env, HonoBindings } from '../types';
import { sendNotificationDirectly } from '../queues/notificationConsumer';
import admin from './admin';
import push from './push';

// Vite 5 predates node:sqlite; use the native module without its resolver.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

// Keep real optionalAuth, requireAuth, roles, rate limiting, auditing and SQL.
// Only replace delivery; no Firebase credentials or external service is used.
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
    const beforeWrite = this.db.beforeWrite;
    this.db.beforeWrite = undefined;
    beforeWrite?.();
    const result = this.db.sqlite.prepare(this.sql).run(...this.values);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
}

class SQLiteD1 {
  readonly sqlite = new DatabaseSync(':memory:');
  beforeWrite?: () => void;

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
  ${tableDDL('0000_init.sql', 'profiles')}
  ALTER TABLE profiles ADD COLUMN platform TEXT NOT NULL DEFAULT 'dr-physics';
  ALTER TABLE profiles ADD COLUMN branch TEXT;
  CREATE TABLE courses (id TEXT PRIMARY KEY, platform TEXT NOT NULL);
  CREATE TABLE activation_codes (id TEXT PRIMARY KEY);
  ${tableDDL('0009_add_on_delete_cascade.sql', 'devices')}
  ${tableDDL('0009_add_on_delete_cascade.sql', 'enrollments')}
  ${tableDDL('0009_add_on_delete_cascade.sql', 'notifications')}
  ${tableDDL('0014_push_subscriptions.sql', 'push_subscriptions')}
  ${tableDDL('0000_init.sql', 'audit_logs')}
  ALTER TABLE audit_logs ADD COLUMN platform TEXT NOT NULL DEFAULT 'dr-physics';
`;
const deviceId = 'shared-install';
const ownerToken = 'offline-owner-push-token';
const attackerToken = 'offline-attacker-push-token';
const message = { title: 'Offline ownership regression', body: 'Test delivery only' };
const unauthenticated = [
  { label: 'missing authorization', credential: undefined },
  { label: 'invalid authorization', credential: 'invalid-session' },
  { label: 'playback-only credential', credential: 'pb_playback-only' },
  { label: 'blocked account', credential: 'session-blocked' },
  { label: 'revoked session', credential: 'session-revoked' },
  { label: 'foreign tenant account', credential: 'session-foreign' },
  { label: 'missing profile', credential: 'session-missing' },
];
let db: SQLiteD1;
let app: Hono<HonoBindings>;
let env: Env;
let kv: Map<string, string>;
let pending: Promise<unknown>[];
let errors: Error[];
let network: ReturnType<typeof vi.fn<[], never>>;

beforeEach(() => {
  network = vi.fn(() => { throw new Error('Network access is forbidden in push ownership tests'); });
  vi.stubGlobal('fetch', network);
  vi.mocked(sendNotificationDirectly).mockClear();
  db = new SQLiteD1();
  db.sqlite.exec(schema);
  kv = new Map();
  // JWT tests use an empty, fresh JWKS cache plus the real local HMAC verifier.
  kv.set('supabase:jwks', JSON.stringify({ keys: [], fetchedAt: Date.now() / 1000 }));
  env = {
    DB: db as unknown as Env['DB'],
    KV: {
      get: async (key: string, type?: string) => {
        const value = kv.get(key) ?? null;
        return type === 'json' && value !== null ? JSON.parse(value) : value;
      },
      put: async (key: string, value: string) => { kv.set(key, value); },
    } as unknown as Env['KV'],
    SUPABASE_URL: 'https://auth.example.test',
    JWT_AUDIENCE: 'authenticated',
    SUPABASE_JWT_SECRET: 'offline-test-only-signing-key',
  } as Env;
  pending = [];
  errors = [];
  app = new Hono<HonoBindings>();
  app.route('/push', push);
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

function seedProfile(id: string, platform: string, role = 'student', status = 'active') {
  db.sqlite.prepare(`INSERT INTO profiles
    (id, supabase_user_id, email, role, status, platform) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, `supabase-${id}`, `${id}@example.test`, role, status, platform);
  kv.set(`playback_token:session-${id}`, JSON.stringify({ userId: id, scope: 'auth' }));
}

function enroll(studentId: string, courseId: string, platform: string) {
  db.sqlite.prepare(`INSERT INTO enrollments
    (id, student_id, course_id, platform, status) VALUES (?, ?, ?, ?, 'active')`)
    .run(crypto.randomUUID(), studentId, courseId, platform);
}

async function request(path: string, body: unknown, credential?: string) {
  const response = await app.request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(credential === undefined ? {} : { Authorization: `Bearer ${credential}` }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }, env, {
    props: {},
    waitUntil: (promise: Promise<unknown>) => { pending.push(promise); },
    passThroughOnException: () => undefined,
  });
  await Promise.all(pending);
  expect(response.headers.get('Authorization')).toBeNull();
  return response;
}

function subscribe(pushToken: string, credential?: string, extra: Record<string, unknown> = {}) {
  return request('/push/subscribe', {
    device_id: deviceId, platform: 'android', push_token: pushToken, ...extra,
  }, credential);
}

function unsubscribe(credential?: string, id = deviceId) {
  return request('/push/unsubscribe', { device_id: id }, credential);
}

function subscription(platform = env.PLATFORM_KEY || 'dr-physics', id = deviceId) {
  return db.sqlite.prepare('SELECT * FROM push_subscriptions WHERE device_id = ? AND platform_key = ?')
    .get(id, platform);
}

async function expectOK(response: Response) {
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
}

async function expectOwnershipRequired(response: Response) {
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: { code: 'PUSH_OWNERSHIP_REQUIRED', message: expect.any(String) },
  });
}

async function expectRecipients(audience: 'user' | 'course' | 'all', tokens: string[], target = 'owner') {
  vi.mocked(sendNotificationDirectly).mockClear();
  const response = await request('/admin/notifications/send', {
    ...message, audience,
    ...(audience === 'user' ? { recipient_id: target } : {}),
    ...(audience === 'course' ? { course_id: `${target}-course` } : {}),
  }, 'session-admin');
  expect(response.status).toBe(200);
  const result = await response.json() as { notification_id: string };
  expect(result).toEqual({ ok: true, notification_id: expect.any(String), tokens_count: tokens.length });
  expect(db.sqlite.prepare('SELECT * FROM notifications WHERE id = ?').get(result.notification_id))
    .toMatchObject({
      audience, ...message, platform: env.PLATFORM_KEY || 'dr-physics',
      recipient_id: audience === 'user' ? target : null,
      course_id: audience === 'course' ? `${target}-course` : null,
    });
  if (tokens.length === 0) {
    expect(sendNotificationDirectly).not.toHaveBeenCalled();
  } else {
    expect(sendNotificationDirectly).toHaveBeenCalledTimes(1);
    const [bindings, payload] = vi.mocked(sendNotificationDirectly).mock.calls[0];
    expect(bindings.DB).toBe(db);
    expect(payload).toEqual({
      type: 'multicast', ...message, notificationId: result.notification_id, tokens: expect.any(Array),
    });
    expect([...payload.tokens!].sort()).toEqual([...tokens].sort());
  }
}

function signedJWT(secret = env.SUPABASE_JWT_SECRET) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: 'supabase-owner', aud: env.JWT_AUDIENCE, iss: `${env.SUPABASE_URL}/auth/v1`,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const input = `${header}.${payload}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

describe.each([
  { label: 'default tenant', configured: undefined, platform: 'dr-physics', foreign: 'alhadaba-chemistry' },
  { label: 'configured tenant', configured: 'alhadaba-chemistry', platform: 'alhadaba-chemistry', foreign: 'dr-physics' },
])('public push ownership: $label', ({ configured, platform, foreign }) => {
  beforeEach(() => {
    if (configured !== undefined) env.PLATFORM_KEY = configured;
    for (const id of ['owner', 'other', 'revoked']) seedProfile(id, platform);
    seedProfile('admin', platform, 'admin');
    seedProfile('assistant', platform, 'assistant');
    seedProfile('blocked', platform, 'student', 'blocked');
    seedProfile('foreign', foreign);
    kv.set('blacklist:user:revoked', '1');
    kv.set('playback_token:pb_playback-only', JSON.stringify({ userId: 'owner', scope: 'playback' }));
    kv.set('playback_token:session-missing', JSON.stringify({ userId: 'missing', scope: 'auth' }));
    for (const id of ['owner', 'other']) {
      db.sqlite.prepare('INSERT INTO courses (id, platform) VALUES (?, ?)').run(`${id}-course`, platform);
      enroll(id, `${id}-course`, platform);
    }
  });

  it.each(unauthenticated)('blocks linked token replacement with $label before direct/course sends', async ({ credential }) => {
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    const before = subscription();
    await expectOwnershipRequired(await subscribe(attackerToken, credential, {
      student_id: 'owner', platform: 'web', platform_key: foreign,
    }));
    expect(subscription()).toEqual(before);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').get()).toEqual({ count: 1 });
    await expectRecipients('user', [ownerToken]);
    await expectRecipients('course', [ownerToken]);
  });

  it.each(unauthenticated)('keeps new registration and refresh anonymous with $label', async ({ credential }) => {
    await expectOK(await subscribe(ownerToken, credential, { student_id: 'owner', platform_key: foreign }));
    expect(subscription()).toMatchObject({ student_id: null, platform_key: platform, push_token: ownerToken });
    await expectOK(await subscribe(attackerToken, credential, { student_id: 'owner', platform: 'web' }));
    expect(subscription()).toMatchObject({ student_id: null, platform: 'web', push_token: attackerToken });
    await expectRecipients('user', []);
    await expectRecipients('course', []);
    await expectRecipients('all', [attackerToken]);
  });

  it('allows an anonymous same-token touch without changing linked identity or platform', async () => {
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    db.sqlite.prepare("UPDATE push_subscriptions SET updated_at = '2000-01-01' WHERE device_id = ?").run(deviceId);
    const before = subscription()!;
    await expectOK(await subscribe(ownerToken, undefined, { platform: 'web', student_id: 'other' }));
    expect(subscription()).toEqual({ ...before, updated_at: expect.not.stringMatching(/^2000-01-01/) });
    await expectRecipients('user', [ownerToken]);
    await expectRecipients('course', [ownerToken]);
    await expectRecipients('user', [], 'other');
  });

  it('lets the same authenticated owner rotate the token without recreating the row', async () => {
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    const before = subscription()!;
    await expectOK(await subscribe('offline-refreshed-token', 'session-owner', { platform: 'ios' }));
    expect(subscription()).toMatchObject({
      id: before.id, created_at: before.created_at, student_id: 'owner',
      platform: 'ios', platform_key: platform, push_token: 'offline-refreshed-token',
    });
    await expectRecipients('user', ['offline-refreshed-token']);
    await expectRecipients('course', ['offline-refreshed-token']);
  });

  it('upgrades an anonymous install only to the authenticated identity', async () => {
    await expectOK(await subscribe(attackerToken));
    const before = subscription()!;
    await expectOK(await subscribe(ownerToken, 'session-owner', { student_id: 'other' }));
    expect(subscription()).toMatchObject({ id: before.id, student_id: 'owner', push_token: ownerToken });
    await expectRecipients('user', [ownerToken]);
    await expectRecipients('course', [ownerToken]);
    await expectRecipients('user', [], 'other');
  });

  it.each([
    { label: 'unchanged token', token: ownerToken },
    { label: 'new token', token: attackerToken },
  ])('reassigns a shared install on valid new login ($label), never keeping the old target', async ({ token }) => {
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    const before = subscription()!;
    await expectOK(await subscribe(token, 'session-other', { student_id: 'owner' }));
    expect(subscription()).toMatchObject({ id: before.id, student_id: 'other', push_token: token });
    await expectRecipients('user', []);
    await expectRecipients('course', []);
    await expectRecipients('user', [token], 'other');
    await expectRecipients('course', [token], 'other');
    await expectOwnershipRequired(await unsubscribe('session-owner'));
    expect(subscription()).toMatchObject({ student_id: 'other', push_token: token });
    await expectOK(await unsubscribe('session-other'));
    expect(subscription()).toBeUndefined();
  });

  it('accepts a real signed JWT and rejects a forged signature without linking new rows', async () => {
    await expectOK(await subscribe(ownerToken, signedJWT()));
    expect(subscription()).toMatchObject({ student_id: 'owner', push_token: ownerToken });
    const before = subscription();
    const invalid = signedJWT('wrong-offline-signing-key');
    await expectOwnershipRequired(await subscribe(attackerToken, invalid));
    await expectOwnershipRequired(await unsubscribe(invalid));
    expect(subscription()).toEqual(before);
    await expectOK(await subscribe(attackerToken, invalid, { device_id: 'new-install', student_id: 'owner' }));
    expect(subscription(platform, 'new-install')).toMatchObject({ student_id: null });
    await expectRecipients('user', [ownerToken]);
    await expectRecipients('course', [ownerToken]);
    await expectOK(await unsubscribe(signedJWT()));
    expect(subscription()).toBeUndefined();
  });

  it.each([
    ...unauthenticated,
    { label: 'different authenticated user', credential: 'session-other' },
    { label: 'admin who is not the owner', credential: 'session-admin' },
  ])('blocks linked unsubscribe with $label', async ({ credential }) => {
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    const before = subscription();
    await expectOwnershipRequired(await unsubscribe(credential));
    expect(subscription()).toEqual(before);
    await expectRecipients('user', [ownerToken]);
    await expectRecipients('course', [ownerToken]);
  });

  it('preserves authenticated device_id-only unsubscribe and idempotency', async () => {
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    await expectOK(await subscribe('offline-unrelated-token', 'session-owner', { device_id: 'unrelated' }));
    const unrelated = subscription(platform, 'unrelated');
    await expectOK(await unsubscribe('session-owner'));
    expect(subscription()).toBeUndefined();
    expect(subscription(platform, 'unrelated')).toEqual(unrelated);
    await expectOK(await unsubscribe('session-owner'));
    await expectOK(await unsubscribe());
    await expectRecipients('user', ['offline-unrelated-token']);
  });

  it('preserves legacy unlinked unsubscribe without claiming token possession proof', async () => {
    await expectOK(await subscribe(attackerToken));
    await expectOK(await unsubscribe());
    expect(subscription()).toBeUndefined();
    await expectOK(await unsubscribe());
    await expectRecipients('all', []);
  });

  it('isolates the same device ID across tenants for subscribe, sends and unsubscribe', async () => {
    env.PLATFORM_KEY = foreign;
    await expectOK(await subscribe('offline-foreign-token', 'session-foreign'));
    const foreignBefore = subscription(foreign);
    if (configured === undefined) delete (env as Partial<Env>).PLATFORM_KEY;
    else env.PLATFORM_KEY = configured;
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    await expectOK(await subscribe('offline-refreshed-token', 'session-owner'));
    expect(subscription(foreign)).toEqual(foreignBefore);
    await expectRecipients('user', ['offline-refreshed-token']);
    await expectRecipients('course', ['offline-refreshed-token']);
    await expectRecipients('all', ['offline-refreshed-token']);
    await expectOK(await unsubscribe('session-owner'));
    await expectOK(await unsubscribe());
    expect(subscription()).toBeUndefined();
    expect(subscription(foreign)).toEqual(foreignBefore);
  });

  it('checks anonymous subscribe ownership at write time after a concurrent link', async () => {
    await expectOK(await subscribe(ownerToken));
    const before = subscription()!;
    db.beforeWrite = () => {
      db.sqlite.prepare('UPDATE push_subscriptions SET student_id = ? WHERE device_id = ? AND platform_key = ?')
        .run('owner', deviceId, platform);
    };
    await expectOwnershipRequired(await subscribe(attackerToken));
    expect(subscription()).toEqual({ ...before, student_id: 'owner' });
    await expectRecipients('user', [ownerToken]);
    await expectRecipients('course', [ownerToken]);
  });

  it.each([undefined, 'session-owner'])('checks unsubscribe ownership at write time after reassignment (%s)', async (credential) => {
    await expectOK(await subscribe(ownerToken, credential));
    const before = subscription()!;
    db.beforeWrite = () => {
      db.sqlite.prepare('UPDATE push_subscriptions SET student_id = ? WHERE device_id = ? AND platform_key = ?')
        .run('other', deviceId, platform);
    };
    await expectOwnershipRequired(await unsubscribe(credential));
    expect(subscription()).toEqual({ ...before, student_id: 'other' });
    await expectRecipients('user', []);
    await expectRecipients('course', []);
    await expectRecipients('user', [ownerToken], 'other');
  });

  it.each(['subscribe', 'unsubscribe'])('rejects malformed JSON and invalid device IDs for %s without mutation', async (route) => {
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    const before = subscription();
    for (const body of ['{', { device_id: '', platform: 'android', push_token: attackerToken }]) {
      const response = await request(`/push/${route}`, body, 'session-owner');
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(subscription()).toEqual(before);
    }
  });

  it.each(['owner', 'assistant'])('retains real admin-only send authorization for %s', async (id) => {
    await expectOK(await subscribe(ownerToken, 'session-owner'));
    const response = await request('/admin/notifications/send', { ...message, audience: 'all' }, `session-${id}`);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(sendNotificationDirectly).not.toHaveBeenCalled();
    expect(db.sqlite.prepare('SELECT * FROM notifications').all()).toEqual([]);
  });
});

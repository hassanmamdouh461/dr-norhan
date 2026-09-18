/// <reference types="vitest/globals" />
import { createRequire } from 'node:module';
import type { DatabaseSync as SQLiteDatabase, SQLInputValue } from 'node:sqlite';
import { Hono, type Context, type Next } from 'hono';
import type { Env, HonoBindings } from '../types';
import auth from './auth';

// Load directly because the existing Vite version predates the node:sqlite module.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

async function mockAuth(c: Context<HonoBindings>, next: Next) {
  c.set('user', {
    id: 'student-1',
    supabaseUserId: 'supabase-student-1',
    email: 'student@example.test',
    role: 'student',
    status: 'active',
    fullName: 'Test Student',
    maxDevices: 2,
  });
  await next();
}

describe('POST /auth/me/devices trust policy', () => {
  const registrationRoutes = auth.routes.filter(route => route.method === 'POST' && route.path === '/me/devices');
  if (registrationRoutes.length !== 2) {
    throw new Error('Expected requireAuth followed by the device registration handler');
  }
  // Replace only the first handler (requireAuth); mount the production endpoint unchanged.
  const app = new Hono<HonoBindings>().post('/auth/me/devices', mockAuth, registrationRoutes[1].handler);
  let sqlite: SQLiteDatabase;
  let env: Env;
  let statements: { sql: string; values: SQLInputValue[] }[];

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('Network access is disabled in device registration tests');
    }));
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE devices (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        model TEXT,
        push_token TEXT,
        is_trusted INTEGER NOT NULL,
        is_rooted INTEGER NOT NULL,
        last_login_at TEXT,
        created_at TEXT,
        UNIQUE (student_id, device_id)
      )
    `);
    statements = [];
    // Execute the router's actual SQL locally through the D1 methods it uses.
    env = {
      DB: {
        prepare(sql: string) {
          return {
            bind(...values: SQLInputValue[]) {
              statements.push({ sql, values });
              return {
                first: async () => sqlite.prepare(sql).get(...values) ?? null,
                run: async () => {
                  sqlite.prepare(sql).run(...values);
                  return { success: true };
                },
              };
            },
          };
        },
      },
    } as unknown as Env;
  });

  afterEach(() => {
    sqlite.close();
    vi.unstubAllGlobals();
  });

  function register(body: Record<string, unknown>) {
    return app.request('/auth/me/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: 'device-1', ...body }),
    }, env);
  }

  it.each([
    { platform: 'web', expectedTrust: 0 },
    { platform: 'android', expectedTrust: 1 },
    { platform: 'ios', expectedTrust: 1 },
  ])('registers new $platform devices with bound trust $expectedTrust', async ({ platform, expectedTrust }) => {
    const response = await register({
      platform,
      model: 'Test model',
      push_token: 'test-push-token',
      is_rooted: true,
    });

    expect(response.status).toBe(201);
    const result = await response.json() as { ok: boolean; device_id: string; new: boolean };
    expect(result).toEqual({ ok: true, device_id: expect.any(String), new: true });
    expect(sqlite.prepare('SELECT * FROM devices').get()).toEqual({
      id: result.device_id,
      student_id: 'student-1',
      device_id: 'device-1',
      platform,
      model: 'Test model',
      push_token: 'test-push-token',
      is_trusted: expectedTrust,
      is_rooted: 1,
      last_login_at: expect.any(String),
      created_at: expect.any(String),
    });
    const insert = statements.find(({ sql }) => sql.startsWith('INSERT INTO devices'));
    expect(insert?.sql).toContain('VALUES (?, ?, ?, ?, ?, ?, ?, ?,');
    expect(insert?.values).toEqual([
      result.device_id, 'student-1', 'device-1', platform,
      'Test model', 'test-push-token', expectedTrust, 1,
    ]);
  });

  it.each([true, 1, '1', false, 0])('ignores client-supplied is_trusted=%s for new web devices', async (is_trusted) => {
    const response = await register({ platform: 'web', is_trusted });

    expect(response.status).toBe(201);
    expect(sqlite.prepare('SELECT is_trusted, model, push_token, is_rooted FROM devices').get()).toEqual({
      is_trusted: 0, model: null, push_token: null, is_rooted: 0,
    });
  });

  it.each(['android', 'ios'])('retains new %s auto-trust regardless of a client trust flag', async (platform) => {
    const response = await register({ platform, is_trusted: false });

    expect(response.status).toBe(201);
    expect(sqlite.prepare('SELECT is_trusted FROM devices').get()).toEqual({ is_trusted: 1 });
  });

  it.each([
    { platform: 'web', isTrusted: 0 },
    { platform: 'web', isTrusted: 1 },
    { platform: 'android', isTrusted: 0 },
    { platform: 'android', isTrusted: 1 },
    { platform: 'ios', isTrusted: 0 },
    { platform: 'ios', isTrusted: 1 },
  ])('preserves existing $platform trust $isTrusted while updating metadata', async ({ platform, isTrusted }) => {
    sqlite.prepare(`
      INSERT INTO devices
        (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
      VALUES ('existing-row', 'student-1', 'device-1', ?, 'Old model', 'old-token', ?, 0, '2000-01-01', '2000-01-01')
    `).run(platform, isTrusted);

    const response = await register({
      platform,
      model: 'Updated model',
      push_token: 'updated-token',
      is_rooted: true,
      is_trusted: !isTrusted,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, device_id: 'existing-row', new: false });
    expect(sqlite.prepare('SELECT * FROM devices').all()).toEqual([{
      id: 'existing-row',
      student_id: 'student-1',
      device_id: 'device-1',
      platform,
      model: 'Updated model',
      push_token: 'updated-token',
      is_trusted: isTrusted,
      is_rooted: 1,
      last_login_at: expect.not.stringMatching(/^2000-01-01/),
      created_at: '2000-01-01',
    }]);
    expect(statements.some(({ sql }) => sql.startsWith('INSERT'))).toBe(false);
  });

  it.each(['android', 'ios'])('does not promote an existing unapproved web device when updated as %s', async (platform) => {
    sqlite.prepare(`
      INSERT INTO devices (id, student_id, device_id, platform, is_trusted, is_rooted)
      VALUES ('existing-row', 'student-1', 'device-1', 'web', 0, 0)
    `).run();

    const response = await register({ platform, is_trusted: true });

    expect(response.status).toBe(200);
    expect(sqlite.prepare('SELECT platform, is_trusted FROM devices').get()).toEqual({
      platform: 'web', is_trusted: 0,
    });
  });
});

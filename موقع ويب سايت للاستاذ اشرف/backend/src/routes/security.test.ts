import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import fs from 'fs';
import path from 'path';
import worker from '../index';
import { getPresignedUrl } from '../utils/s3';
import { verifyAccessToken, JWT_ISSUER, JWT_AUDIENCE } from '../lib/jwt';

const blockedFetch = vi.fn(async () => {
  throw new Error('Unexpected outbound network request in security.test.ts');
});

beforeAll(() => {
  vi.stubGlobal('fetch', blockedFetch);
});

afterAll(() => {
  try {
    // Fail even if production code catches the blocked fetch error.
    expect(blockedFetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

// Helper to sign an HS256 access token exactly like the Worker does.
async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64UrlEncode = (obj: unknown) => {
    const str = JSON.stringify(obj);
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(payload);
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signingInput)
  );

  const signatureEncoded = Buffer.from(signature)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signingInput}.${signatureEncoded}`;
}

function accessClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'student-1',
    email: 'student@fusha.edu.eg',
    role: 'student',
    token_use: 'access',
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

describe('Cloudflare-native access token validation', () => {
  it.each(['valid', 'expired', 'invalid signature'] as const)('checks a %s access token with the real verifier', async (kind) => {
    const payload = accessClaims({
      exp: Math.floor(Date.now() / 1000) + (kind === 'expired' ? -60 : 3600),
    });
    const token = await signJWT(payload, kind === 'invalid signature' ? 'wrong-secret' : 'test-secret');
    const verified = await verifyAccessToken(token, 'test-secret');
    if (kind === 'valid') {
      expect(verified).toMatchObject({ sub: 'student-1', token_use: 'access', iss: JWT_ISSUER, aud: JWT_AUDIENCE });
    } else {
      expect(verified).toBeNull();
    }
  });

  it.each([
    ['playback-scoped token', { token_use: 'playback' }],
    ['missing token_use', { token_use: undefined }],
    ['foreign issuer', { iss: 'https://supabase.test/auth/v1' }],
    ['foreign audience', { aud: 'authenticated' }],
    ['missing subject', { sub: undefined }],
  ])('rejects a token with %s', async (_label, override) => {
    const token = await signJWT(accessClaims(override as Record<string, unknown>), 'test-secret');
    expect(await verifyAccessToken(token, 'test-secret')).toBeNull();
  });

  it('rejects verification when no secret is configured', async () => {
    const token = await signJWT(accessClaims(), 'test-secret');
    expect(await verifyAccessToken(token, undefined)).toBeNull();
    expect(await verifyAccessToken(token, '   ')).toBeNull();
  });
});

describe('Cloudflare-native auth integration tests', () => {
  let mf: Miniflare;
  let bindings: any;
  let db: any;
  let testToken: string;

  const secret = 'test-secret';

  function envFor(extra: Record<string, unknown> = {}) {
    return {
      ...bindings,
      ENVIRONMENT: 'development',
      AUTH_SECRET: secret,
      PLATFORM_KEY: 'fusha',
      CORS_ORIGIN: 'http://localhost',
      ...extra,
    };
  }

  function post(pathname: string, body: unknown, extraHeaders: Record<string, string> = {}) {
    return new Request(`http://localhost${pathname}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...extraHeaders,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  beforeAll(async () => {
    mf = new Miniflare({
      script: 'export default { fetch() {} }',
      modules: true,
      host: '127.0.0.1',
      cf: false,
      outboundService: blockedFetch,
      d1Databases: ['DB'],
      kvNamespaces: ['KV'],
      r2Buckets: ['R2'],
    });

    bindings = await mf.getBindings();
    db = await mf.getD1Database('DB');

    const cleanSql = (sql: string) => {
      return sql
        .split('\n')
        .map(line => line.replace(/--.*$/, '').trim())
        .filter(line => line.length > 0)
        .join(' ');
    };

    const migrationsDir = path.join(__dirname, '../../migrations');
    const sqlFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    for (const file of sqlFiles) {
      const sql = cleanSql(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
      if (sql.trim().length > 0) {
        try {
          await db.exec(sql);
        } catch (cause) {
          throw new Error(`Local D1 migration failed: ${file}`, { cause });
        }
      }
    }

    await db.prepare(`
      INSERT INTO profiles (id, supabase_user_id, email, role, full_name, status, max_devices, platform, created_at, updated_at)
      VALUES ('student-1', 'local-student-1', 'student@fusha.edu.eg', 'student', 'Test Student', 'active', 2, 'fusha', datetime('now'), datetime('now'))
    `).run();

    testToken = await signJWT(accessClaims(), secret);
  });

  afterAll(async () => {
    if (mf) await mf.dispose();
  });

  it('registers a new student through POST /auth/register and stores a PBKDF2 password hash', async () => {
    const res = await worker.fetch(
      post('/auth/register', {
        email: 'New.Student@Fusha.edu.eg',
        password: 'StrongPassw0rd!',
        full_name: 'طالب جديد',
        phone: '01011111111',
        grade: 'الثالث الثانوي',
        branch: 'علمي علوم',
      }),
      envFor(),
      { waitUntil: async () => {} } as any
    );

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.access_token).toEqual(expect.any(String));
    expect(data.refresh_token).toEqual(expect.any(String));
    expect(data.user).toMatchObject({
      email: 'new.student@fusha.edu.eg',
      full_name: 'طالب جديد',
      role: 'student',
      status: 'active',
    });
    expect(data.user.password_hash).toBeUndefined();

    // البريد يُخزَّن بحروف صغيرة، وكلمة المرور مُجزَّأة بصيغة salt:hash
    const row = await db.prepare("SELECT id, email, password_hash, role, platform FROM profiles WHERE email = 'new.student@fusha.edu.eg'").first() as any;
    expect(row).toBeDefined();
    expect(row.role).toBe('student');
    expect(row.platform).toBe('fusha');
    expect(row.password_hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/);

    // The access token is a real, verifiable token for the new profile
    const verified = await verifyAccessToken(data.access_token, secret);
    expect(verified).toMatchObject({ sub: row.id, token_use: 'access' });

    // A duplicate registration is rejected without leaking the password hash
    const duplicate = await worker.fetch(
      post('/auth/register', { email: 'new.student@fusha.edu.eg', password: 'StrongPassw0rd!', full_name: 'طالب مكرر' }),
      envFor(),
      { waitUntil: async () => {} } as any
    );
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ error: { code: 'EMAIL_ALREADY_EXISTS' } });
  });

  it('logs in, refreshes, reads /auth/me and logs out', async () => {
    const registered = await worker.fetch(
      post('/auth/register', { email: 'cycle@fusha.edu.eg', password: 'StrongPassw0rd!', full_name: 'دورة كاملة' }),
      envFor(),
      { waitUntil: async () => {} } as any
    );
    expect(registered.status).toBe(201);

    // Wrong password -> generic 401
    const wrong = await worker.fetch(
      post('/auth/login', { email: 'cycle@fusha.edu.eg', password: 'wrong-password' }),
      envFor(),
      { waitUntil: async () => {} } as any
    );
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ error: { code: 'INVALID_CREDENTIALS' } });

    const login = await worker.fetch(
      post('/auth/login', { email: 'cycle@fusha.edu.eg', password: 'StrongPassw0rd!' }),
      envFor(),
      { waitUntil: async () => {} } as any
    );
    expect(login.status).toBe(200);
    const session = await login.json() as any;
    expect(session.access_token).toEqual(expect.any(String));
    expect(session.refresh_token).toEqual(expect.any(String));

    // /auth/me resolves the user from the access token alone
    const me = await worker.fetch(new Request('http://localhost/auth/me', {
      headers: { Authorization: `Bearer ${session.access_token}`, 'X-Platform': 'web' },
    }), envFor(), { waitUntil: async () => {} } as any);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      user: { email: 'cycle@fusha.edu.eg', full_name: 'دورة كاملة', role: 'student' },
    });

    // Refresh rotates the refresh token
    const refreshed = await worker.fetch(
      post('/auth/refresh', { refresh_token: session.refresh_token }),
      envFor(),
      { waitUntil: async () => {} } as any
    );
    expect(refreshed.status).toBe(200);
    const rotated = await refreshed.json() as any;
    expect(rotated.access_token).toEqual(expect.any(String));
    expect(rotated.refresh_token).toEqual(expect.any(String));
    expect(rotated.refresh_token).not.toBe(session.refresh_token);

    // The rotated-away token can no longer be used
    const replay = await worker.fetch(
      post('/auth/refresh', { refresh_token: session.refresh_token }),
      envFor(),
      { waitUntil: async () => {} } as any
    );
    expect(replay.status).toBe(401);
    expect(await replay.json()).toMatchObject({ error: { code: 'INVALID_REFRESH_TOKEN' } });

    // Logout revokes the current refresh token
    const logout = await worker.fetch(new Request('http://localhost/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rotated.access_token}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ refresh_token: rotated.refresh_token }),
    }), envFor(), { waitUntil: async () => {} } as any);
    expect(logout.status).toBe(200);
    expect(await logout.json()).toEqual({ ok: true });

    const afterLogout = await worker.fetch(
      post('/auth/refresh', { refresh_token: rotated.refresh_token }),
      envFor(),
      { waitUntil: async () => {} } as any
    );
    expect(afterLogout.status).toBe(401);
  });

  it('never reveals whether an email exists on POST /auth/forgot-password', async () => {
    const known = await worker.fetch(
      post('/auth/forgot-password', { email: 'student@fusha.edu.eg' }),
      envFor(),
      { waitUntil: async () => {} } as any
    );
    const unknown = await worker.fetch(
      post('/auth/forgot-password', { email: 'nobody@fusha.edu.eg' }),
      envFor(),
      { waitUntil: async () => {} } as any
    );

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual({ ok: true });
    expect(await unknown.json()).toEqual({ ok: true });

    // A reset token row is only created for the account that exists.
    const resets = await db.prepare('SELECT profile_id FROM password_resets').all();
    expect(resets.results).toHaveLength(1);
  });

  it('accepts authenticated requests without a request signature (token-only)', async () => {
    // Request signing was removed: authenticity is enforced solely by our own HS256
    // access token (AUTH_SECRET). X-Signature / X-Timestamp headers are ignored; a
    // request carrying only a valid Bearer token must succeed.
    const req = new Request('http://localhost/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'X-Device-Id': 'test-device-id',
        'X-Platform': 'android',
      },
    });

    const res = await worker.fetch(req, envFor(), { waitUntil: async () => {} } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { id: 'student-1', role: 'student' } });
  });

  it('ignores stale / invalid X-Signature headers and relies on the access token', async () => {
    const timestamp = (Date.now() - 3600_000).toString();

    const req = new Request('http://localhost/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'X-Device-Id': 'test-device-id',
        'X-Platform': 'android',
        'X-Timestamp': timestamp,
        'X-Signature': 'invalid-sig',
      },
    });

    const res = await worker.fetch(req, envFor(), { waitUntil: async () => {} } as any);
    // The token is valid, so the request still succeeds despite the bogus signature.
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ user: { id: 'student-1', role: 'student' } });
  });

  it.each(['expired', 'invalid signature'] as const)('rejects an access token with %s despite legacy signature headers', async (kind) => {
    const token = await signJWT(accessClaims({
      exp: Math.floor(Date.now() / 1000) + (kind === 'expired' ? -60 : 3600),
    }), kind === 'invalid signature' ? 'wrong-secret' : secret);

    // /auth/me and /auth/sync both exercise the real requireAuth middleware.
    for (const [route, method] of [['/auth/me', 'GET'], ['/auth/sync', 'POST']]) {
      const req = new Request(`http://localhost${route}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Platform': 'android',
          'X-Timestamp': Date.now().toString(),
          'X-Signature': 'invalid-sig',
        },
      });
      const res = await worker.fetch(req, envFor(), { waitUntil: async () => {} } as any);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: { code: 'INVALID_TOKEN' } });
    }
  });

  it('fails closed with a server error when AUTH_SECRET is not configured', async () => {
    const req = new Request('http://localhost/auth/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${testToken}`, 'X-Platform': 'android' },
    });
    const env = envFor();
    delete (env as Record<string, unknown>).AUTH_SECRET;

    const res = await worker.fetch(req, env, { waitUntil: async () => {} } as any);
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { code: 'SERVER_ERROR' } });
  });

  it('generates valid R2 presigned URLs', async () => {
    const env = {
      R2_ACCESS_KEY_ID: 'test-key-id',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
      CF_ACCOUNT_ID: 'test-account-id',
    } as any;

    const url = await getPresignedUrl(
      env,
      'test-bucket',
      'test-file.pdf',
      'application/pdf',
      false,
      'test-file.pdf'
    );

    expect(url).toBeDefined();
    expect(url).toContain('https://test-bucket.test-account-id.r2.cloudflarestorage.com/test-file.pdf');
    expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(url).toContain('X-Amz-Signature=');
  });
});

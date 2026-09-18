import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import fs from 'fs';
import path from 'path';
import worker from '../index';
import { getPresignedUrl } from '../utils/s3';
import { verifyJWTWithSecret } from '../utils/jwks';

const supabaseUrl = 'https://supabase.test';
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

// Helper to sign JWT
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

describe('Local JWT validation', () => {
  it.each(['valid', 'expired', 'invalid signature'] as const)('checks a %s JWT with the real verifier', async (kind) => {
    const payload = {
      sub: 'student-supabase-uid',
      aud: 'authenticated',
      iss: `${supabaseUrl}/auth/v1`,
      exp: Math.floor(Date.now() / 1000) + (kind === 'expired' ? -60 : 3600),
    };
    const token = await signJWT(payload, kind === 'invalid signature' ? 'wrong-secret' : 'test-secret');
    const verified = await verifyJWTWithSecret(token, 'test-secret', supabaseUrl, 'authenticated');
    expect(verified).toEqual(kind === 'valid' ? payload : null);
  });
});

describe('Batch 4 Security Features Integration Tests', () => {
  let mf: Miniflare;
  let bindings: any;
  let db: any;
  let testToken: string;

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

    // A fresh, empty JWKS fixture selects the real HS256 fallback without fetching keys.
    await bindings.KV.put('supabase:jwks', JSON.stringify({
      keys: [],
      fetchedAt: Date.now() / 1000,
    }));

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
      VALUES ('student-supabase-uid', 'student-supabase-uid', 'student@physics.com', 'student', 'Test Student', 'active', 2, 'alhadaba-chemistry', datetime('now'), datetime('now'))
    `).run();

    // Create test JWT token
    const secret = 'test-secret';
    testToken = await signJWT({
      sub: 'student-supabase-uid',
      email: 'student@physics.com',
      aud: 'authenticated',
      iss: `${supabaseUrl}/auth/v1`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, secret);
  });

  afterAll(async () => {
    if (mf) await mf.dispose();
  });

  it('should successfully sync profiles via Supabase Webhooks', async () => {
    const webhookSecret = 'test-webhook-secret';
    const env = {
      ...bindings,
      SUPABASE_WEBHOOK_SECRET: webhookSecret,
      CORS_ORIGIN: 'http://localhost',
    };

    const payload = {
      type: 'INSERT',
      table: 'profiles',
      record: {
        id: 'webhook-user-id',
        supabase_user_id: 'webhook-user-id',
        email: 'webhook@physics.com',
        role: 'student',
        full_name: 'Webhook Student',
        phone: '01011111111',
        status: 'active',
      },
    };

    const req = new Request('http://localhost/webhooks/supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookSecret}`,
      },
      body: JSON.stringify(payload),
    });

    const res = await worker.fetch(req, env, { waitUntil: async () => {} } as any);
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.ok).toBe(true);
    expect(data.action).toBe('upserted');

    // Verify record in D1 profiles
    const profile = await db.prepare("SELECT * FROM profiles WHERE id = 'webhook-user-id'").first();
    expect(profile).toBeDefined();
    expect(profile.email).toBe('webhook@physics.com');
    expect(profile.full_name).toBe('Webhook Student');
  });

  it('should accept authenticated requests without a request signature (JWT-only)', async () => {
    // Request signing was removed: authenticity is enforced solely by the Supabase
    // JWT (JWKS / shared-secret verification). X-Signature / X-Timestamp headers are
    // ignored; a request carrying only a valid Bearer token must succeed.
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };

    const path = '/auth/me';

    const req = new Request(`http://localhost${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'X-Device-Id': 'test-device-id',
        'X-Platform': 'android',
      },
    });

    const res = await worker.fetch(req, env, { waitUntil: async () => {} } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'student-supabase-uid', role: 'student' });
  });

  it('should ignore stale / invalid X-Signature headers and rely on JWT', async () => {
    // Even if a client still sends X-Signature (e.g. an older mobile build), the
    // value is not inspected. The request is admitted or rejected based on the JWT.
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };

    const timestamp = (Date.now() - 3600_000).toString();
    const path = '/auth/me';

    const req = new Request(`http://localhost${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'X-Device-Id': 'test-device-id',
        'X-Platform': 'android',
        'X-Timestamp': timestamp,
        'X-Signature': 'invalid-sig',
      },
    });

    const res = await worker.fetch(req, env, { waitUntil: async () => {} } as any);
    // The JWT is valid, so the request still succeeds despite the bogus signature.
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 'student-supabase-uid', role: 'student' });
  });

  it.each(['expired', 'invalid signature'] as const)('should reject a JWT with %s despite legacy signature headers', async (kind) => {
    const token = await signJWT({
      sub: 'student-supabase-uid',
      aud: 'authenticated',
      iss: `${supabaseUrl}/auth/v1`,
      exp: Math.floor(Date.now() / 1000) + (kind === 'expired' ? -60 : 3600),
    }, kind === 'invalid signature' ? 'wrong-secret' : 'test-secret');
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };

    // /auth/me verifies inline; /auth/sync exercises the actual requireAuth middleware.
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
      const res = await worker.fetch(req, env, { waitUntil: async () => {} } as any);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: { code: 'INVALID_TOKEN' } });
    }
  });

  it('should generate valid R2 presigned URLs', async () => {
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

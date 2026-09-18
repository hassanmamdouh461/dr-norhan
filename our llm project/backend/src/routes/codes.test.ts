import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import fs from 'fs';
import path from 'path';
import worker from '../index';

const supabaseUrl = 'https://supabase.test';
const blockedFetch = vi.fn(async () => {
  throw new Error('Unexpected outbound network request in codes.test.ts');
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

// Helper to sign JWT using HS256 and Web Crypto API
async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const base64UrlEncode = (obj: unknown) => {
    const str = JSON.stringify(obj);
    // Use Buffer to avoid browser/Node btoa mismatch in Vitest
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

describe('Activation Codes Redeem Integration Tests', () => {
  let mf: Miniflare;
  let bindings: any;
  let db: any;
  let testToken: string;
  const backgroundTasks: Promise<unknown>[] = [];

  afterEach(async () => {
    await Promise.all(backgroundTasks.splice(0));
  });

  beforeAll(async () => {
    // Spin up Miniflare
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

    // Helper to clean SQL comments to prevent D1 exec errors
    const cleanSql = (sql: string) => {
      return sql
        .split('\n')
        .map(line => line.replace(/--.*$/, '').trim())
        .filter(line => line.length > 0)
        .join(' ');
    };

    // Load and run database migrations
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

    // Seed test profiles and courses
    await db.prepare(`
      INSERT INTO profiles (id, supabase_user_id, email, role, full_name, status, max_devices, created_at, updated_at)
      VALUES ('student-1', 'student-supabase-uid', 'student@physics.com', 'student', 'Test Student', 'active', 2, datetime('now'), datetime('now'))
    `).run();

    await db.prepare(`
      INSERT INTO profiles (id, supabase_user_id, email, role, full_name, status, max_devices, created_at, updated_at)
      VALUES ('admin-1', 'admin-supabase-uid', 'admin@physics.com', 'admin', 'Test Admin', 'active', 2, datetime('now'), datetime('now'))
    `).run();

    await db.prepare(`
      INSERT INTO courses (id, title, slug, is_published, is_free, is_archived, sort_order, created_at, updated_at)
      VALUES ('course-1', 'Physics 101', 'physics-101', 1, 0, 0, 1, datetime('now'), datetime('now'))
    `).run();

    await db.prepare(`
      INSERT INTO code_batches (id, name, scope_type, course_id, quantity, created_by, created_at)
      VALUES ('batch-1', 'Batch September', 'course', 'course-1', 10, 'admin-1', datetime('now'))
    `).run();

    // Seed activation codes
    await db.prepare(`
      INSERT INTO activation_codes (id, code, batch_id, scope_type, course_id, status, max_uses, used_count, created_by, created_at)
      VALUES ('code-single', 'ACTIVE-SINGLE', 'batch-1', 'course', 'course-1', 'active', 1, 0, 'admin-1', datetime('now'))
    `).run();

    await db.prepare(`
      INSERT INTO activation_codes (id, code, batch_id, scope_type, course_id, status, max_uses, used_count, created_by, expires_at, created_at)
      VALUES ('code-expired', 'EXPIRED-CODE', 'batch-1', 'course', 'course-1', 'active', 1, 0, 'admin-1', '2020-01-01T00:00:00Z', datetime('now'))
    `).run();

    await db.prepare(`
      INSERT INTO activation_codes (id, code, batch_id, scope_type, course_id, status, max_uses, used_count, created_by, created_at)
      VALUES ('code-rollback', 'ACTIVE-ROLLBACK', 'batch-1', 'course', 'course-1', 'active', 1, 0, 'admin-1', datetime('now'))
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
    if (mf) {
      await mf.dispose();
    }
  });

  it.each([
    ['non-string code', '{"code":123}'],
    ['malformed JSON', '{"code":'],
  ])('returns a structured 400 for %s through real authentication', async (_name, body) => {
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };
    const ctx = {
      waitUntil: (promise: Promise<unknown>) => { backgroundTasks.push(promise); },
      passThroughOnException: () => {},
    };
    const before = await db.prepare('SELECT * FROM activation_codes ORDER BY id').all();
    const req = new Request('http://localhost/codes/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'X-Device-Id': 'test-device-id',
        'X-Platform': 'android',
      },
      body,
    });
    const res = await worker.fetch(req, env, ctx as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: 'BAD_REQUEST', message: expect.any(String) } });
    expect((await db.prepare('SELECT * FROM activation_codes ORDER BY id').all()).results).toEqual(before.results);
    expect((await db.prepare('SELECT * FROM enrollments').all()).results).toEqual([]);
  });

  it('should successfully redeem an active single-use code', async () => {
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };

    const ctx = {
      waitUntil: (promise: Promise<any>) => { backgroundTasks.push(promise); },
      passThroughOnException: () => {}
    };

    const req = new Request('http://localhost/codes/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'X-Device-Id': 'test-device-id',
        'X-Platform': 'android',
      },
      body: JSON.stringify({ code: 'ACTIVE-SINGLE' }),
    });

    const res = await worker.fetch(req, env, ctx as any);
    expect(res.status).toBe(200);

    const data = await res.json() as any;
    expect(data.ok).toBe(true);
    expect(data.enrolled_courses).toBe(1);

    // Verify D1 records
    const codeRow = await db.prepare("SELECT used_count, status FROM activation_codes WHERE id = 'code-single'").first();
    expect(codeRow.used_count).toBe(1);
    expect(codeRow.status).toBe('used');

    const enrollment = await db.prepare("SELECT id FROM enrollments WHERE student_id = 'student-1' AND course_id = 'course-1'").first();
    expect(enrollment).toBeDefined();
  });

  it('should fail when double-redeeming a single-use code', async () => {
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };

    const ctx = {
      waitUntil: (promise: Promise<any>) => { backgroundTasks.push(promise); },
      passThroughOnException: () => {}
    };

    // Attempt second redeem
    const req = new Request('http://localhost/codes/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'X-Device-Id': 'test-device-id',
        'X-Platform': 'android',
      },
      body: JSON.stringify({ code: 'ACTIVE-SINGLE' }),
    });

    const res = await worker.fetch(req, env, ctx as any);
    expect(res.status).toBe(400);

    const data = await res.json() as any;
    expect(data.error.code).toBe('CODE_INVALID');
  });

  it('should fail to redeem an expired code', async () => {
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };

    const ctx = {
      waitUntil: (promise: Promise<any>) => { backgroundTasks.push(promise); },
      passThroughOnException: () => {}
    };

    const req = new Request('http://localhost/codes/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`,
        'X-Device-Id': 'test-device-id',
        'X-Platform': 'android',
      },
      body: JSON.stringify({ code: 'EXPIRED-CODE' }),
    });

    const res = await worker.fetch(req, env, ctx as any);
    expect(res.status).toBe(400);

    const data = await res.json() as any;
    expect(data.error.code).toBe('CODE_EXPIRED');
  });

  it.each(['insert', 'counter'])('should roll back enrollment and consumption if the batch %s fails', async failure => {
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };

    const ctx = {
      waitUntil: (promise: Promise<any>) => { backgroundTasks.push(promise); },
      passThroughOnException: () => {}
    };

    // Clear enrollments to ensure the endpoint attempts an INSERT
    await db.prepare("DELETE FROM enrollments").run();

    const before = await db.prepare("SELECT * FROM activation_codes WHERE id = 'code-rollback'").first();
    const trigger = failure === 'insert'
      ? 'BEFORE INSERT ON enrollments'
      : "BEFORE UPDATE OF used_count ON activation_codes WHEN NEW.id = 'code-rollback'";
    await db.prepare(`
      CREATE TRIGGER force_fail ${trigger}
      BEGIN
        SELECT RAISE(FAIL, 'Forced failure for testing rollback');
      END;
    `).run();

    try {
      const req = new Request('http://localhost/codes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testToken}`,
          'X-Device-Id': 'test-device-id',
          'X-Platform': 'android',
        },
        body: JSON.stringify({ code: 'ACTIVE-ROLLBACK' }),
      });

      const res = await worker.fetch(req, env, ctx as any);
      expect(res.status).toBe(500);

      const data = await res.json() as any;
      expect(data.error.code).toBe('ENROLLMENT_FAILED');

      // Verify D1 activation_code state was rolled back
      const codeRow = await db.prepare("SELECT * FROM activation_codes WHERE id = 'code-rollback'").first();
      expect(codeRow.used_count).toBe(0);
      expect(codeRow.status).toBe('active');
      expect(codeRow).toEqual(before);
      expect((await db.prepare('SELECT * FROM enrollments').all()).results).toEqual([]);
    } finally {
      // Clean up trigger
      await db.prepare(`DROP TRIGGER force_fail`).run();
    }
  });

  it('should successfully delete a code batch and its codes', async () => {
    const env = {
      ...bindings,
      ENVIRONMENT: 'development',
      SUPABASE_URL: supabaseUrl,
      JWT_AUDIENCE: 'authenticated',
      SUPABASE_JWT_SECRET: 'test-secret',
      PLATFORM_KEY: 'alhadaba-chemistry',
      CORS_ORIGIN: 'http://localhost',
    };

    const ctx = {
      waitUntil: (promise: Promise<any>) => { backgroundTasks.push(promise); },
      passThroughOnException: () => {}
    };

    const adminToken = await signJWT({
      sub: 'admin-supabase-uid',
      email: 'admin@physics.com',
      aud: 'authenticated',
      iss: `${supabaseUrl}/auth/v1`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }, 'test-secret');

    const batchBefore = await db.prepare("SELECT id FROM code_batches WHERE id = 'batch-1'").first();
    expect(batchBefore).toEqual({ id: 'batch-1' });
    const codesBefore = await db.prepare("SELECT id FROM activation_codes WHERE batch_id = 'batch-1' ORDER BY id").all();
    expect(codesBefore.results).toEqual([
      { id: 'code-expired' },
      { id: 'code-rollback' },
      { id: 'code-single' },
    ]);

    // Attempt to delete batch-1
    const req = new Request('http://localhost/admin/codes/batches/batch-1', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'X-Platform': 'web',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const res = await worker.fetch(req, env, ctx as any);
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    const batchAfter = await db.prepare("SELECT id FROM code_batches WHERE id = 'batch-1'").first();
    expect(batchAfter).toBeNull();
    const codesAfter = await db.prepare("SELECT id FROM activation_codes WHERE batch_id = 'batch-1'").all();
    expect(codesAfter.results).toEqual([]);
    const courseAfter = await db.prepare("SELECT id FROM courses WHERE id = 'course-1'").first();
    expect(courseAfter).toEqual({ id: 'course-1' });
  });
});

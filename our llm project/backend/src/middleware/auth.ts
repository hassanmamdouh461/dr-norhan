import { createMiddleware } from 'hono/factory';
import type { HonoBindings, AuthUser } from '../types';
import { verifySupabaseJWT, verifyJWTWithSecret } from '../utils/jwks';

/**
 * requireAuth — Verifies JWT, loads user profile from D1, blocks if blocked.
 * Sets c.set('user', authUser) for downstream handlers.
 */
export const requireAuth = createMiddleware<HonoBindings>(async (c, next) => {
  let token = '';
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'توكن المصادقة مفقود' } }, 401);
  }
  const env = c.env;

  // SECURITY: Mock auth bypass was removed entirely for production hardening.
  // All authentication now goes through real JWT verification below.

  let profile: any = null;
  let opaqueUserId: string | null = null;
  let supabaseUserId: string | null = null;

  const isOpaqueToken = token.startsWith('pb_') || !token.includes('.');

  if (isOpaqueToken && env.KV) {
    const cached = await env.KV.get(`playback_token:${token}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        // SECURITY: Playback tokens have scope 'playback' and must NOT be
        // accepted by requireAuth (which grants full API access). Only the
        // video HLS endpoint uses playback tokens.
        if (data.scope && data.scope !== 'auth') {
          opaqueUserId = null;
        } else {
          opaqueUserId = data.userId;
        }
      } catch {
        // ignore
      }
    }
  }

  if (opaqueUserId) {
    // Load profile from D1 by internal ID
    profile = await env.DB.prepare(
      'SELECT id, supabase_user_id, email, role, full_name, status, max_devices, platform, last_seen_at, grade, branch FROM profiles WHERE id = ?'
    ).bind(opaqueUserId).first<{
      id: string; supabase_user_id: string; email: string;
      role: string; full_name: string; status: string; max_devices: number; platform: string; last_seen_at: string | null;
      grade: string | null; branch: string | null;
    }>();
  } else {
    // Try JWKS verification first, fallback to shared secret
    let payload = await verifySupabaseJWT(token, env.KV, env.SUPABASE_URL, env.JWT_AUDIENCE);
    if (!payload && env.SUPABASE_JWT_SECRET) {
      payload = await verifyJWTWithSecret(token, env.SUPABASE_JWT_SECRET, env.SUPABASE_URL, env.JWT_AUDIENCE);
    }

    if (!payload || !payload.sub) {
      return c.json({ error: { code: 'INVALID_TOKEN', message: 'التوكن غير صالح أو منتهي الصلاحية' } }, 401);
    }

    supabaseUserId = payload.sub as string;

    // Load profile from D1 by supabase_user_id
    profile = await env.DB.prepare(
      'SELECT id, supabase_user_id, email, role, full_name, status, max_devices, platform, last_seen_at, grade, branch FROM profiles WHERE supabase_user_id = ?'
    ).bind(supabaseUserId).first<{
      id: string; supabase_user_id: string; email: string;
      role: string; full_name: string; status: string; max_devices: number; platform: string; last_seen_at: string | null;
      grade: string | null; branch: string | null;
    }>();
  }

  if (!profile) {
    console.error('[AUTH] Profile not found for user:', supabaseUserId || opaqueUserId);
    return c.json({ error: { code: 'PROFILE_NOT_FOUND', message: 'لم يتم العثور على الملف الشخصي. يرجى مزامنة الحساب أولاً.' } }, 404);
  }

  // Verify platform matches the current server platform key
  const expectedPlatform = env.PLATFORM_KEY || 'dr-physics';
  if (profile.platform !== expectedPlatform) {
    return c.json({ error: { code: 'UNAUTHORIZED_PLATFORM', message: 'عذراً، هذا الحساب تابع لمنصة تعليمية أخرى.' } }, 403);
  }

  // Session Invalidation: Check KV blacklist
  if (env.KV) {
    const isBlacklisted = await env.KV.get(`blacklist:user:${profile.id}`);
    if (isBlacklisted) {
      return c.json({ error: { code: 'SESSION_INVALIDATED', message: 'انتهت صلاحية الجلسة أو تم إلغاؤها. يرجى تسجيل الدخول مرة أخرى.' } }, 401);
    }
  }

  if (profile.status === 'blocked') {
    return c.json({ error: { code: 'ACCOUNT_BLOCKED', message: 'تم حظر حسابك. تواصل مع المدرس.' } }, 403);
  }

  const authUser: AuthUser = {
    id: profile.id,
    supabaseUserId: profile.supabase_user_id,
    email: profile.email,
    role: profile.role as AuthUser['role'],
    status: profile.status as AuthUser['status'],
    fullName: profile.full_name,
    maxDevices: profile.max_devices,
    grade: profile.grade,
    branch: profile.branch,
  };

  c.set('user', authUser);

  // Extract mobile headers
  c.set('deviceId', c.req.header('X-Device-Id') || undefined);
  c.set('appVersion', c.req.header('X-App-Version') || undefined);
  c.set('platform', c.req.header('X-Platform') || undefined);
  c.set('clientIp', c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '');

  // Update last_seen_at (non-blocking, throttled to at most once per 15 minutes)
  const lastSeenStr = profile.last_seen_at;
  let shouldUpdate = true;
  if (lastSeenStr) {
    try {
      const lastSeenMs = Date.parse(lastSeenStr.replace(' ', 'T') + 'Z');
      if (!isNaN(lastSeenMs)) {
        const diffSeconds = (Date.now() - lastSeenMs) / 1000;
        if (diffSeconds < 900) {
          shouldUpdate = false;
        }
      }
    } catch (e) {
      // ignore parsing errors and default to updating
    }
  }

  if (shouldUpdate) {
    c.executionCtx.waitUntil(
      env.DB.prepare('UPDATE profiles SET last_seen_at = datetime(\'now\') WHERE id = ?')
        .bind(profile.id).run()
    );
  }

  await next();
});

/**
 * requireRole — Checks if user has one of the specified roles.
 */
export function requireRole(...roles: AuthUser['role'][]) {
  return createMiddleware<HonoBindings>(async (c, next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'ليس لديك صلاحية لهذا الإجراء' } }, 403);
    }
    await next();
  });
}

/**
 * requireEnrollment — Checks if student is enrolled in a course (or lesson is free preview).
 */
export function requireEnrollment(courseIdParam: string = 'courseId') {
  return createMiddleware<HonoBindings>(async (c, next) => {
    const user = c.get('user');
    if (user.role === 'admin' || user.role === 'assistant') {
      await next();
      return;
    }

    const courseId = c.req.param(courseIdParam) || c.req.query('course_id');
    if (!courseId) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'معرّف الكورس مطلوب' } }, 400);
    }

    const enrollment = await c.env.DB.prepare(
      `SELECT id, status, expires_at FROM enrollments
       WHERE student_id = ? AND course_id = ? AND status = 'active'`
    ).bind(user.id, courseId).first();

    if (!enrollment) {
      return c.json({ error: { code: 'NOT_ENROLLED', message: 'لم يتم تفعيل اشتراكك في هذا الكورس' } }, 403);
    }

    // Check if enrollment has expired
    if (enrollment.expires_at) {
      const expiresAt = new Date(enrollment.expires_at as string);
      if (expiresAt < new Date()) {
        return c.json({ error: { code: 'ENROLLMENT_EXPIRED', message: 'انتهت صلاحية اشتراكك في هذا الكورس' } }, 403);
      }
    }

    await next();
  });
}

/**
 * requireTrustedDevice — Verifies device is registered and trusted.
 */
export const requireTrustedDevice = createMiddleware<HonoBindings>(async (c, next) => {
  const user = c.get('user');
  if (user.role !== 'student') {
    await next();
    return;
  }

  const deviceId = c.get('deviceId');
  if (!deviceId) {
    return c.json({ error: { code: 'DEVICE_ID_MISSING', message: 'معرّف الجهاز مطلوب' } }, 400);
  }

  const device = await c.env.DB.prepare(
    'SELECT id, is_trusted FROM devices WHERE student_id = ? AND device_id = ?'
  ).bind(user.id, deviceId).first<{ id: string; is_trusted: number }>();

  if (!device) {
    // Check device limit
    const { count } = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM devices WHERE student_id = ?'
    ).bind(user.id).first<{ count: number }>() || { count: 0 };

    if (count >= user.maxDevices) {
      return c.json({ error: { code: 'DEVICE_NOT_REGISTERED', message: `تجاوزت الحد المسموح من الأجهزة (${user.maxDevices}). تواصل مع المدرس لتسجيل هذا الجهاز.` } }, 403);
    }

    // SECURITY: Web / unknown platforms must NOT be auto-trusted. The previous code
    // blindly set is_trusted=1 for any new device, which let a web client register
    // itself as a trusted device — defeating device binding for students who also use
    // the web app. Only native mobile clients (android / ios) keep the legacy
    // auto-trust behaviour; everything else is registered as untrusted and must be
    // approved by an admin/assistant through the device-reset flow.
    // Validate User-Agent: standard browsers cannot claim to be android/ios native
    const userAgent = c.req.header('User-Agent') || '';
    const isBrowser = /mozilla|chrome|safari|firefox|edge|opera/i.test(userAgent);
    
    let platform = c.get('platform') || 'web';
    if (isBrowser) {
      platform = 'web';
    }
    const isNativePlatform = platform === 'android' || platform === 'ios';
    const isTrusted = isNativePlatform ? 1 : 0;

    const id = crypto.randomUUID();
    const result = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
       VALUES (?, ?, ?, ?, ?, NULL, ?, 0, datetime('now'), datetime('now'))`
    ).bind(id, user.id, deviceId, platform, `Auto-registered (${platform})`, isTrusted).run();

    if (result.meta.changes === 0) {
      // Reselect to handle concurrent registration race
      const reselected = await c.env.DB.prepare(
        'SELECT id, is_trusted FROM devices WHERE student_id = ? AND device_id = ?'
      ).bind(user.id, deviceId).first<{ id: string; is_trusted: number }>();

      if (!reselected) {
        return c.json({ error: { code: 'DEVICE_NOT_REGISTERED', message: 'هذا الجهاز غير مسجل. يرجى تسجيل الجهاز أولاً.' } }, 403);
      }

      if (reselected.is_trusted !== 1) {
        return c.json({ error: { code: 'DEVICE_NOT_TRUSTED', message: 'هذا الجهاز غير موثوق. تواصل مع الدعم الفني لتفعيل جهازك.' } }, 403);
      }
    } else {
      // Post-insert verification to prevent concurrent registration race bypassing device limits
      const { postCount } = await c.env.DB.prepare(
        'SELECT COUNT(*) as postCount FROM devices WHERE student_id = ?'
      ).bind(user.id).first<{ postCount: number }>() || { postCount: 0 };

      if (postCount > user.maxDevices) {
        // Rollback the newly inserted device
        await c.env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(id).run();
        return c.json({ error: { code: 'DEVICE_LIMIT_EXCEEDED', message: `تجاوزت الحد المسموح من الأجهزة (${user.maxDevices}). تواصل مع المدرس لتسجيل هذا الجهاز.` } }, 403);
      }

      if (!isTrusted) {
        // Newly-registered untrusted device: reject immediately so the client does not
        // silently pass through with a session. Admin must approve it.
        return c.json({ error: { code: 'DEVICE_NOT_TRUSTED', message: 'تم تسجيل هذا الجهاز ولكنه غير موثّق بعد. تواصل مع الدعم الفني لتفعيل جهازك.' } }, 403);
      }
    }
  } else if (device.is_trusted !== 1) {
    return c.json({ error: { code: 'DEVICE_NOT_TRUSTED', message: 'هذا الجهاز غير موثوق. تواصل مع الدعم الفني لتفعيل جهازك.' } }, 403);
  }

  await next();
});

interface RateLimitData {
  count: number;
  reset: number;
}
const memoryRateLimits: Record<string, RateLimitData> = {};

let lastRateLimitCleanup = Date.now();
function cleanMemoryRateLimits() {
  const now = Date.now();
  if (now - lastRateLimitCleanup < 60000) return; // Clean at most once per minute
  lastRateLimitCleanup = now;

  const nowSeconds = Math.floor(now / 1000);
  for (const key in memoryRateLimits) {
    if (nowSeconds >= memoryRateLimits[key].reset) {
      delete memoryRateLimits[key];
    }
  }
}

export function rateLimit(bucket: string, maxRequests: number = 60, windowSeconds: number = 60) {
  return createMiddleware<HonoBindings>(async (c, next) => {
    const user = c.get('user');
    const key = `ratelimit:${bucket}:${user?.id || c.req.header('cf-connecting-ip') || 'anon'}`;
    const now = Math.floor(Date.now() / 1000);

    const kv = c.env.KV;
    if (kv) {
      const recordStr = await kv.get(key);
      let current = { count: 0, reset: 0 };
      if (recordStr) {
        try {
          current = JSON.parse(recordStr);
        } catch {
          // ignore
        }
      }

      if (current.count > 0 && now < current.reset) {
        if (current.count >= maxRequests) {
          return c.json({ error: { code: 'RATE_LIMITED', message: 'تجاوزت الحد المسموح من الطلبات. حاول مرة أخرى لاحقاً.' } }, 429);
        }
        await kv.put(key, JSON.stringify({ count: current.count + 1, reset: current.reset }), {
          expirationTtl: Math.max(60, current.reset - now),
        });
      } else {
        await kv.put(key, JSON.stringify({ count: 1, reset: now + windowSeconds }), {
          expirationTtl: Math.max(60, windowSeconds),
        });
      }
    } else {
      console.warn('[SECURITY] KV namespace not available — falling back to in-memory rate limiting (unreliable across Workers isolates)');
      cleanMemoryRateLimits();
      let current = memoryRateLimits[key];

      if (current && now < current.reset) {
        if (current.count >= maxRequests) {
          return c.json({ error: { code: 'RATE_LIMITED', message: 'تجاوزت الحد المسموح من الطلبات. حاول مرة أخرى لاحقاً.' } }, 429);
        }
        current.count++;
      } else {
        current = { count: 1, reset: now + windowSeconds };
        memoryRateLimits[key] = current;
      }
    }

    await next();
  });
}

/**
 * audit — Logs an action to audit_logs.
 */
export function audit(action: string) {
  return createMiddleware<HonoBindings>(async (c, next) => {
    await next();

    // Log after response (non-blocking)
    const user = c.get('user');
    const targetType = c.get('auditTargetType') || null;
    const targetId = c.get('auditTargetId') || null;
    const meta = c.get('auditMeta');
    const metaJson = meta ? JSON.stringify(meta) : null;

    const platform = c.env.PLATFORM_KEY || 'dr-physics';

    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, ip, user_agent, meta_json, platform, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        user?.id || null,
        action,
        targetType,
        targetId,
        c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '',
        c.req.header('user-agent') || '',
        metaJson,
        platform
      ).run()
    );
  });
}

/**
 * requirePermission — Checks if assistant has the specific permission, or if user is admin.
 */
export function requirePermission(permissionKey: 'can_reset_devices' | 'can_grade_quizzes' | 'can_answer_questions' | 'can_manage_codes' | 'can_manage_courses') {
  return createMiddleware<HonoBindings>(async (c, next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'توكن المصادقة مفقود' } }, 401);
    }

    // SECURITY: enforce runtime whitelist for permissionKey to prevent SQL interpolation issues
    const ALLOWED_PERMISSIONS = new Set([
      'can_reset_devices',
      'can_grade_quizzes',
      'can_answer_questions',
      'can_manage_codes',
      'can_manage_courses'
    ]);
    if (!ALLOWED_PERMISSIONS.has(permissionKey)) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'صلاحية غير صالحة' } }, 403);
    }

    // Admin bypasses all checks
    if (user.role === 'admin') {
      await next();
      return;
    }

    if (user.role === 'assistant') {
      const perm = await c.env.DB.prepare(
        'SELECT can_reset_devices, can_grade_quizzes, can_answer_questions, can_manage_codes, can_manage_courses FROM assistant_permissions WHERE assistant_id = ?'
      ).bind(user.id).first<Record<string, number>>();

      if (perm && perm[permissionKey] === 1) {
        await next();
        return;
      }
    }

    return c.json({ error: { code: 'FORBIDDEN', message: 'ليس لديك الصلاحية المطلوبة لتنفيذ هذا الإجراء' } }, 403);
  });
}

/**
 * optionalAuth — Verifies JWT if present, loads user profile from D1, but does NOT block if token is missing.
 * Sets c.set('user', authUser) if valid token, otherwise leaves it undefined.
 */
export const optionalAuth = createMiddleware<HonoBindings>(async (c, next) => {
  let token = '';
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    await next();
    return;
  }

  const env = c.env;
  let profile: any = null;
  let opaqueUserId: string | null = null;
  let supabaseUserId: string | null = null;

  const isOpaqueToken = token.startsWith('pb_') || !token.includes('.');

  if (isOpaqueToken && env.KV) {
    const cached = await env.KV.get(`playback_token:${token}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        // SECURITY: same as requireAuth — reject non-auth-scoped tokens
        if (data.scope && data.scope !== 'auth') {
          opaqueUserId = null;
        } else {
          opaqueUserId = data.userId;
        }
      } catch {
        // ignore
      }
    }
  }

  if (opaqueUserId) {
    profile = await env.DB.prepare(
      'SELECT id, supabase_user_id, email, role, full_name, status, max_devices, platform, last_seen_at, grade, branch FROM profiles WHERE id = ?'
    ).bind(opaqueUserId).first();
  } else {
    let payload = await verifySupabaseJWT(token, env.KV, env.SUPABASE_URL, env.JWT_AUDIENCE);
    if (!payload && env.SUPABASE_JWT_SECRET) {
      payload = await verifyJWTWithSecret(token, env.SUPABASE_JWT_SECRET, env.SUPABASE_URL, env.JWT_AUDIENCE);
    }

    if (payload?.sub) {
      supabaseUserId = payload.sub as string;
      profile = await env.DB.prepare(
        'SELECT id, supabase_user_id, email, role, full_name, status, max_devices, platform, last_seen_at, grade, branch FROM profiles WHERE supabase_user_id = ?'
      ).bind(supabaseUserId).first();
    }
  }

  if (profile && profile.platform === (env.PLATFORM_KEY || 'dr-physics') && profile.status !== 'blocked') {
    if (env.KV) {
      const isBlacklisted = await env.KV.get(`blacklist:user:${profile.id}`);
      if (!isBlacklisted) {
        const authUser: AuthUser = {
          id: profile.id,
          supabaseUserId: profile.supabase_user_id,
          email: profile.email,
          role: profile.role as AuthUser['role'],
          status: profile.status as AuthUser['status'],
          fullName: profile.full_name,
          maxDevices: profile.max_devices,
          grade: profile.grade,
          branch: profile.branch,
        };
        c.set('user', authUser);
      }
    } else {
      const authUser: AuthUser = {
        id: profile.id,
        supabaseUserId: profile.supabase_user_id,
        email: profile.email,
        role: profile.role as AuthUser['role'],
        status: profile.status as AuthUser['status'],
        fullName: profile.full_name,
        maxDevices: profile.max_devices,
        grade: profile.grade,
        branch: profile.branch,
      };
      c.set('user', authUser);
    }
  }

  await next();
});



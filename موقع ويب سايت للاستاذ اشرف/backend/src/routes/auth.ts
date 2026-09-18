import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env, HonoBindings } from '../types';
import { requireAuth, rateLimit } from '../middleware/auth';
import { generateId, nowISO, generateStudentCode } from '../utils/id';
import { hashPassword, verifyPassword } from '../lib/password';
import { awardPoints, REFERRAL_POINTS } from '../lib/points';
import {
  generateOpaqueToken,
  hashToken,
  signAccessToken,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../lib/jwt';

const auth = new Hono<HonoBindings>();

// الأعمدة العامة التي يجوز إرجاعها للعميل — لا تتضمن password_hash أبداً.
const PUBLIC_PROFILE_COLUMNS =
  'id, email, student_code, role, full_name, phone, parent_phone, grade, branch, governorate, avatar_url, status, platform, max_devices, created_at, updated_at';

interface ProfileRow {
  id: string;
  email: string;
  student_code: string | null;
  role: 'admin' | 'assistant' | 'student';
  full_name: string;
  phone: string | null;
  parent_phone: string | null;
  grade: string | null;
  branch: string | null;
  governorate: string | null;
  avatar_url: string | null;
  status: 'active' | 'blocked';
  platform: string;
  max_devices: number;
  created_at: string;
  updated_at: string;
}

function platformOf(env: Env): string {
  return env.PLATFORM_KEY || 'fusha';
}

function clientIp(c: Context<HonoBindings>): string {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
}

async function loadPublicProfile(env: Env, id: string): Promise<ProfileRow | null> {
  return await env.DB.prepare(
    `SELECT ${PUBLIC_PROFILE_COLUMNS} FROM profiles WHERE id = ?`
  ).bind(id).first<ProfileRow>();
}

/**
 * يُصدر رمز وصول (JWT) ورمز تجديد (معتم، مُخزَّن مُجزَّأً في D1).
 */
async function issueTokens(
  env: Env,
  profile: ProfileRow,
  meta: { userAgent?: string; ip?: string }
): Promise<{ access_token: string; refresh_token: string }> {
  const access_token = await signAccessToken(env, {
    id: profile.id,
    email: profile.email,
    role: profile.role,
  });

  const refresh_token = generateOpaqueToken();
  const tokenHash = await hashToken(refresh_token);

  await env.DB.prepare(
    `INSERT INTO refresh_tokens (id, profile_id, token_hash, platform, user_agent, ip, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+${REFRESH_TOKEN_TTL_SECONDS} seconds'), datetime('now'))`
  ).bind(
    generateId(),
    profile.id,
    tokenHash,
    platformOf(env),
    meta.userAgent || null,
    meta.ip || null
  ).run();

  return { access_token, refresh_token };
}

// ── GET /auth/check-email ──
auth.get('/check-email', rateLimit('check-email', 60, 60), async (c) => {
  const email = c.req.query('email');
  if (!email) {
    return c.json({ exists: false });
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM profiles WHERE email = ?'
  ).bind(email.trim().toLowerCase()).first();

  return c.json({ exists: !!existing });
});



// ── GET /auth/public-settings ──
auth.get('/public-settings', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT key, value FROM app_settings WHERE key IN ('academic_years', 'branches')"
  ).all();

  const settings: Record<string, string> = {};
  for (const row of results as any[]) {
    settings[row.key] = row.value;
  }

  const parseSetting = (val: string | null | undefined): string[] => {
    if (!val) return [];
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback
    }
    return val.split(',').map(s => s.trim()).filter(Boolean);
  };

  return c.json({
    academic_years: parseSetting(settings.academic_years),
    branches: parseSetting(settings.branches)
  });
});



// ── POST /auth/register — إنشاء حساب طالب جديد ──
const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional().nullable(),
  grade: z.string().trim().max(50).optional().nullable(),
  branch: z.string().trim().max(50).optional().nullable(),
  // كود الإحالة (اختياري) — كود شريك طالب آخر.
  referral_code: z.string().trim().max(20).optional().nullable(),
});

auth.post('/register', rateLimit('auth-register', 10, 900), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const { email, password, full_name, phone, grade, branch, referral_code } = parsed.data;
  const env = c.env;
  const platform = platformOf(env);

  const existing = await env.DB.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'البريد الإلكتروني مسجل بالفعل' } }, 409);
  }

  const id = generateId();
  const now = nowISO();
  const password_hash = await hashPassword(password);
  const student_code = generateStudentCode();

  try {
    await env.DB.prepare(
      `INSERT INTO profiles (id, supabase_user_id, email, password_hash, student_code, role, full_name, phone, grade, branch, status, max_devices, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'student', ?, ?, ?, ?, 'active', 2, ?, ?, ?)`
    ).bind(
      id,
      // العمود القديم supabase_user_id ما زال NOT NULL UNIQUE — نضع فيه معرّفاً فريداً غير مستخدم.
      `local-${id}`,
      email,
      password_hash,
      student_code,
      full_name,
      phone || '',
      grade || null,
      branch || null,
      platform,
      now,
      now
    ).run();
  } catch (err: any) {
    const message = String(err?.message || '');
    if (message.includes('UNIQUE') || message.includes('constraint')) {
      return c.json({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'البريد الإلكتروني مسجل بالفعل' } }, 409);
    }
    throw err;
  }

  // نظام الإحالة: يُنشأ سجل الإحالة ويُمنح الشريك نقاطاً.
  const referralResult = await applyReferral(env, {
    newStudentId: id,
    referralCode: referral_code,
    platform,
  });

  const profile = await loadPublicProfile(env, id);
  if (!profile) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'تعذّر إنشاء الحساب. حاول مرة أخرى.' } }, 500);
  }

  const tokens = await issueTokens(env, profile, {
    userAgent: c.req.header('user-agent'),
    ip: clientIp(c),
  });

  return c.json({ ...tokens, user: profile, referral: referralResult }, 201);
});

/**
 * يطبّق كود الإحالة عند التسجيل: يسجّل الاستخدام ويمنح الشريك نقاطاً.
 * لا يفشل التسجيل أبداً بسبب كود إحالة غير صالح.
 */
async function applyReferral(
  env: Env,
  input: { newStudentId: string; referralCode?: string | null; platform: string }
): Promise<{ applied: boolean; referrer_id?: string; points_awarded?: number }> {
  const code = (input.referralCode || '').trim().toUpperCase();
  if (!code) return { applied: false };

  try {
    const referrer = await env.DB.prepare(
      "SELECT id FROM profiles WHERE student_code = ? AND platform = ? AND role = 'student' AND id <> ?"
    ).bind(code, input.platform, input.newStudentId).first<{ id: string }>();

    if (!referrer) return { applied: false };

    await env.DB.prepare(
      `INSERT OR IGNORE INTO referral_uses (id, platform, referrer_id, referred_id, code, points_awarded, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(generateId(), input.platform, referrer.id, input.newStudentId, code, REFERRAL_POINTS).run();

    const awarded = await awardPoints(env, referrer.id, REFERRAL_POINTS, 'referral', {
      referenceId: input.newStudentId,
      note: `إحالة الطالب ${input.newStudentId}`,
    });

    return { applied: true, referrer_id: referrer.id, points_awarded: awarded.awarded };
  } catch (err) {
    console.error('[AUTH] Referral application failed:', err);
    return { applied: false };
  }
}



// ── POST /auth/login — تسجيل الدخول بالبريد أو الهاتف ──
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).optional(),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(1).max(200),
});

auth.post('/login', rateLimit('auth-login', 10, 300), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const { email, phone, password } = parsed.data;
  const identifier = email || phone;
  if (!identifier) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'البريد الإلكتروني أو رقم الهاتف مطلوب' } }, 400);
  }

  const env = c.env;
  const row = await env.DB.prepare(
    'SELECT id, status, platform, password_hash FROM profiles WHERE email = ? OR phone = ? LIMIT 1'
  ).bind(identifier, identifier).first<{ id: string; status: string; platform: string; password_hash: string | null }>();

  // رسالة موحّدة حتى لا نكشف وجود الحساب من عدمه.
  const invalidCredentials = () =>
    c.json({ error: { code: 'INVALID_CREDENTIALS', message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' } }, 401);

  if (!row) return invalidCredentials();

  const passwordOk = await verifyPassword(password, row.password_hash);
  if (!passwordOk) return invalidCredentials();

  if (row.platform !== platformOf(env)) {
    return c.json({ error: { code: 'UNAUTHORIZED_PLATFORM', message: 'عذراً، هذا الحساب تابع لمنصة تعليمية أخرى.' } }, 403);
  }

  if (row.status === 'blocked') {
    return c.json({ error: { code: 'ACCOUNT_BLOCKED', message: 'تم حظر حسابك. تواصل مع المدرس.' } }, 403);
  }

  const profile = await loadPublicProfile(env, row.id);
  if (!profile) return invalidCredentials();

  const tokens = await issueTokens(env, profile, {
    userAgent: c.req.header('user-agent'),
    ip: clientIp(c),
  });

  return c.json({ ...tokens, user: profile });
});



// ── POST /auth/refresh — تجديد رمز الوصول (مع تدوير رمز التجديد) ──
const refreshSchema = z.object({ refresh_token: z.string().min(1).max(500) });

auth.post('/refresh', rateLimit('auth-refresh', 60, 300), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } }, 400);
  }

  const env = c.env;
  const tokenHash = await hashToken(parsed.data.refresh_token);

  const stored = await env.DB.prepare(
    `SELECT id, profile_id FROM refresh_tokens
     WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')`
  ).bind(tokenHash).first<{ id: string; profile_id: string }>();

  const invalid = () =>
    c.json({ error: { code: 'INVALID_REFRESH_TOKEN', message: 'رمز التجديد غير صالح أو منتهي الصلاحية' } }, 401);

  if (!stored) return invalid();

  const profile = await loadPublicProfile(env, stored.profile_id);
  if (!profile) return invalid();

  if (profile.platform !== platformOf(env)) {
    return c.json({ error: { code: 'UNAUTHORIZED_PLATFORM', message: 'عذراً، هذا الحساب تابع لمنصة تعليمية أخرى.' } }, 403);
  }

  if (profile.status === 'blocked') {
    return c.json({ error: { code: 'ACCOUNT_BLOCKED', message: 'تم حظر حسابك. تواصل مع المدرس.' } }, 403);
  }

  // تدوير: إلغاء الرمز القديم ثم إصدار زوج جديد.
  await env.DB.prepare(
    "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?"
  ).bind(stored.id).run();

  const tokens = await issueTokens(env, profile, {
    userAgent: c.req.header('user-agent'),
    ip: clientIp(c),
  });

  return c.json(tokens);
});



// ── POST /auth/logout — إلغاء رمز التجديد ──
const logoutSchema = z.object({ refresh_token: z.string().min(1).max(500).optional() });

auth.post('/logout', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = logoutSchema.safeParse(body ?? {});
  const provided = parsed.success ? parsed.data.refresh_token : undefined;

  if (provided) {
    const tokenHash = await hashToken(provided);
    await c.env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ? AND profile_id = ? AND revoked_at IS NULL"
    ).bind(tokenHash, user.id).run();
  } else {
    // بلا رمز تجديد محدد: إلغاء كل جلسات هذا المستخدم.
    await c.env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE profile_id = ? AND revoked_at IS NULL"
    ).bind(user.id).run();
  }

  return c.json({ ok: true });
});



// ── GET /auth/me — الملف الشخصي للمستخدم الحالي ──
auth.get('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const profile = await loadPublicProfile(c.env, user.id);
  if (!profile) {
    return c.json({ error: { code: 'PROFILE_NOT_FOUND', message: 'لم يتم العثور على الملف الشخصي.' } }, 404);
  }
  return c.json({ user: profile });
});



// ── PATCH /me — تعديل الملف الشخصي ──
const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  parent_phone: z.string().trim().max(20).optional(),
  grade: z.string().trim().max(50).optional(),
  governorate: z.string().trim().max(50).optional(),
  branch: z.string().trim().max(50).optional().nullable(),
});

auth.patch('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const fields = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (updates.length === 0) {
    return c.json({ error: { code: 'NO_CHANGES', message: 'لا توجد تعديلات' } }, 400);
  }

  updates.push("updated_at = datetime('now')");
  values.push(user.id);

  await c.env.DB.prepare(
    `UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const profile = await loadPublicProfile(c.env, user.id);
  return c.json({ user: profile });
});



// ── POST /auth/forgot-password — طلب رابط إعادة التعيين ──
const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

auth.post('/forgot-password', rateLimit('auth-forgot-password', 5, 900), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بريد إلكتروني غير صحيح' } }, 400);
  }

  const env = c.env;
  const email = parsed.data.email;

  const profile = await env.DB.prepare('SELECT id FROM profiles WHERE email = ?').bind(email).first<{ id: string }>();

  // لا نكشف أبداً ما إذا كان البريد مسجّلاً أم لا.
  if (profile) {
    // إبطال أي رموز استعادة سابقة غير مستخدمة.
    await env.DB.prepare(
      "UPDATE password_resets SET used_at = datetime('now') WHERE profile_id = ? AND used_at IS NULL"
    ).bind(profile.id).run();

    const token = generateOpaqueToken();
    const tokenHash = await hashToken(token);
    await env.DB.prepare(
      `INSERT INTO password_resets (id, profile_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, datetime('now', '+1 hour'), datetime('now'))`
    ).bind(generateId(), profile.id, tokenHash).run();

    // لا يوجد مزوّد بريد مُهيّأ بعد؛ في بيئة التطوير نطبع الرمز لتسهيل الاختبار.
    if (env.ENVIRONMENT !== 'production') {
      console.log(`[AUTH] Password reset token for ${email}: ${token}`);
    }
  }

  return c.json({ ok: true });
});



// ── POST /auth/reset-password — تعيين كلمة مرور جديدة برمز لمرة واحدة ──
const resetSchema = z.object({
  token: z.string().min(1).max(500),
  password: z.string().min(8).max(200),
});

auth.post('/reset-password', rateLimit('auth-reset-password', 10, 900), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const env = c.env;
  const tokenHash = await hashToken(parsed.data.token);

  const reset = await env.DB.prepare(
    `SELECT id, profile_id FROM password_resets
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`
  ).bind(tokenHash).first<{ id: string; profile_id: string }>();

  if (!reset) {
    return c.json({ error: { code: 'INVALID_RESET_TOKEN', message: 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية' } }, 400);
  }

  const password_hash = await hashPassword(parsed.data.password);

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(password_hash, reset.profile_id),
    env.DB.prepare(
      "UPDATE password_resets SET used_at = datetime('now') WHERE id = ?"
    ).bind(reset.id),
    // إلغاء كل الجلسات القائمة بعد تغيير كلمة المرور.
    env.DB.prepare(
      "UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE profile_id = ? AND revoked_at IS NULL"
    ).bind(reset.profile_id),
  ]);

  return c.json({ ok: true });
});



// ── POST /auth/sync — مزامنة الملف الشخصي (يوجد بالفعل بعد نجاح المصادقة) ──
auth.post('/sync', requireAuth, async (c) => {
  // requireAuth already loaded the profile; if we reach here the profile exists
  const user = c.get('user');
  return c.json({ ok: true, student: user, profile: user });
});

// ── POST /me/avatar — Upload student profile photo (raw image body) ──
auth.post('/me/avatar', requireAuth, async (c) => {
  const user = c.get('user');
  const contentType = c.req.header('Content-Type') || 'image/jpeg';
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(contentType)) {
    return c.json({ error: { code: 'INVALID_TYPE', message: 'نوع الملف غير مدعوم. المسموح فقط: JPEG, PNG, WEBP' } }, 400);
  }

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) {
    return c.json({ error: { code: 'EMPTY_FILE', message: 'الصورة فارغة' } }, 400);
  }
  if (body.byteLength > 5 * 1024 * 1024) {
    return c.json({ error: { code: 'TOO_LARGE', message: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' } }, 413);
  }

  // Sniff magic bytes
  const uint8 = new Uint8Array(body);
  let detectedType = '';
  // JPEG: FF D8 FF
  if (uint8[0] === 0xFF && uint8[1] === 0xD8 && uint8[2] === 0xFF) {
    detectedType = 'image/jpeg';
  }
  // PNG: 89 50 4E 47
  else if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
    detectedType = 'image/png';
  }
  // WEBP: RIFF...WEBP
  else if (
    uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46 &&
    uint8[8] === 0x57 && uint8[9] === 0x45 && uint8[10] === 0x42 && uint8[11] === 0x50
  ) {
    detectedType = 'image/webp';
  }

  if (!detectedType) {
    return c.json({ error: { code: 'INVALID_IMAGE', message: 'محتوى الصورة غير صالح أو غير مدعوم (JPEG/PNG/WEBP فقط)' } }, 400);
  }

  const key = `avatars/${user.id}`;
  await c.env.R2.put(key, body, { httpMetadata: { contentType: detectedType } });

  // رابط عام للعرض + بصمة زمنية لكسر الكاش عند التحديث
  const origin = new URL(c.req.url).origin;
  const avatarUrl = `${origin}/files/avatars/${user.id}?v=${Date.now()}`;

  await c.env.DB.prepare(
    "UPDATE profiles SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(avatarUrl, user.id).run();

  return c.json({ ok: true, avatar_url: avatarUrl });
});

// ── POST /me/devices — Register/update device ──
const deviceSchema = z.object({
  device_id: z.string().min(1),
  platform: z.enum(['android', 'ios', 'web']),
  model: z.string().optional(),
  push_token: z.string().optional(),
  is_rooted: z.boolean().optional(),
});

auth.post('/me/devices', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = deviceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات الجهاز غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const d = parsed.data;

  // Check if device already registered
  const existing = await c.env.DB.prepare(
    'SELECT id FROM devices WHERE student_id = ? AND device_id = ?'
  ).bind(user.id, d.device_id).first();

  if (existing) {
    // Update existing
    await c.env.DB.prepare(
      `UPDATE devices SET push_token = ?, model = ?, is_rooted = ?, last_login_at = datetime('now') WHERE id = ?`
    ).bind(d.push_token || null, d.model || null, d.is_rooted ? 1 : 0, existing.id).run();
    return c.json({ ok: true, device_id: existing.id, new: false });
  }

  // Check device limit
  const { count } = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM devices WHERE student_id = ?'
  ).bind(user.id).first<{ count: number }>() || { count: 0 };

  if (count >= user.maxDevices) {
    return c.json({ error: { code: 'DEVICE_LIMIT_EXCEEDED', message: `تجاوزت الحد المسموح من الأجهزة (${user.maxDevices}). تواصل مع المدرس.` } }, 423);
  }

  // Web devices require approval; retain native auto-trust.
  const id = generateId();
  const isTrusted = d.platform === 'web' ? 0 : 1;
  await c.env.DB.prepare(
    `INSERT INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, user.id, d.device_id, d.platform, d.model || null, d.push_token || null, isTrusted, d.is_rooted ? 1 : 0).run();

  return c.json({ ok: true, device_id: id, new: true }, 201);
});

// ── GET /me/devices — List my devices ──
auth.get('/me/devices', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    'SELECT id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at FROM devices WHERE student_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all();
  return c.json({ devices: results });
});

// ── DELETE /me/devices/:id — Unlink a device ──
auth.delete('/me/devices/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const deviceDbId = c.req.param('id');

  const device = await c.env.DB.prepare(
    'SELECT id FROM devices WHERE id = ? AND student_id = ?'
  ).bind(deviceDbId, user.id).first();

  if (!device) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الجهاز غير موجود' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM devices WHERE id = ?').bind(deviceDbId).run();
  return c.json({ ok: true });
});

// ── GET /me/financials — Get student's own financial/renewal history ──
auth.get('/me/financials', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT ft.*, c.title as course_title, ac.code as code_string
     FROM financial_transactions ft
     LEFT JOIN courses c ON ft.course_id = c.id
     LEFT JOIN activation_codes ac ON ft.code_id = ac.id
     WHERE ft.student_id = ?
     ORDER BY ft.created_at DESC`
  ).bind(user.id).all();
  return c.json({ financials: results });
});

// ── GET /me/playback-logs — Get student's own lecture open/close history ──
auth.get('/me/playback-logs', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT lpl.*, l.title as lesson_title, l.course_id as course_id
     FROM lecture_playback_logs lpl
     INNER JOIN lessons l ON lpl.lesson_id = l.id
     WHERE lpl.student_id = ?
     ORDER BY lpl.created_at DESC
     LIMIT 100`
  ).bind(user.id).all();
  return c.json({ playback_logs: results });
});

// ── GET /me/quizzes/attempts — Get student's own quiz grades/history ──
auth.get('/me/quizzes/attempts', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT qa.*, q.title as quiz_title, q.max_score
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON qa.quiz_id = q.id
     WHERE qa.student_id = ?
     ORDER BY qa.submitted_at DESC`
  ).bind(user.id).all();
  return c.json({ quiz_attempts: results });
});

// ── POST /me/devices/reset-request — Submit a self-service device reset request ──
auth.post('/me/devices/reset-request', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const schema = z.object({
    device_id: z.string().min(1),
    platform: z.enum(['android', 'ios', 'web']),
    model: z.string().optional(),
    reason: z.string().min(5),
    proof_image_url: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات الطلب غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const d = parsed.data;

  // Check if there is already a pending request
  const existing = await c.env.DB.prepare(
    "SELECT id FROM device_reset_requests WHERE student_id = ? AND status = 'pending'"
  ).bind(user.id).first();

  if (existing) {
    return c.json({ error: { code: 'PENDING_REQUEST_EXISTS', message: 'لديك طلب فك أجهزة قيد المراجعة بالفعل' } }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO device_reset_requests (id, student_id, device_id, platform, model, reason, proof_image_url, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
  ).bind(id, user.id, d.device_id, d.platform, d.model || null, d.reason, d.proof_image_url || null).run();

  return c.json({ ok: true, request_id: id }, 201);
});

// ── GET /me/devices/reset-requests — Get student's own requests ──
auth.get('/me/devices/reset-requests', requireAuth, async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT id, device_id, platform, model, reason, proof_image_url, status, rejection_reason AS admin_notes, created_at, updated_at FROM device_reset_requests WHERE student_id = ? ORDER BY created_at DESC`
  ).bind(user.id).all();
  return c.json({ reset_requests: results });
});

export default auth;

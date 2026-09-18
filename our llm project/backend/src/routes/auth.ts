import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, rateLimit } from '../middleware/auth';
import { generateId, nowISO } from '../utils/id';

const auth = new Hono<HonoBindings>();

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



// ── POST /auth/sync — Create or sync profile on first sign-in ──
auth.post('/sync', requireAuth, async (c) => {
  // requireAuth already loaded the profile; if we reach here the profile exists
  const user = c.get('user');
  return c.json({ ok: true, student: user, profile: user });
});

// Zod schema for first sign-in sync body validation
const syncFirstSchema = z.object({
  full_name: z.string().min(2).max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  parent_phone: z.string().max(20).optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  governorate: z.string().max(50).optional().nullable(),
  branch: z.string().max(50).optional().nullable(),
});

// Override: allow sync without profile existing (for first-time users)
auth.post('/sync-first', rateLimit('sync-first', 5, 300), async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'توكن المصادقة مفقود' } }, 401);
  }
  const token = authHeader.slice(7);
  const env = c.env;

  // Verify token
  const { verifySupabaseJWT, verifyJWTWithSecret } = await import('../utils/jwks');
  let payload = await verifySupabaseJWT(token, env.KV, env.SUPABASE_URL, env.JWT_AUDIENCE);
  if (!payload && env.SUPABASE_JWT_SECRET) {
    payload = await verifyJWTWithSecret(token, env.SUPABASE_JWT_SECRET, env.SUPABASE_URL, env.JWT_AUDIENCE);
  }
  if (!payload?.sub) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'التوكن غير صالح' } }, 401);
  }

  const supabaseUserId = payload.sub as string;
  const email = (payload.email as string) || '';
  const currentPlatform = env.PLATFORM_KEY || 'dr-physics';

  // Upsert profile
  const existing = await env.DB.prepare(
    'SELECT id, role, full_name, status, platform FROM profiles WHERE supabase_user_id = ?'
  ).bind(supabaseUserId).first<{ id: string; role: string; full_name: string; status: string; platform: string }>();

  // Parse optional body for name/phone/grade
  let body: Record<string, string> = {};
  try { body = await c.req.json(); } catch { /* empty body is fine */ }

  const parsed = syncFirstSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const fields = parsed.data;

  if (existing) {
    // If the existing profile is for a different platform, deny access
    if (existing.platform !== currentPlatform) {
      return c.json({ error: { code: 'UNAUTHORIZED_PLATFORM', message: 'عذراً، هذا الحساب تابع لمنصة تعليمية أخرى.' } }, 403);
    }

    // If the existing profile has missing details and we have new details, update them
    if (fields.full_name || fields.phone || fields.parent_phone || fields.grade || fields.governorate || fields.branch) {
      const updates: string[] = [];
      const values: unknown[] = [];
      if (fields.full_name) { updates.push('full_name = ?'); values.push(fields.full_name); }
      if (fields.phone) { updates.push('phone = ?'); values.push(fields.phone); }
      if (fields.parent_phone) { updates.push('parent_phone = ?'); values.push(fields.parent_phone); }
      if (fields.grade) { updates.push('grade = ?'); values.push(fields.grade); }
      if (fields.governorate) { updates.push('governorate = ?'); values.push(fields.governorate); }
      if (fields.branch) { updates.push('branch = ?'); values.push(fields.branch); }
      updates.push("updated_at = datetime('now')");
      values.push(existing.id);

      await env.DB.prepare(
        `UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...values).run();
    }

    const updatedProfile = await env.DB.prepare('SELECT id, email, student_code, role, full_name, phone, parent_phone, grade, branch, governorate, avatar_url, status, platform, created_at, updated_at FROM profiles WHERE id = ?').bind(existing.id).first();
    return c.json({ ok: true, student: updatedProfile, profile: updatedProfile, created: false });
  }

  const id = generateId();
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO profiles (id, supabase_user_id, email, role, full_name, phone, parent_phone, grade, governorate, branch, status, max_devices, platform, created_at, updated_at)
     VALUES (?, ?, ?, 'student', ?, ?, ?, ?, ?, ?, 'active', 2, ?, ?, ?)`
  ).bind(id, supabaseUserId, email, fields.full_name || '', fields.phone || '', fields.parent_phone || null, fields.grade || '', fields.governorate || '', fields.branch || null, currentPlatform, now, now).run();

  const profile = await env.DB.prepare('SELECT id, email, student_code, role, full_name, phone, parent_phone, grade, branch, governorate, avatar_url, status, platform, created_at, updated_at FROM profiles WHERE id = ?').bind(id).first();
  return c.json({ ok: true, student: profile, profile, created: true }, 201);
});

// ── GET /me — Get current user profile ──
auth.get('/me', async (c) => {
  let token = '';
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'توكن المصادقة مفقود' } }, 401);
  }

  const env = c.env;
  let supabaseUserId: string | null = null;

  // Verify token
  const { verifySupabaseJWT, verifyJWTWithSecret } = await import('../utils/jwks');
  let payload = await verifySupabaseJWT(token, env.KV, env.SUPABASE_URL, env.JWT_AUDIENCE);
  if (!payload && env.SUPABASE_JWT_SECRET) {
    payload = await verifyJWTWithSecret(token, env.SUPABASE_JWT_SECRET, env.SUPABASE_URL, env.JWT_AUDIENCE);
  }

  if (!payload || !payload.sub) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'التوكن غير صالح أو منتهي الصلاحية' } }, 401);
  }

  supabaseUserId = payload.sub as string;

  const profile = await env.DB.prepare(
    `SELECT p.id, p.email, p.student_code, p.role, p.full_name, p.phone, p.parent_phone, p.grade, p.branch, p.governorate, p.avatar_url, p.status, p.platform, p.created_at, p.updated_at,
            (SELECT COUNT(*) FROM enrollments WHERE student_id = p.id AND status = 'active') as enrollments_count
     FROM profiles p WHERE p.supabase_user_id = ?`
  ).bind(supabaseUserId).first<{
    id: string; email: string; student_code: string; role: string; full_name: string;
    phone: string; parent_phone: string; grade: string; branch: string; governorate: string;
    avatar_url: string; status: string; platform: string; created_at: string; updated_at: string;
    enrollments_count: number;
  }>();

  if (!profile) {
    return c.json({ error: { code: 'PROFILE_NOT_FOUND', message: 'لم يتم العثور على الملف الشخصي. يرجى مزامنة الحساب أولاً.' } }, 200);
  }

  const expectedPlatform = env.PLATFORM_KEY || 'dr-physics';
  if (profile.platform !== expectedPlatform) {
    return c.json({ error: { code: 'UNAUTHORIZED_PLATFORM', message: 'عذراً، هذا الحساب تابع لمنصة تعليمية أخرى.' } }, 403);
  }

  if (profile.status === 'blocked') {
    return c.json({ error: { code: 'ACCOUNT_BLOCKED', message: 'تم حظر حسابك. تواصل مع المدرس.' } }, 403);
  }

  return c.json({ student: profile, ...profile });
});

// ── PATCH /me — Update profile ──
const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  parent_phone: z.string().max(20).optional(),
  grade: z.string().max(50).optional(),
  governorate: z.string().max(50).optional(),
  branch: z.string().max(50).optional().nullable(),
});

auth.patch('/me', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
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

  const updated = await c.env.DB.prepare('SELECT id, email, student_code, role, full_name, phone, parent_phone, grade, branch, governorate, avatar_url, status, created_at, updated_at FROM profiles WHERE id = ?').bind(user.id).first();
  return c.json(updated);
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

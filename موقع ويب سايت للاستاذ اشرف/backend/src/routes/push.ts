import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { optionalAuth, rateLimit } from '../middleware/auth';
import { generateId, nowISO } from '../utils/id';

const push = new Hono<HonoBindings>();

// ── POST /push/subscribe — Register/refresh an FCM push token ──
//
// PUBLIC: no login required. Called by the app on startup (even for guests who
// only downloaded the app) and by the web client. If a valid auth token is
// present, the subscription is linked to that student so course/user-targeted
// notifications also reach them. New anonymous subscriptions receive only
// "all" broadcasts; anonymous calls cannot rotate a linked subscription's token.
const subscribeSchema = z.object({
  device_id: z.string().min(1).max(200),
  platform: z.enum(['android', 'ios', 'web']),
  push_token: z.string().min(10).max(500),
});

push.post('/subscribe', optionalAuth, rateLimit('push_subscribe', 30, 60), async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } }, 400);
  }

  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } }, 400);
  }
  const d = parsed.data;

  const user = c.get('user'); // may be undefined (anonymous install)
  const platformKey = c.env.PLATFORM_KEY || 'fusha';
  const now = nowISO();

  // Check ownership in the write, not in a racy preflight. Anonymous callers
  // may refresh unlinked rows or touch an unchanged linked token, never rotate it.
  // A valid login can reassign a shared install, atomically replacing the old
  // student identity along with its token; device_id alone is not ownership proof.
  const result = await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (id, device_id, platform, push_token, student_id, platform_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(device_id, platform_key) DO UPDATE SET
       push_token = excluded.push_token,
       platform   = CASE
         WHEN excluded.student_id IS NOT NULL OR push_subscriptions.student_id IS NULL
         THEN excluded.platform ELSE push_subscriptions.platform END,
       student_id = COALESCE(excluded.student_id, push_subscriptions.student_id),
       updated_at = excluded.updated_at
     WHERE excluded.student_id IS NOT NULL
        OR push_subscriptions.student_id IS NULL
        OR push_subscriptions.push_token = excluded.push_token`
  ).bind(generateId(), d.device_id, d.platform, d.push_token, user?.id ?? null, platformKey, now, now).run();

  if (result.meta.changes === 0) {
    return c.json({ error: { code: 'PUSH_OWNERSHIP_REQUIRED', message: 'Sign in to update this subscription.' } }, 403);
  }

  return c.json({ ok: true });
});

// ── POST /push/unsubscribe — Drop a token (e.g. permission revoked client-side) ──
push.post('/unsubscribe', optionalAuth, rateLimit('push_unsubscribe', 30, 60), async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } }, 400);
  }
  const schema = z.object({ device_id: z.string().min(1).max(200) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة' } }, 400);
  }
  const platformKey = c.env.PLATFORM_KEY || 'fusha';
  const user = c.get('user');
  // Preserve legacy anonymous deletion only for unlinked rows. Recheck the
  // linked owner in SQL so concurrent login/reassignment cannot bypass it.
  const result = await c.env.DB.prepare(
    `DELETE FROM push_subscriptions WHERE device_id = ? AND platform_key = ?
       AND (student_id IS NULL OR student_id = ?)`
  ).bind(parsed.data.device_id, platformKey, user?.id ?? null).run();
  if (result.meta.changes === 0) {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM push_subscriptions WHERE device_id = ? AND platform_key = ?'
    ).bind(parsed.data.device_id, platformKey).first();
    if (existing) {
      return c.json({ error: { code: 'PUSH_OWNERSHIP_REQUIRED', message: 'Only the signed-in owner can remove this subscription.' } }, 403);
    }
  }
  return c.json({ ok: true });
});

export default push;

import { Hono } from 'hono';
import type { HonoBindings } from '../types';

const webhooks = new Hono<HonoBindings>();

// Allowed roles that can be set via webhook — NEVER allow 'admin'
const ALLOWED_WEBHOOK_ROLES = new Set(['student']);

webhooks.post('/supabase', async (c) => {
  const authHeader = c.req.header('Authorization');
  const secret = c.env.SUPABASE_WEBHOOK_SECRET;

  // SECURITY: Webhook secret is REQUIRED — fail closed
  if (!secret) {
    console.error('[SECURITY] SUPABASE_WEBHOOK_SECRET is not configured. Rejecting webhook.');
    return c.json({ error: { code: 'SERVER_ERROR', message: 'Webhook endpoint is not configured' } }, 500);
  }

  const expectedHeader = `Bearer ${secret}`;
  const encoder = new TextEncoder();
  
  // Calculate SHA-256 of both to compare in constant time and avoid length leak
  const aHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(authHeader || '')));
  const bHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(expectedHeader)));
  
  let mismatch = 0;
  for (let i = 0; i < 32; i++) {
    mismatch |= aHash[i] ^ bHash[i];
  }
  
  if (mismatch !== 0) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid webhook secret' } }, 401);
  }

  const body = await c.req.json() as any;
  const db = c.env.DB;

  // Handle Supabase database webhook payload or custom user event payload
  const table = body.table || (body.type ? 'profiles' : null);
  const type = body.type || body.event; // e.g. "INSERT", "UPDATE", "DELETE", or "user.created", etc.
  const record = body.record || body.data;

  if (!record) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'No record data found' } }, 400);
  }

  // Profile Sync
  if (table === 'profiles' || type?.startsWith('user.')) {
    const userId = record.id || record.supabase_user_id;
    const email = record.email;

    if (!userId || !email) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing user ID or email in record' } }, 400);
    }

    if (type === 'DELETE' || type === 'user.deleted') {
      await db.prepare(
        `UPDATE profiles SET status = 'blocked', updated_at = datetime('now') WHERE id = ? OR supabase_user_id = ?`
      ).bind(userId, userId).run();

      // Add to KV blacklist for instant session invalidation
      if (c.env.KV) {
        const profile = await db.prepare('SELECT id FROM profiles WHERE id = ? OR supabase_user_id = ?').bind(userId, userId).first<{ id: string }>();
        const internalId = profile?.id || userId;
        await c.env.KV.put(`blacklist:user:${internalId}`, '1', { expirationTtl: 86400 });
      }
      return c.json({ ok: true, action: 'deleted' });
    }

    // SECURITY: Restrict roles — webhook can ONLY create students, never admin/assistant
    const role = ALLOWED_WEBHOOK_ROLES.has(record.role) ? record.role : 'student';
    const fullName = record.full_name || '';
    const phone = record.phone || '';
    const parentPhone = record.parent_phone || null;
    const grade = record.grade || null;
    const governorate = record.governorate || null;
    const status = record.status || 'active';
    const maxDevices = record.max_devices || 2;

    // Sync status to KV blacklist
    if (c.env.KV) {
      const profile = await db.prepare('SELECT id FROM profiles WHERE id = ? OR supabase_user_id = ?').bind(userId, userId).first<{ id: string }>();
      const internalId = profile?.id || userId;
      if (status === 'blocked') {
        await c.env.KV.put(`blacklist:user:${internalId}`, '1', { expirationTtl: 86400 });
      } else if (status === 'active') {
        await c.env.KV.delete(`blacklist:user:${internalId}`);
      }
    }

    const currentPlatform = c.env.PLATFORM_KEY || 'dr-physics';

    await db.prepare(`
      INSERT INTO profiles (
        id, supabase_user_id, email, role, full_name, phone, parent_phone, grade, governorate, status, max_devices, platform, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        supabase_user_id = excluded.supabase_user_id,
        email = excluded.email,
        full_name = COALESCE(excluded.full_name, profiles.full_name),
        phone = COALESCE(excluded.phone, profiles.phone),
        parent_phone = COALESCE(excluded.parent_phone, profiles.parent_phone),
        grade = COALESCE(excluded.grade, profiles.grade),
        governorate = COALESCE(excluded.governorate, profiles.governorate),
        status = COALESCE(excluded.status, profiles.status),
        max_devices = COALESCE(excluded.max_devices, profiles.max_devices),
        platform = COALESCE(excluded.platform, profiles.platform),
        updated_at = datetime('now')
    `).bind(
      userId, userId, email, role, fullName, phone, parentPhone, grade, governorate, status, maxDevices, currentPlatform
    ).run();

    return c.json({ ok: true, action: 'upserted' });
  }

  return c.json({ ok: true, message: 'Webhook event ignored' });
});

export default webhooks;

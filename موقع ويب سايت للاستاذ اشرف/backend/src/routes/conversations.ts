import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, rateLimit } from '../middleware/auth';
import { generateId } from '../utils/id';
import { getPresignedPutUrl } from '../utils/s3';

const conversations = new Hono<HonoBindings>();

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

/** الحد الأقصى لحجم/مدة الرسالة الصوتية. */
export const VOICE_MAX_SECONDS = 300;
const MESSAGE_MAX_LENGTH = 4000;

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.8). */
export const CONVERSATION_LABELS = {
  title: 'مجموعة الطلاب والمعلم',
  placeholder: 'اكتب رسالتك...',
  voice_message: 'رسالة صوتية ({m:ss})',
  error_mic_permission: 'يجب السماح بالوصول إلى الميكروفون',
  error_record_start: 'فشل في بدء التسجيل: {msg}',
  error_record_stop: 'فشل في إيقاف التسجيل',
  error_play: 'فشل في تشغيل الصوت',
  loading: 'جاري تحميل الرسائل...',
  empty: 'لا توجد رسائل بعد',
  send: 'إرسال',
} as const;

/** يحوّل الثواني إلى `m:ss` كما في المواصفات. */
export function formatVoiceDuration(seconds: number | null | undefined): string {
  const total = Number.isFinite(seconds as number) ? Math.max(0, Math.trunc(seconds as number)) : 0;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[#?%&+=/\\:*\x22<>| ]/g, '_').replace(/__+/g, '_');
}

// ── GET /conversations/messages — آخر الرسائل (مع دعم المزامنة التدريجية) ──
conversations.get('/conversations/messages', requireAuth, async (c) => {
  const platform = platformOf(c.env);
  const after = c.req.query('after');
  const limitRaw = Number(c.req.query('limit'));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 50;

  const where: string[] = ['m.platform = ?', 'm.is_deleted = 0'];
  const binds: unknown[] = [platform];
  if (after) {
    where.push('m.created_at > ?');
    binds.push(after);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT m.id, m.sender_id, m.body, m.audio_url, m.audio_duration_seconds, m.created_at,
            p.full_name AS sender_name, p.avatar_url AS sender_avatar, p.role AS sender_role
     FROM messages m
     INNER JOIN profiles p ON p.id = m.sender_id
     WHERE ${where.join(' AND ')}
     ORDER BY m.created_at DESC
     LIMIT ?`
  ).bind(...binds, limit).all<any[]>();

  const messages = (results as any[]).reverse().map(row => ({
    id: row.id,
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    sender_avatar: row.sender_avatar,
    sender_role: row.sender_role,
    is_teacher: row.sender_role === 'admin' || row.sender_role === 'assistant',
    body: row.body,
    audio_url: row.audio_url,
    audio_duration_seconds: row.audio_duration_seconds,
    audio_duration_label: row.audio_url
      ? `رسالة صوتية (${formatVoiceDuration(row.audio_duration_seconds)})`
      : null,
    created_at: row.created_at,
  }));

  return c.json({ messages, labels: CONVERSATION_LABELS });
});

// ── POST /conversations/messages — إرسال رسالة نصية أو صوتية ──
const messageSchema = z.object({
  body: z.string().trim().max(MESSAGE_MAX_LENGTH).optional(),
  audio_url: z.string().max(1000).optional(),
  audio_duration_seconds: z.number().int().min(1).max(VOICE_MAX_SECONDS).optional(),
}).refine(
  value => (!!value.body && value.body.length > 0) || !!value.audio_url,
  { message: 'الرسالة فارغة' }
);

conversations.post('/conversations/messages', requireAuth, rateLimit('conversation_send', 60, 60), async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const payload = await c.req.json().catch(() => null);
  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  if (parsed.data.audio_url && !parsed.data.audio_duration_seconds) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'مدة الرسالة الصوتية مطلوبة' } }, 400);
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO messages (id, platform, sender_id, body, audio_url, audio_duration_seconds, is_deleted, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))`
  ).bind(
    id,
    platform,
    user.id,
    parsed.data.body ?? null,
    parsed.data.audio_url ?? null,
    parsed.data.audio_duration_seconds ?? null
  ).run();

  const created = await c.env.DB.prepare(
    `SELECT m.id, m.sender_id, m.body, m.audio_url, m.audio_duration_seconds, m.created_at,
            p.full_name AS sender_name, p.avatar_url AS sender_avatar, p.role AS sender_role
     FROM messages m INNER JOIN profiles p ON p.id = m.sender_id
     WHERE m.id = ?`
  ).bind(id).first<any>();

  return c.json({
    ok: true,
    message: {
      ...created,
      is_teacher: created.sender_role === 'admin' || created.sender_role === 'assistant',
      audio_duration_label: created.audio_url
        ? `رسالة صوتية (${formatVoiceDuration(created.audio_duration_seconds)})`
        : null,
    },
    labels: CONVERSATION_LABELS,
  }, 201);
});

// ── POST /conversations/voice-url — رابط رفع مُوقَّع للرسالة الصوتية ──
conversations.post('/conversations/voice-url', requireAuth, rateLimit('conversation_voice_url', 30, 60), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({
    filename: z.string().min(1).max(200),
    mime_type: z.string().max(100).optional(),
  }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'اسم الملف مطلوب', details: parsed.error.flatten() } }, 400);
  }

  const id = generateId();
  const cleanFilename = sanitizeFilename(parsed.data.filename);
  const r2Key = `voice/${id}_${cleanFilename}`;
  const contentType = parsed.data.mime_type || 'audio/mpeg';

  const origin = new URL(c.req.url).origin;
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || 'fusha-ashraf-files',
    r2Key,
    contentType,
    3600,
    origin
  );

  return c.json({
    upload_url: uploadUrl,
    public_url: `${origin}/files/voice/${id}_${cleanFilename}`,
    max_duration_seconds: VOICE_MAX_SECONDS,
  });
});

// ── DELETE /conversations/messages/:id — حذف رسالة (صاحبها أو الإدارة) ──
conversations.delete('/conversations/messages/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);
  const id = c.req.param('id');

  const message = await c.env.DB.prepare(
    'SELECT id, sender_id FROM messages WHERE id = ? AND platform = ?'
  ).bind(id, platform).first<{ id: string; sender_id: string }>();

  if (!message) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الرسالة غير موجودة' } }, 404);
  }

  const isStaff = user.role === 'admin' || user.role === 'assistant';
  if (message.sender_id !== user.id && !isStaff) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'ليس لديك صلاحية لهذا الإجراء' } }, 403);
  }

  await c.env.DB.prepare(
    "UPDATE messages SET is_deleted = 1 WHERE id = ?"
  ).bind(id).run();

  return c.json({ ok: true });
});

export default conversations;

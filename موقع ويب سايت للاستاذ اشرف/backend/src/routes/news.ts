import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requirePermission } from '../middleware/auth';
import { generateId } from '../utils/id';

const news = new Hono<HonoBindings>();

// مسارات /admin/* تحتاج تحميل المستخدم أولاً — requirePermission وحدها لا تقرأ التوكن.
news.use('/admin/*', requireAuth);

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

// ── GET /news — شريط الأخبار العام (المنشور فقط) ──
news.get('/news', async (c) => {
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, body, image_url, sort_order, published_at, created_at
     FROM news
     WHERE platform = ? AND is_published = 1
     ORDER BY sort_order ASC, COALESCE(published_at, created_at) DESC`
  ).bind(platform).all();

  // لا حالة فراغ في الواجهة: تُعرض مصفوفة فارغة فيُخفي الشريط بالكامل.
  return c.json({ news: results });
});

// ── GET /admin/news — كل الأخبار ──
news.get('/admin/news', requirePermission('can_manage_courses'), async (c) => {
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM news WHERE platform = ? ORDER BY sort_order ASC, created_at DESC`
  ).bind(platform).all();
  return c.json({ news: results });
});

const newsSchema = z.object({
  title: z.string().trim().min(2).max(300),
  body: z.string().max(5000).optional().nullable(),
  image_url: z.string().max(500).optional().nullable(),
  is_published: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  published_at: z.string().max(40).optional().nullable(),
});

// ── POST /admin/news — إنشاء خبر ──
news.post('/admin/news', requirePermission('can_manage_courses'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = newsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  const isPublished = d.is_published ? 1 : 0;

  await c.env.DB.prepare(
    `INSERT INTO news (id, platform, title, body, image_url, is_published, sort_order, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    platformOf(c.env),
    d.title,
    d.body ?? null,
    d.image_url ?? null,
    isPublished,
    d.sort_order ?? 0,
    d.published_at ?? (isPublished ? new Date().toISOString() : null)
  ).run();

  const created = await c.env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  return c.json({ ok: true, news: created }, 201);
});

// ── PATCH /admin/news/:id — تعديل خبر ──
news.patch('/admin/news/:id', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare('SELECT id FROM news WHERE id = ? AND platform = ?').bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الخبر غير موجود' } }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = newsSchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;

  const sets: string[] = [];
  const values: unknown[] = [];
  const assign = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    values.push(value);
  };

  if (d.title !== undefined) assign('title', d.title);
  if (d.body !== undefined) assign('body', d.body);
  if (d.image_url !== undefined) assign('image_url', d.image_url);
  if (d.sort_order !== undefined) assign('sort_order', d.sort_order);
  if (d.published_at !== undefined) assign('published_at', d.published_at);
  if (d.is_published !== undefined) {
    assign('is_published', d.is_published ? 1 : 0);
    if (d.is_published && d.published_at === undefined) {
      assign('published_at', new Date().toISOString());
    }
  }

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    await c.env.DB.prepare(`UPDATE news SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  return c.json({ ok: true, news: updated });
});

// ── DELETE /admin/news/:id — حذف خبر ──
news.delete('/admin/news/:id', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare('SELECT id FROM news WHERE id = ? AND platform = ?').bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الخبر غير موجود' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM news WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

export default news;

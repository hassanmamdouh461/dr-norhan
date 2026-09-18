import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requireRole, audit, requirePermission, rateLimit } from '../middleware/auth';
import { generateId, nowISO, generateActivationCode, slugify } from '../utils/id';
import { hashPassword } from '../lib/password';
import { sendNotificationDirectly } from '../queues/notificationConsumer';
import { getPresignedPutUrl } from '../utils/s3';

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[#?%&+=/\\:*\x22<>| ]/g, '_')
    .replace(/__+/g, '_');
}

async function verifyStudentPlatform(db: any, studentId: string, platform: string): Promise<boolean> {
  const row = await db.prepare(
    'SELECT id FROM profiles WHERE id = ? AND platform = ?'
  ).bind(studentId, platform).first();
  return !!row;
}

const admin = new Hono<HonoBindings>();

admin.use('/*', async (c, next) => {
  if (c.req.method === 'POST') {
    return rateLimit('admin_post', 30, 60)(c, next);
  }
  await next();
});

// Accept both boolean (true/false) and number (1/0) for boolean-like fields
const boolLike = z.preprocess(
  (v) => (v === 1 ? true : v === 0 ? false : v),
  z.boolean()
);

const updateCourseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  grade: z.string().max(50).optional().nullable(),
  branch: z.string().max(50).optional().nullable(),
  reference_price: z.number().int().nonnegative().optional().nullable(),
  is_free: boolLike.optional(),
  is_published: boolLike.optional(),
  is_archived: boolLike.optional(),
  sort_order: z.number().int().optional(),
  cover_url: z.string().max(1000).optional().nullable(),
});

const updateUnitSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  sort_order: z.number().int().optional(),
  is_published: boolLike.optional(),
  is_archived: boolLike.optional(),
});

const updateLessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  sort_order: z.number().int().optional(),
  is_free_preview: boolLike.optional(),
  is_published: boolLike.optional(),
  is_archived: boolLike.optional(),
  duration_seconds: z.number().int().nonnegative().optional().nullable(),
});

const updateStudentSchema = z.object({
  status: z.enum(['active', 'blocked']).optional(),
  max_devices: z.number().int().positive().optional(),
  role: z.enum(['student', 'assistant', 'admin']).optional(),
});

const updateQuestionSchema = z.object({
  status: z.string().max(50).optional(),
  is_pinned: boolLike.optional(),
});

const updateSettingsSchema = z.record(
  z.string().regex(/^[a-zA-Z0-9_\-]+$/).max(100),
  z.string().max(1000)
);

// Apply admin auth to all routes (basic auth load)
admin.use('*', requireAuth, requireRole('admin', 'assistant'));

// ════════════════════════════════════════════════
//  COURSES MANAGEMENT
// ════════════════════════════════════════════════

// ── GET /admin/courses — List all courses (including unpublished/archived) ──
admin.get('/courses', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const search = c.req.query('search');
  const archived = c.req.query('archived') === '1';

  const platform = c.env.PLATFORM_KEY || 'fusha';
  let where = archived ? 'c.is_archived = 1 AND c.platform = ?' : 'c.is_archived = 0 AND c.platform = ?';
  const params: unknown[] = [platform];

  if (search) {
    where += ' AND (c.title LIKE ? OR c.slug LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT c.*,
       (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id AND status = 'active') as students_count,
       (SELECT COUNT(*) FROM units WHERE course_id = c.id AND is_archived = 0) as units_count,
       (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND is_archived = 0) as lessons_count
     FROM courses c WHERE ${where}
     ORDER BY c.sort_order ASC, c.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM courses c WHERE ${where}`
  ).bind(...params).first<{ count: number }>() || { count: 0 };

  return c.json({ courses: results, meta: { page, limit, total, has_more: offset + limit < total } });
});

// ── POST /admin/courses — Create course ──
admin.post('/courses', requirePermission('can_manage_courses'), audit('admin.course.create'), async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    title: z.string().min(2).max(200),
    description: z.string().optional(),
    grade: z.string().optional(),
    branch: z.string().optional().nullable(),
    reference_price: z.number().int().optional(),
    is_free: z.boolean().optional(),
    is_published: z.boolean().optional(),
    cover_url: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const user = c.get('user');
  const d = parsed.data;
  const id = generateId();
  const baseSlug = slugify(d.title) || id.slice(0, 8);
  let slug = baseSlug;

  // Resolve duplicate slug conflict for soft-deleted (archived) or existing courses
  const conflict = await c.env.DB.prepare(
    "SELECT id, is_archived, slug FROM courses WHERE slug = ? LIMIT 1"
  ).bind(slug).first<{ id: string; is_archived: number; slug: string }>();

  if (conflict) {
    if (conflict.is_archived === 1) {
      // The old course was archived (deleted). Rename its slug to free the unique namespace for the new course
      const renamedSlug = `${conflict.slug}-archived-${Date.now()}`;
      await c.env.DB.prepare(
        "UPDATE courses SET slug = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(renamedSlug, conflict.id).run();
      console.log(`[Admin Course] Renamed archived course ${conflict.id} slug from ${conflict.slug} to ${renamedSlug} to free up unique name`);
    } else {
      // Conflicting course is active, append unique suffix
      slug = `${baseSlug}-${generateId().slice(0, 4)}`;
    }
  }

  const platform = c.env.PLATFORM_KEY || 'fusha';
  await c.env.DB.prepare(
    `INSERT INTO courses (id, title, slug, description, cover_url, grade, branch, reference_price, is_free, is_published, created_by, platform, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, d.title, slug, d.description || '', d.cover_url || null, d.grade || '', d.branch || null, d.reference_price || 0, d.is_free ? 1 : 0, d.is_published ? 1 : 0, user.id, platform).run();

  const course = await c.env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(id).first();
  return c.json(course, 201);
});

// ── POST /admin/courses/cover-upload-url — Get R2 cover image upload URL ──
admin.post('/courses/cover-upload-url', requirePermission('can_manage_courses'), async (c) => {
  const body = await c.req.json() as { filename: string; mime_type?: string };
  if (!body.filename) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'اسم الملف مطلوب' } }, 400);
  }

  const id = generateId();
  const cleanFilename = sanitizeFilename(body.filename);
  const r2Key = `covers/${id}_${cleanFilename}`;
  const contentType = body.mime_type || 'image/jpeg';

  const origin = new URL(c.req.url).origin;
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || 'fusha-ashraf-files',
    r2Key,
    contentType,
    3600, // 1 hour expiration
    origin
  );

  const publicUrl = `${origin}/files/covers/${id}_${cleanFilename}`;

  return c.json({
    upload_url: uploadUrl,
    public_url: publicUrl,
    r2_key: r2Key,
  });
});


// ── PATCH /admin/courses/:id — Update course ──
admin.patch('/courses/:id', requirePermission('can_manage_courses'), audit('admin.course.update'), async (c) => {
  const courseId = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const fields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(parsed.data)) {
    if (val !== undefined) {
      if (typeof val === 'boolean') fields[key] = val ? 1 : 0;
      else fields[key] = val;
    }
  }
  if (Object.keys(fields).length === 0) {
    return c.json({ error: { code: 'NO_CHANGES', message: 'لا توجد تعديلات' } }, 400);
  }

  const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
  const vals = Object.values(fields);
  await c.env.DB.prepare(
    `UPDATE courses SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...vals, courseId).run();

  const course = await c.env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(courseId).first();
  return c.json(course);
});

// ── DELETE /admin/courses/:id — Soft-delete (archive) course ──
admin.delete('/courses/:id', requirePermission('can_manage_courses'), audit('admin.course.archive'), async (c) => {
  const courseId = c.req.param('id');
  
  // Fetch existing slug to append archive suffix and release original unique name
  const course = await c.env.DB.prepare(
    "SELECT slug FROM courses WHERE id = ?"
  ).bind(courseId).first<{ slug: string }>();

  if (course) {
    const archivedSlug = `${course.slug}-archived-${Date.now()}`;
    await c.env.DB.prepare(
      "UPDATE courses SET is_archived = 1, slug = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(archivedSlug, courseId).run();
  } else {
    await c.env.DB.prepare(
      "UPDATE courses SET is_archived = 1, updated_at = datetime('now') WHERE id = ?"
    ).bind(courseId).run();
  }

  return c.json({ ok: true });
});

// ════════════════════════════════════════════════
//  UNITS MANAGEMENT
// ════════════════════════════════════════════════

admin.post('/courses/:courseId/units', requirePermission('can_manage_courses'), async (c) => {
  const courseId = c.req.param('courseId');
  const body = await c.req.json();
  const createUnitSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
  });
  const parsed = createUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const { title, description } = parsed.data;

  const id = generateId();
  const { count } = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM units WHERE course_id = ?'
  ).bind(courseId).first<{ count: number }>() || { count: 0 };

  await c.env.DB.prepare(
    `INSERT INTO units (id, course_id, title, description, sort_order, is_published, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
  ).bind(id, courseId, title, description || '', count).run();

  const unit = await c.env.DB.prepare('SELECT * FROM units WHERE id = ?').bind(id).first();
  return c.json(unit, 201);
});

admin.patch('/units/:id', requirePermission('can_manage_courses'), async (c) => {
  const unitId = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, val] of Object.entries(parsed.data)) {
    if (val !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
    }
  }
  if (sets.length === 0) return c.json({ error: { code: 'NO_CHANGES', message: 'لا تعديلات' } }, 400);
  await c.env.DB.prepare(`UPDATE units SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, unitId).run();
  return c.json(await c.env.DB.prepare('SELECT * FROM units WHERE id = ?').bind(unitId).first());
});

// ════════════════════════════════════════════════
//  LESSONS MANAGEMENT
// ════════════════════════════════════════════════

admin.post('/units/:unitId/lessons', requirePermission('can_manage_courses'), async (c) => {
  const unitId = c.req.param('unitId');
  const body = await c.req.json();
  const createLessonSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    is_free_preview: z.boolean().optional(),
    is_published: z.boolean().optional(),
    duration_seconds: z.number().int().nonnegative().optional().nullable(),
  });
  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;

  const unit = await c.env.DB.prepare('SELECT course_id FROM units WHERE id = ?').bind(unitId).first<{ course_id: string }>();
  if (!unit) return c.json({ error: { code: 'NOT_FOUND', message: 'الوحدة غير موجودة' } }, 404);

  const id = generateId();
  const { count } = await c.env.DB.prepare('SELECT COUNT(*) as count FROM lessons WHERE unit_id = ?').bind(unitId).first<{ count: number }>() || { count: 0 };

  await c.env.DB.prepare(
    `INSERT INTO lessons (id, unit_id, course_id, title, description, sort_order, is_free_preview, is_published, duration_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(id, unitId, unit.course_id, d.title, d.description || '', count, d.is_free_preview ? 1 : 0, d.is_published ? 1 : 0, d.duration_seconds || null).run();

  return c.json(await c.env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(id).first(), 201);
});

admin.patch('/lessons/:id', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateLessonSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const sets: string[] = []; const vals: unknown[] = [];
  for (const [k, val] of Object.entries(parsed.data)) {
    if (val !== undefined) {
      sets.push(`${k} = ?`);
      vals.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
    }
  }
  if (sets.length === 0) return c.json({ error: { code: 'NO_CHANGES', message: 'لا تعديلات' } }, 400);
  await c.env.DB.prepare(`UPDATE lessons SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, lessonId).run();
  return c.json(await c.env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(lessonId).first());
});

// ── DELETE /admin/lessons/:id — Soft-delete (archive) lesson ──
admin.delete('/lessons/:id', requirePermission('can_manage_courses'), audit('admin.lesson.archive'), async (c) => {
  const lessonId = c.req.param('id');
  await c.env.DB.prepare(
    "UPDATE lessons SET is_archived = 1, updated_at = datetime('now') WHERE id = ?"
  ).bind(lessonId).run();
  return c.json({ ok: true });
});


// ── POST /admin/lessons/:id/videos — Register video ──
admin.post('/lessons/:id/videos', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const body = await c.req.json();
  const createVideoSchema = z.object({
    provider: z.enum(['r2_hls', 'r2', 'server', 'youtube']).default('r2_hls'),
    stream_uid: z.string().max(500).optional().nullable(),
    youtube_id: z.string().max(50).optional().nullable(),
    thumbnail_url: z.string().max(1000).optional().nullable(),
    duration_seconds: z.number().int().nonnegative().optional().nullable(),
    status: z.enum(['uploading', 'processing', 'ready', 'error']).default('ready'),
    require_drm: z.boolean().default(true),
  });
  const parsed = createVideoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  
  // Replace videos atomically so a failed insert preserves the existing videos.
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM lesson_videos WHERE lesson_id = ?').bind(lessonId),
    c.env.DB.prepare(
      `INSERT INTO lesson_videos (id, lesson_id, provider, stream_uid, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
    ).bind(id, lessonId, d.provider, d.stream_uid || null, d.youtube_id || null, d.thumbnail_url || null, d.duration_seconds || null, d.status, d.require_drm ? 1 : 0),
  ]);

  return c.json(await c.env.DB.prepare('SELECT * FROM lesson_videos WHERE id = ?').bind(id).first(), 201);
});

// ── POST /admin/lessons/:id/videos/upload-url — Get R2 video upload URL ──
admin.post('/lessons/:id/videos/upload-url', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const body = await c.req.json() as { filename: string; mime_type?: string };

  if (!body.filename) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'اسم الملف مطلوب' } }, 400);
  }

  const id = generateId();
  const cleanFilename = sanitizeFilename(body.filename);
  const r2Key = `lessons/${lessonId}/videos/${id}/${cleanFilename}`;
  const contentType = body.mime_type || 'video/mp4';

  const origin = new URL(c.req.url).origin;
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || 'fusha-ashraf-files',
    r2Key,
    contentType,
    7200,
    origin
  );

  return c.json({
    upload_url: uploadUrl,
    r2_key: r2Key,
    video_id: id,
  });
});

// ── POST /admin/lessons/:id/videos/hls-upload-url — Get R2 HLS video upload URL ──
admin.post('/lessons/:id/videos/hls-upload-url', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const body = await c.req.json() as { filename: string; videoId?: string };

  if (!body.filename) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'اسم الملف مطلوب' } }, 400);
  }

  // If videoId is provided, use it (to keep all HLS segments inside the same folder).
  // Otherwise generate a new videoId.
  const videoId = body.videoId || generateId();
  const cleanFilename = body.filename.split('/').map(segment => sanitizeFilename(segment)).join('/');
  const r2Key = `lessons/${lessonId}/videos/${videoId}/hls/${cleanFilename}`;
  
  // Set Content-Type based on extension
  let contentType = 'application/octet-stream';
  if (cleanFilename.endsWith('.m3u8')) {
    contentType = 'application/x-mpegURL';
  } else if (cleanFilename.endsWith('.ts')) {
    contentType = 'video/MP2T';
  } else if (cleanFilename.endsWith('.m4s')) {
    contentType = 'video/iso.segment';
  } else if (cleanFilename.endsWith('.mp4')) {
    contentType = 'video/mp4';
  } else if (cleanFilename.endsWith('.json')) {
    contentType = 'application/json';
  }

  const origin = new URL(c.req.url).origin;
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || 'fusha-ashraf-files',
    r2Key,
    contentType,
    7200,
    origin
  );

  return c.json({
    upload_url: uploadUrl,
    r2_key: r2Key,
    video_id: videoId,
  });
});

// ── POST /admin/lessons/:id/files — Register lesson file ──
admin.post('/lessons/:id/files', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const body = await c.req.json();
  const createFileSchema = z.object({
    title: z.string().min(1).max(500),
    mime_type: z.string().max(100).default('application/pdf'),
    size_bytes: z.number().int().nonnegative().default(0),
    is_downloadable: z.boolean().default(false),
    watermark: z.boolean().default(true),
  });
  const parsed = createFileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();
  const cleanTitle = sanitizeFilename(d.title);
  const r2Key = `lessons/${lessonId}/files/${id}/${cleanTitle}`;

  await c.env.DB.prepare(
    `INSERT INTO lesson_files (id, lesson_id, title, r2_key, mime_type, size_bytes, is_downloadable, watermark, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`
  ).bind(id, lessonId, d.title, r2Key, d.mime_type, d.size_bytes, d.is_downloadable ? 1 : 0, d.watermark ? 1 : 0).run();

  const origin = new URL(c.req.url).origin;
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || 'fusha-ashraf-files',
    r2Key,
    d.mime_type,
    3600, // 1 hour expiration
    origin
  );

  return c.json({
    file: await c.env.DB.prepare('SELECT * FROM lesson_files WHERE id = ?').bind(id).first(),
    upload: { r2_key: r2Key, method: 'PUT', upload_url: uploadUrl },
  }, 201);
});

// ── DELETE /admin/lessons/:id/files/:fileId — Delete lesson file ──
admin.delete('/lessons/:id/files/:fileId', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const fileId = c.req.param('fileId');

  const file = await c.env.DB.prepare(
    'SELECT r2_key FROM lesson_files WHERE id = ? AND lesson_id = ?'
  ).bind(fileId, lessonId).first<{ r2_key: string }>();

  if (!file) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الملف غير موجود' } }, 404);
  }

  // Delete from R2
  try {
    await c.env.R2.delete(file.r2_key);
  } catch (err) {
    console.error('Failed to delete file from R2:', err);
  }

  // Delete from D1
  await c.env.DB.prepare(
    'DELETE FROM lesson_files WHERE id = ? AND lesson_id = ?'
  ).bind(fileId, lessonId).run();

  return c.json({ ok: true });
});

// ════════════════════════════════════════════════
//  ACTIVATION CODES MANAGEMENT
// ════════════════════════════════════════════════

// ── POST /admin/codes/batches — Generate code batch ──
admin.post('/codes/batches', requirePermission('can_manage_codes'), audit('admin.codes.generate'), async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    name: z.string().min(1),
    scope_type: z.enum(['course', 'bundle', 'all']),
    course_id: z.string().optional(),
    bundle_id: z.string().optional(),
    quantity: z.number().int().min(1).max(1000),
    access_days: z.number().int().min(1).optional(),
    expires_at: z.string().optional(),
    note: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const d = parsed.data;
  const user = c.get('user');
  const batchId = generateId();

  const platform = c.env.PLATFORM_KEY || 'fusha';
  await c.env.DB.prepare(
    `INSERT INTO code_batches (id, name, scope_type, course_id, bundle_id, quantity, access_days, expires_at, note, created_by, platform, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(batchId, d.name, d.scope_type, d.course_id || null, d.bundle_id || null, d.quantity, d.access_days || null, d.expires_at || null, d.note || null, user.id, platform).run();

  const statements = [];
  const generatedCodes: string[] = [];
  for (let i = 0; i < d.quantity; i++) {
    const id = generateId();
    const code = generateActivationCode();
    generatedCodes.push(code);
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO activation_codes (id, code, batch_id, scope_type, course_id, bundle_id, status, max_uses, used_count, access_days, expires_at, created_by, platform, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, ?, ?, ?, datetime('now'))`
      ).bind(id, code, batchId, d.scope_type, d.course_id || null, d.bundle_id || null, d.access_days || null, d.expires_at || null, user.id, platform)
    );
  }

  await c.env.DB.batch(statements);

  return c.json({
    batch_id: batchId,
    quantity: d.quantity,
    codes: generatedCodes,
  }, 201);
});

// ── GET /admin/codes/batches — List batches ──
admin.get('/codes/batches', requirePermission('can_manage_codes'), async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  const platform = c.env.PLATFORM_KEY || 'fusha';
  const { results } = await c.env.DB.prepare(
    `SELECT cb.*,
       (SELECT COUNT(*) FROM activation_codes WHERE batch_id = cb.id AND status = 'active') as active_count,
       (SELECT COUNT(*) FROM activation_codes WHERE batch_id = cb.id AND status = 'used') as used_count,
       c.title as course_title,
       p.full_name as created_by_name
     FROM code_batches cb
     LEFT JOIN courses c ON c.id = cb.course_id
     LEFT JOIN profiles p ON p.id = cb.created_by
     WHERE cb.platform = ?
     ORDER BY cb.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(platform, limit, offset).all();

  return c.json({ batches: results });
});

// ── GET /admin/codes/batches/:id/codes — List codes in batch ──
admin.get('/codes/batches/:id/codes', requirePermission('can_manage_codes'), async (c) => {
  const batchId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const batch = await c.env.DB.prepare(
    'SELECT id FROM code_batches WHERE id = ? AND platform = ?'
  ).bind(batchId, platform).first();

  if (!batch) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدفعة غير موجودة' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ac.*, p.full_name as used_by_name, p.phone as used_by_phone
     FROM activation_codes ac
     LEFT JOIN profiles p ON p.id = ac.used_by
     WHERE ac.batch_id = ?
     ORDER BY ac.created_at ASC`
  ).bind(batchId).all();

  return c.json({ codes: results });
});

// ── GET /admin/codes/batches/:id/csv — Export CSV ──
admin.get('/codes/batches/:id/csv', requirePermission('can_manage_codes'), async (c) => {
  const batchId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const batch = await c.env.DB.prepare(
    'SELECT id FROM code_batches WHERE id = ? AND platform = ?'
  ).bind(batchId, platform).first();

  if (!batch) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدفعة غير موجودة' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ac.code, ac.status, ac.used_count, ac.max_uses,
            p.full_name as used_by_name, p.phone as used_by_phone, ac.used_at
     FROM activation_codes ac
     LEFT JOIN profiles p ON p.id = ac.used_by
     WHERE ac.batch_id = ?
     ORDER BY ac.created_at ASC`
  ).bind(batchId).all();

function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

  const csv = [
    'الكود,الحالة,عدد الاستخدامات,الحد الأقصى,اسم المستخدم,رقم الهاتف,تاريخ الاستخدام',
    ...(results as any[]).map(r =>
      `${escapeCsvValue(r.code)},${escapeCsvValue(r.status)},${escapeCsvValue(r.used_count)},${escapeCsvValue(r.max_uses)},${escapeCsvValue(r.used_by_name)},${escapeCsvValue(r.used_by_phone)},${escapeCsvValue(r.used_at)}`
    ),
  ].join('\n');

  return new Response('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="batch-${batchId}.csv"`,
    },
  });
});

// ── DELETE /admin/codes/batches/:id — Delete code batch and all its codes ──
admin.delete('/codes/batches/:id', requirePermission('can_manage_codes'), audit('admin.codes.delete_batch'), async (c) => {
  const batchId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const batch = await c.env.DB.prepare(
    'SELECT id FROM code_batches WHERE id = ? AND platform = ?'
  ).bind(batchId, platform).first();

  if (!batch) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدفعة غير موجودة' } }, 404);
  }

  // Manually clear references in enrollments and financial_transactions to bypass foreign key constraint failures
  // on production databases where ON DELETE SET NULL was not successfully applied or active.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE enrollments SET code_id = NULL WHERE code_id IN (SELECT id FROM activation_codes WHERE batch_id = ?)').bind(batchId),
    c.env.DB.prepare('UPDATE financial_transactions SET code_id = NULL WHERE code_id IN (SELECT id FROM activation_codes WHERE batch_id = ?)').bind(batchId),
    c.env.DB.prepare('DELETE FROM activation_codes WHERE batch_id = ?').bind(batchId),
    c.env.DB.prepare('DELETE FROM code_batches WHERE id = ?').bind(batchId),
  ]);

  return c.json({ ok: true });
});

// ── DELETE /admin/codes/:id — Delete a specific activation code by ID ──
admin.delete('/codes/:id', requirePermission('can_manage_codes'), audit('admin.codes.delete_single'), async (c) => {
  const codeId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const code = await c.env.DB.prepare(
    'SELECT id FROM activation_codes WHERE id = ? AND platform = ?'
  ).bind(codeId, platform).first();

  if (!code) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الكود غير موجود' } }, 404);
  }

  // Manually clear references in enrollments and financial_transactions to bypass foreign key constraint failures
  // on production databases where ON DELETE SET NULL was not successfully applied or active.
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE enrollments SET code_id = NULL WHERE code_id = ?').bind(codeId),
    c.env.DB.prepare('UPDATE financial_transactions SET code_id = NULL WHERE code_id = ?').bind(codeId),
    c.env.DB.prepare('DELETE FROM activation_codes WHERE id = ?').bind(codeId),
  ]);

  return c.json({ ok: true });
});

// ════════════════════════════════════════════════
//  STUDENTS MANAGEMENT
// ════════════════════════════════════════════════

// ── GET /admin/students — List students ──
admin.get('/students', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const search = c.req.query('search');
  const status = c.req.query('status');

  const platform = c.env.PLATFORM_KEY || 'fusha';
  let where = "p.role = 'student' AND p.platform = ?";
  const params: unknown[] = [platform];

  if (search) {
    where += " AND (p.full_name LIKE ? OR p.email LIKE ? OR p.phone LIKE ? OR p.student_code LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    where += " AND p.status = ?";
    params.push(status);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT p.*,
       (SELECT COUNT(*) FROM enrollments WHERE student_id = p.id AND status = 'active') as enrollments_count,
       (SELECT COUNT(*) FROM devices WHERE student_id = p.id) as devices_count
     FROM profiles p WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM profiles p WHERE ${where}`
  ).bind(...params).first<{ count: number }>() || { count: 0 };

  return c.json({ students: results, meta: { page, limit, total, has_more: offset + limit < total } });
});

// ── PATCH /admin/students/:id — Update student status ──
admin.patch('/students/:id', requireRole('admin'), audit('admin.student.update'), async (c) => {
  const studentId = c.req.param('id');
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const body = await c.req.json();

  const parsed = updateStudentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const fields = parsed.data;

  if (studentId === user.id && (fields.role !== undefined || fields.status !== undefined)) {
    return c.json({ error: { code: 'SELF_MODIFICATION_FORBIDDEN', message: 'لا يمكنك تعديل دورك أو حالتك الخاصة' } }, 403);
  }

  const sets: string[] = []; const vals: unknown[] = [];

  if (fields.status !== undefined) { sets.push('status = ?'); vals.push(fields.status); }
  if (fields.max_devices !== undefined) { sets.push('max_devices = ?'); vals.push(fields.max_devices); }
  if (fields.role !== undefined) { sets.push('role = ?'); vals.push(fields.role); }

  if (sets.length === 0) return c.json({ error: { code: 'NO_CHANGES', message: 'لا تعديلات' } }, 400);

  // Set audit log metadata
  c.set('auditTargetType', 'student');
  c.set('auditTargetId', studentId);
  c.set('auditMeta', { status: fields.status, role: fields.role, max_devices: fields.max_devices });

  // Handle KV blacklist for instant session invalidation
  if (fields.status === 'blocked' && c.env.KV) {
    await c.env.KV.put(`blacklist:user:${studentId}`, '1', { expirationTtl: 86400 }); // Blacklist session for 24 hours
  } else if (fields.status === 'active' && c.env.KV) {
    await c.env.KV.delete(`blacklist:user:${studentId}`);
  }

  await c.env.DB.prepare(`UPDATE profiles SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, studentId).run();
  return c.json(await c.env.DB.prepare('SELECT id, supabase_user_id, email, student_code, role, full_name, phone, parent_phone, grade, governorate, avatar_url, status, max_devices, created_at, updated_at, last_seen_at, last_self_reset_at FROM profiles WHERE id = ?').bind(studentId).first());
});

// ── DELETE /admin/students/:id — Delete student from platform ──
admin.delete('/students/:id', requireRole('admin'), audit('admin.student.delete'), async (c) => {
  const studentId = c.req.param('id');
  const user = c.get('user');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  if (studentId === user.id) {
    return c.json({ error: { code: 'SELF_DELETION_FORBIDDEN', message: 'لا يمكنك حذف حسابك الخاص' } }, 403);
  }

  // Set audit log metadata
  c.set('auditTargetType', 'student');
  c.set('auditTargetId', studentId);

  // Clean up all related student data in batch to avoid foreign key errors or orphans
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM devices WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM device_reset_requests WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM enrollments WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM lesson_progress WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM quiz_attempts WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM lecture_playback_logs WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM financial_transactions WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM reviews WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM answers WHERE author_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM questions WHERE student_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM notifications WHERE recipient_id = ?').bind(studentId),
    c.env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(studentId),
  ]);

  if (c.env.KV) {
    await c.env.KV.delete(`blacklist:user:${studentId}`);
  }

  return c.json({ success: true, message: 'تم مسح بيانات الطالب وكل ما يتعلق به بنجاح' });
});

// ── GET /admin/students/:id/devices — List a student's registered devices (requires reset permission) ──
admin.get('/students/:id/devices', requirePermission('can_reset_devices'), async (c) => {
  const studentId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT id, device_id, platform, model, is_trusted, is_rooted, last_login_at, created_at
     FROM devices WHERE student_id = ? ORDER BY last_login_at DESC`
  ).bind(studentId).all();

  return c.json({ devices: results });
});

// ── DELETE /admin/students/:id/devices — Unbind all devices (requires reset permission) ──
admin.delete('/students/:id/devices', requirePermission('can_reset_devices'), audit('admin.student.unbind_devices'), async (c) => {
  const studentId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM devices WHERE student_id = ?').bind(studentId).run();
  return c.json({ ok: true, message: 'تم حذف جميع الأجهزة' });
});

// ── DELETE /admin/students/:id/devices/:deviceId — Unbind specific device (requires reset permission) ──
admin.delete('/students/:id/devices/:deviceId', requirePermission('can_reset_devices'), async (c) => {
  const studentId = c.req.param('id');
  const deviceId = c.req.param('deviceId');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM devices WHERE student_id = ? AND id = ?').bind(studentId, deviceId).run();
  return c.json({ ok: true });
});

// ── POST /admin/students/:id/enroll — Manually enroll student ──
admin.post('/students/:id/enroll', requirePermission('can_manage_courses'), audit('admin.student.enroll'), async (c) => {
  const studentId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const { course_id, access_days } = await c.req.json();
  if (!course_id) return c.json({ error: { code: 'BAD_REQUEST', message: 'معرّف الكورس مطلوب' } }, 400);

  let expiresAt: string | null = null;
  if (access_days) {
    const d = new Date(); d.setDate(d.getDate() + access_days);
    expiresAt = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO enrollments (id, student_id, course_id, source, status, platform, granted_at, expires_at, created_at)
     VALUES (?, ?, ?, 'manual', 'active', ?, datetime('now'), ?, datetime('now'))
     ON CONFLICT(student_id, course_id) DO UPDATE SET status = 'active', expires_at = excluded.expires_at, granted_at = datetime('now'), platform = excluded.platform`
  ).bind(id, studentId, course_id, platform, expiresAt).run();

  return c.json({ ok: true, enrollment_id: id });
});

// ── GET /admin/students/:id/financials — Get financials (restricted to Admin role) ──
admin.get('/students/:id/financials', requireRole('admin'), async (c) => {
  const studentId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ft.*, c.title as course_title, ac.code as code_string
     FROM financial_transactions ft
     LEFT JOIN courses c ON ft.course_id = c.id
     LEFT JOIN activation_codes ac ON ft.code_id = ac.id
     WHERE ft.student_id = ?
     ORDER BY ft.created_at DESC`
  ).bind(studentId).all();
  return c.json({ financials: results });
});

// ── POST /admin/students/:id/financials — Add manual payment (restricted to Admin role) ──
admin.post('/students/:id/financials', requireRole('admin'), audit('admin.student.add_financial'), async (c) => {
  const studentId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const { course_id, amount, note } = await c.req.json() as { course_id?: string; amount: number; note?: string };
  if (!amount) return c.json({ error: { code: 'BAD_REQUEST', message: 'القيمة المالية مطلوبة' } }, 400);

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO financial_transactions (id, student_id, course_id, amount, transaction_type, code_id, note, created_at)
     VALUES (?, ?, ?, ?, 'manual_admin', NULL, ?, datetime('now'))`
  ).bind(id, studentId, course_id || null, amount, note || '').run();

  return c.json({ ok: true, transaction_id: id }, 201);
});

// ── GET /admin/students/:id/playback-logs — Get student's playback logs ──
admin.get('/students/:id/playback-logs', async (c) => {
  const studentId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT lpl.*, l.title as lesson_title
     FROM lecture_playback_logs lpl
     INNER JOIN lessons l ON lpl.lesson_id = l.id
     WHERE lpl.student_id = ?
     ORDER BY lpl.created_at DESC
     LIMIT 100`
  ).bind(studentId).all();
  return c.json({ playback_logs: results });
});

// ── GET /admin/students/:id/quiz-attempts — Get student's quiz attempts ──
admin.get('/students/:id/quiz-attempts', async (c) => {
  const studentId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const hasAccess = await verifyStudentPlatform(c.env.DB, studentId, platform);
  if (!hasAccess) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الطالب غير موجود' } }, 404);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT qa.*, q.title as quiz_title, q.max_score
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON qa.quiz_id = q.id
     WHERE qa.student_id = ?
     ORDER BY qa.submitted_at DESC`
  ).bind(studentId).all();
  return c.json({ quiz_attempts: results });
});

// ════════════════════════════════════════════════
//  Q&A MANAGEMENT
// ════════════════════════════════════════════════

// ── GET /admin/questions — All questions ──
admin.get('/questions', async (c) => {
  const status = c.req.query('status') || 'open';
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;

  const platform = c.env.PLATFORM_KEY || 'fusha';
  const { results } = await c.env.DB.prepare(
    `SELECT q.*, p.full_name as student_name, p.phone as student_phone,
            l.title as lesson_title, c.title as course_title,
            (SELECT COUNT(*) FROM answers WHERE question_id = q.id) as answers_count
     FROM questions q
     JOIN profiles p ON p.id = q.student_id
     LEFT JOIN lessons l ON l.id = q.lesson_id
     LEFT JOIN courses c ON c.id = q.course_id
     WHERE q.status = ? AND p.platform = ?
     ORDER BY q.is_pinned DESC, q.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(status, platform, limit, offset).all();

  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM questions q JOIN profiles p ON p.id = q.student_id WHERE q.status = ? AND p.platform = ?`
  ).bind(status, platform).first<{ count: number }>() || { count: 0 };

  return c.json({ questions: results, meta: { page, limit, total, has_more: offset + limit < total } });
});

// ── POST /admin/questions/:id/answer — Answer a question ──
admin.post('/questions/:id/answer', requirePermission('can_answer_questions'), audit('admin.question.answer'), async (c) => {
  const questionId = c.req.param('id');
  const { body: answerBody, image_url } = await c.req.json() as { body: string; image_url?: string };
  if (!answerBody) return c.json({ error: { code: 'BAD_REQUEST', message: 'نص الإجابة مطلوب' } }, 400);

  const user = c.get('user');
  const id = generateId();
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const question = await c.env.DB.prepare(
    `SELECT q.student_id FROM questions q
     JOIN profiles p ON p.id = q.student_id
     WHERE q.id = ? AND p.platform = ?`
  ).bind(questionId, platform).first<{ student_id: string }>();

  if (!question) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'السؤال غير موجود أو لا ينتمي لهذه المنصة' } }, 404);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO answers (id, question_id, author_id, body, image_url, is_accepted, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).bind(id, questionId, user.id, answerBody, image_url || null),
    c.env.DB.prepare(
      "UPDATE questions SET status = 'answered', updated_at = datetime('now') WHERE id = ?"
    ).bind(questionId),
  ]);

  // Queue notification to student
  if (question) {
    const device = await c.env.DB.prepare('SELECT push_token FROM devices WHERE student_id = ? AND push_token IS NOT NULL LIMIT 1').bind(question.student_id).first<{ push_token: string }>();
    if (device?.push_token) {
      c.executionCtx.waitUntil(
        sendNotificationDirectly(c.env, {
          type: 'single',
          tokens: [device.push_token],
          title: 'تم الرد على سؤالك',
          body: answerBody.substring(0, 100),
          data: { screen: 'question', question_id: questionId },
        })
      );
    }
  }

  return c.json({ ok: true, answer_id: id });
});

// ── POST /admin/questions/answer-image-url — Generate presigned R2 upload URL for Q&A answer images ──
admin.post('/questions/answer-image-url', requirePermission('can_answer_questions'), async (c) => {
  const body = await c.req.json() as { filename: string; mime_type?: string };
  if (!body.filename) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'اسم الملف مطلوب' } }, 400);
  }

  const id = generateId();
  const cleanFilename = sanitizeFilename(body.filename);
  const r2Key = `questions/answers_${id}_${cleanFilename}`;
  const contentType = body.mime_type || 'image/jpeg';

  const origin = new URL(c.req.url).origin;
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || 'fusha-ashraf-files',
    r2Key,
    contentType,
    3600, // 1 hour expiration
    origin
  );

  const publicUrl = `${origin}/files/questions/answers_${id}_${cleanFilename}`;

  return c.json({
    upload_url: uploadUrl,
    public_url: publicUrl,
    r2_key: r2Key,
  });
});

// ── PATCH /admin/questions/:id — Update question status ──
admin.patch('/questions/:id', requirePermission('can_answer_questions'), async (c) => {
  const questionId = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const platform = c.env.PLATFORM_KEY || 'fusha';
  const question = await c.env.DB.prepare(
    `SELECT q.id FROM questions q
     JOIN profiles p ON p.id = q.student_id
     WHERE q.id = ? AND p.platform = ?`
  ).bind(questionId, platform).first();

  if (!question) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'السؤال غير موجود أو لا ينتمي لهذه المنصة' } }, 404);
  }

  const fields = parsed.data;
  const sets: string[] = []; const vals: unknown[] = [];
  if (fields.status !== undefined) { sets.push('status = ?'); vals.push(fields.status); }
  if (fields.is_pinned !== undefined) { sets.push('is_pinned = ?'); vals.push(fields.is_pinned ? 1 : 0); }
  if (sets.length === 0) return c.json({ error: { code: 'NO_CHANGES', message: 'لا تعديلات' } }, 400);
  await c.env.DB.prepare(`UPDATE questions SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, questionId).run();
  return c.json({ ok: true });
});

// ════════════════════════════════════════════════
//  CURRENT USER PERMISSIONS (Admin + Assistant)
// ════════════════════════════════════════════════

// ── GET /admin/me/permissions — Get the current staff user's effective permission flags ──
// Admins implicitly have every permission. Assistants get their row from
// assistant_permissions (or all-false flags if no row exists yet).
admin.get('/me/permissions', async (c) => {
  const user = c.get('user');

  if (user.role === 'admin') {
    return c.json({
      role: 'admin',
      can_reset_devices: true,
      can_grade_quizzes: true,
      can_answer_questions: true,
      can_manage_codes: true,
      can_manage_courses: true,
    });
  }

  const perm = await c.env.DB.prepare(
    'SELECT can_reset_devices, can_grade_quizzes, can_answer_questions, can_manage_codes, can_manage_courses FROM assistant_permissions WHERE assistant_id = ?'
  ).bind(user.id).first<Record<string, number>>();

  return c.json({
    role: 'assistant',
    can_reset_devices: !!perm?.can_reset_devices,
    can_grade_quizzes: !!perm?.can_grade_quizzes,
    can_answer_questions: !!perm?.can_answer_questions,
    can_manage_codes: !!perm?.can_manage_codes,
    can_manage_courses: !!perm?.can_manage_courses,
  });
});

// ════════════════════════════════════════════════
//  ASSISTANT ROLE MANAGEMENT (Admin Only)
// ════════════════════════════════════════════════

// ── GET /admin/assistants — List all assistants and their permissions ──
admin.get('/assistants', requireRole('admin'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const { results: assistants } = await c.env.DB.prepare(
    `SELECT p.id, p.full_name, p.email, p.phone, p.status, p.created_at,
       ap.can_reset_devices, ap.can_grade_quizzes, ap.can_answer_questions, ap.can_manage_codes, ap.can_manage_courses
     FROM profiles p
     LEFT JOIN assistant_permissions ap ON p.id = ap.assistant_id
     WHERE p.role = 'assistant' AND p.platform = ?
     ORDER BY p.created_at DESC`
  ).bind(platform).all();
  return c.json({ assistants });
});

// ── POST /admin/assistants — Create assistant profile & set permissions ──
admin.post('/assistants', requireRole('admin'), async (c) => {
  const body = await c.req.json();
  const schema = z.object({
    email: z.string().email(),
    full_name: z.string().min(2),
    phone: z.string().optional(),
    // كلمة مرور اختيارية: بدونها لا يستطيع المساعد تسجيل الدخول
    // (لا يوجد مزوّد هوية خارجي بعد إزالة Supabase).
    password: z.string().min(8).max(200).optional(),
    permissions: z.object({
      can_reset_devices: z.boolean(),
      can_grade_quizzes: z.boolean(),
      can_answer_questions: z.boolean(),
      can_manage_codes: z.boolean(),
      can_manage_courses: z.boolean(),
    })
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const d = parsed.data;
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const existing = await c.env.DB.prepare('SELECT id FROM profiles WHERE email = ? AND platform = ?').bind(d.email, platform).first();
  if (existing) {
    return c.json({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر' } }, 400);
  }

  const assistantId = generateId();
  const now = nowISO();
  const passwordHash = d.password ? await hashPassword(d.password) : null;

  // Create profile and permissions transactionally
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO profiles (id, supabase_user_id, email, password_hash, role, full_name, phone, status, max_devices, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'assistant', ?, ?, 'active', 5, ?, ?, ?)`
    ).bind(assistantId, `local-${assistantId}`, d.email, passwordHash, d.full_name, d.phone || '', platform, now, now),
    c.env.DB.prepare(
      `INSERT INTO assistant_permissions (id, assistant_id, can_reset_devices, can_grade_quizzes, can_answer_questions, can_manage_codes, can_manage_courses, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      generateId(),
      assistantId,
      d.permissions.can_reset_devices ? 1 : 0,
      d.permissions.can_grade_quizzes ? 1 : 0,
      d.permissions.can_answer_questions ? 1 : 0,
      d.permissions.can_manage_codes ? 1 : 0,
      d.permissions.can_manage_courses ? 1 : 0,
      now,
      now
    )
  ]);

  return c.json({ ok: true, assistant_id: assistantId }, 201);
});

// ── PATCH /admin/assistants/:id — Update assistant permissions ──
admin.patch('/assistants/:id', requireRole('admin'), async (c) => {
  const assistantId = c.req.param('id');
  const body = await c.req.json();
  const schema = z.object({
    permissions: z.object({
      can_reset_devices: z.boolean(),
      can_grade_quizzes: z.boolean(),
      can_answer_questions: z.boolean(),
      can_manage_codes: z.boolean(),
      can_manage_courses: z.boolean(),
    })
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const d = parsed.data;
  const now = nowISO();
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const result = await c.env.DB.prepare(
    `INSERT INTO assistant_permissions (id, assistant_id, can_reset_devices, can_grade_quizzes, can_answer_questions, can_manage_codes, can_manage_courses, created_at, updated_at)
     SELECT ?, id, ?, ?, ?, ?, ?, ?, ? FROM profiles
     WHERE id = ? AND role = 'assistant' AND platform = ?
     ON CONFLICT(assistant_id) DO UPDATE SET
       can_reset_devices = excluded.can_reset_devices,
       can_grade_quizzes = excluded.can_grade_quizzes,
       can_answer_questions = excluded.can_answer_questions,
       can_manage_codes = excluded.can_manage_codes,
       can_manage_courses = excluded.can_manage_courses,
       updated_at = excluded.updated_at`
  ).bind(
    generateId(),
    d.permissions.can_reset_devices ? 1 : 0,
    d.permissions.can_grade_quizzes ? 1 : 0,
    d.permissions.can_answer_questions ? 1 : 0,
    d.permissions.can_manage_codes ? 1 : 0,
    d.permissions.can_manage_courses ? 1 : 0,
    now,
    now,
    assistantId,
    platform
  ).run();

  if (result.meta.changes === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Assistant not found' } }, 404);
  }
  return c.json({ ok: true });
});

// ── DELETE /admin/assistants/:id — Delete assistant profile ──
admin.delete('/assistants/:id', requireRole('admin'), async (c) => {
  const assistantId = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM assistant_permissions WHERE assistant_id = ?
       AND EXISTS (SELECT 1 FROM profiles WHERE id = assistant_permissions.assistant_id AND role = 'assistant' AND platform = ?)`
    ).bind(assistantId, platform),
    c.env.DB.prepare("DELETE FROM profiles WHERE id = ? AND role = 'assistant' AND platform = ?").bind(assistantId, platform)
  ]);
  if (results[1].meta.changes === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Assistant not found' } }, 404);
  }
  return c.json({ ok: true });
});

// ════════════════════════════════════════════════
//  DEVICE RESET QUEUE MANAGEMENT (can_reset_devices)
// ════════════════════════════════════════════════

// ── GET /admin/device-resets — List reset tickets ──
admin.get('/device-resets', requirePermission('can_reset_devices'), async (c) => {
  const status = c.req.query('status') || 'pending';
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 50);
  const offset = (page - 1) * limit;
  const { results } = await c.env.DB.prepare(
    `SELECT drr.*, p.full_name as student_name, p.email as student_email, p.phone as student_phone
     FROM device_reset_requests drr
     INNER JOIN profiles p ON drr.student_id = p.id
     WHERE drr.status = ? AND p.platform = ?
     ORDER BY drr.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(status, platform, limit, offset).all();

  const { count: total } = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM device_reset_requests drr
     INNER JOIN profiles p ON drr.student_id = p.id
     WHERE drr.status = ? AND p.platform = ?`
  ).bind(status, platform).first<{ count: number }>() || { count: 0 };

  return c.json({ reset_requests: results, meta: { page, limit, total, has_more: offset + limit < total } });
});

// ── POST /admin/device-resets/:id/action — Approve or Reject a reset ticket ──
admin.post('/device-resets/:id/action', requirePermission('can_reset_devices'), async (c) => {
  const requestId = c.req.param('id');
  const { action, rejection_reason } = await c.req.json() as { action: 'approved' | 'rejected'; rejection_reason?: string };
  
  if (!['approved', 'rejected'].includes(action)) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'إجراء غير صحيح' } }, 400);
  }

  const user = c.get('user');
  const now = nowISO();

  const req = await c.env.DB.prepare(
    'SELECT student_id, device_id, platform, model FROM device_reset_requests WHERE id = ? AND status = \'pending\''
  ).bind(requestId).first<{ student_id: string; device_id: string; platform: string; model: string | null }>();

  if (!req) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'طلب فك الارتباط غير موجود أو تم معالجته بالفعل' } }, 404);
  }

  if (action === 'approved') {
    const devId = crypto.randomUUID();
    // Delete all devices for this student to reset their device state,
    // and insert the approved device directly as trusted (is_trusted = 1)
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM devices WHERE student_id = ?').bind(req.student_id),
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
         VALUES (?, ?, ?, ?, ?, NULL, 1, 0, ?, ?)`
      ).bind(devId, req.student_id, req.device_id, req.platform, req.model || `Approved (${req.platform})`, now, now),
      c.env.DB.prepare(
        `UPDATE device_reset_requests SET status = 'approved', handled_by = ?, handled_at = ?, updated_at = ? WHERE id = ?`
      ).bind(user.id, now, now, requestId)
    ]);
  } else {
    await c.env.DB.prepare(
      `UPDATE device_reset_requests SET status = 'rejected', handled_by = ?, rejection_reason = ?, handled_at = ?, updated_at = ? WHERE id = ?`
    ).bind(user.id, rejection_reason || '', now, now, requestId).run();
  }

  return c.json({ ok: true });
});

// ════════════════════════════════════════════════
//  ADVANCED NON-AI ANALYTICS (Admin Only)
// ════════════════════════════════════════════════

admin.get('/analytics/advanced', requireRole('admin'), async (c) => {
  const db = c.env.DB;

  // 1. Lagging Students (No video views in 7 days OR average quiz grade < 50%)
  const platform = c.env.PLATFORM_KEY || 'fusha';

  // Grade average only counts SUBMITTED attempts: opening a timed quiz creates a
  // placeholder attempt with score=0/is_submitted=0, which would otherwise drag a
  // student's average down and falsely flag them as lagging. NULLIF guards
  // against max_score=0. The "no views in 7 days" branch additionally requires
  // the student to have been enrolled for at least 7 days — a student who
  // activated a course yesterday isn't "inactive" yet.
  const { results: laggingStudents } = await db.prepare(
    `SELECT p.id, p.full_name, p.email, p.phone, p.grade, p.governorate,
       (SELECT MAX(created_at) FROM lecture_playback_logs WHERE student_id = p.id) as last_view_at,
       (SELECT AVG(qa.score / NULLIF(q.max_score, 0)) * 100 FROM quiz_attempts qa INNER JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.student_id = p.id AND qa.is_submitted = 1) as avg_quiz_grade
     FROM profiles p
     WHERE p.role = 'student' AND p.status = 'active' AND p.platform = ?
     AND (
       (SELECT COUNT(*) FROM enrollments WHERE student_id = p.id AND status = 'active') > 0
       AND (
         (
           (SELECT COUNT(*) FROM lecture_playback_logs WHERE student_id = p.id AND created_at >= datetime('now', '-7 days')) = 0
           AND (SELECT MIN(datetime(granted_at)) FROM enrollments WHERE student_id = p.id AND status = 'active') <= datetime('now', '-7 days')
         )
         OR
         ((SELECT AVG(qa.score / NULLIF(q.max_score, 0)) FROM quiz_attempts qa INNER JOIN quizzes q ON qa.quiz_id = q.id WHERE qa.student_id = p.id AND qa.is_submitted = 1) < 0.5)
       )
     )
     ORDER BY avg_quiz_grade ASC, last_view_at ASC
     LIMIT 50`
  ).bind(platform).all();

  // 2. Video Lecture Completion Rates
  // Only progress rows with an actual watch signal count as "viewers": quiz
  // submission also inserts lesson_progress rows (watched_seconds=0,
  // last_position=0) which would otherwise inflate viewer counts and drag
  // completion averages toward zero. Per-row completion is capped at 100%
  // (older data predates the server-side watched_seconds clamp). Unpublished
  // lessons are excluded — students can't watch them.
  const { results: videoEngagement } = await db.prepare(
    `SELECT l.id, l.title, c.title as course_title,
       COUNT(CASE WHEN COALESCE(lp.watched_seconds, 0) > 0 OR COALESCE(lp.last_position, 0) > 0 THEN 1 END) as total_viewers,
       AVG(CASE WHEN COALESCE(lp.watched_seconds, 0) > 0 OR COALESCE(lp.last_position, 0) > 0 THEN lp.watched_seconds END) as avg_watched_seconds,
       AVG(CASE WHEN COALESCE(lp.watched_seconds, 0) > 0 OR COALESCE(lp.last_position, 0) > 0
             THEN MIN(1.0, CAST(lp.watched_seconds AS REAL) / NULLIF(COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0), 0))
           END) * 100 as avg_completion_percentage
     FROM lessons l
     INNER JOIN courses c ON l.course_id = c.id
     LEFT JOIN lesson_progress lp ON l.id = lp.lesson_id
     WHERE l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?
     GROUP BY l.id
     ORDER BY avg_completion_percentage DESC
     LIMIT 20`
  ).bind(platform).all();

  // 3. Assistant Performance KPIs (Q&As answered, reset tickets solved)
  const { results: assistantKpis } = await db.prepare(
    `SELECT p.id, p.full_name, p.email,
       (SELECT COUNT(*) FROM answers WHERE author_id = p.id) as questions_answered,
       (SELECT COUNT(*) FROM device_reset_requests WHERE handled_by = p.id) as resets_handled
     FROM profiles p
     WHERE p.role = 'assistant' AND p.platform = ?
     ORDER BY questions_answered DESC`
  ).bind(platform).all();

  return c.json({
    lagging_students: laggingStudents,
    video_engagement: videoEngagement,
    assistant_kpis: assistantKpis
  });
});

// ════════════════════════════════════════════════
//  ANALYTICS & SETTINGS
// ════════════════════════════════════════════════

admin.get('/analytics/overview', requireRole('admin'), async (c) => {
  const db = c.env.DB;

  const platform = c.env.PLATFORM_KEY || 'fusha';

  const [students, courses, enrollments, questions, devices, revenue] = await db.batch([
    db.prepare("SELECT COUNT(*) as count FROM profiles WHERE role = 'student' AND platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM courses WHERE is_archived = 0 AND platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM enrollments WHERE status = 'active' AND platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM questions q INNER JOIN profiles p ON q.student_id = p.id WHERE q.status = 'open' AND p.platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM devices d INNER JOIN profiles p ON d.student_id = p.id WHERE p.platform = ?").bind(platform),
    db.prepare("SELECT COUNT(*) as count FROM activation_codes WHERE status = 'used' AND platform = ?").bind(platform),
  ]);

  const { results: recentEnrollments } = await db.prepare(
    `SELECT DATE(e.granted_at) as date, COUNT(*) as count
     FROM enrollments e
     WHERE e.granted_at >= datetime('now', '-7 days') AND e.platform = ?
     GROUP BY DATE(e.granted_at)
     ORDER BY date DESC`
  ).bind(platform).all();

  const { results: topCourses } = await db.prepare(
    `SELECT c.title, COUNT(e.id) as count
     FROM courses c
     JOIN enrollments e ON e.course_id = c.id AND e.status = 'active'
     WHERE c.is_archived = 0 AND c.platform = ?
     GROUP BY c.id
     ORDER BY count DESC
     LIMIT 5`
  ).bind(platform).all();

  return c.json({
    total_students: (students.results?.[0] as any)?.count || 0,
    total_courses: (courses.results?.[0] as any)?.count || 0,
    active_enrollments: (enrollments.results?.[0] as any)?.count || 0,
    open_questions: (questions.results?.[0] as any)?.count || 0,
    total_devices: (devices.results?.[0] as any)?.count || 0,
    codes_used: (revenue.results?.[0] as any)?.count || 0,
    recent_enrollments: recentEnrollments,
    top_courses: topCourses,
  });
});

admin.get('/settings', requireRole('admin'), async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM app_settings').all();
  const settings: Record<string, string> = {};
  for (const row of results as any[]) {
    settings[row.key] = row.value;
  }
  return c.json({ settings });
});

admin.patch('/settings', requireRole('admin'), audit('admin.settings.update'), async (c) => {
  const body = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const data = parsed.data;
  const statements = Object.entries(data).map(([key, value]) =>
    c.env.DB.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').bind(key, value)
  );
  if (statements.length > 0) await c.env.DB.batch(statements);
  return c.json({ ok: true });
});

// ════════════════════════════════════════════════
//  NOTIFICATIONS (Admin Push)
// ════════════════════════════════════════════════

admin.post('/notifications/send', requireRole('admin'), audit('admin.notification.send'), async (c) => {
  const body = await c.req.json();
  const sendNotificationSchema = z.object({
    audience: z.enum(['all', 'course', 'user']),
    course_id: z.string().trim().optional().nullable(),
    recipient_id: z.string().trim().optional().nullable(),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(2000),
  }).refine(d => d.audience !== 'course' || !!d.course_id, {
    path: ['course_id'], message: 'course_id is required for the course audience',
  }).refine(d => d.audience !== 'user' || !!d.recipient_id, {
    path: ['recipient_id'], message: 'recipient_id is required for the user audience',
  });
  const parsed = sendNotificationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const courseId = d.audience === 'course' ? d.course_id : null;
  const recipientId = d.audience === 'user' ? d.recipient_id : null;

  if (d.audience === 'course') {
    const course = await c.env.DB.prepare(
      'SELECT id FROM courses WHERE id = ? AND platform = ?'
    ).bind(courseId, platform).first();
    if (!course) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Course not found' } }, 404);
    }
  } else if (d.audience === 'user') {
    const recipient = await c.env.DB.prepare(
      'SELECT id FROM profiles WHERE id = ? AND platform = ?'
    ).bind(recipientId, platform).first();
    if (!recipient) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Recipient not found' } }, 404);
    }
  }

  const notifId = generateId();
  await c.env.DB.prepare(
    `INSERT INTO notifications (id, recipient_id, audience, course_id, type, title, body, platform, created_at, sent_at)
     VALUES (?, ?, ?, ?, 'announcement', ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(notifId, recipientId, d.audience, courseId, d.title, d.body, platform).run();

  let tokens: string[] = [];
  if (d.audience === 'all') {
    // Keep anonymous installs while checking linked profiles against the tenant.
    const { results } = await c.env.DB.prepare(
      `SELECT s.push_token FROM push_subscriptions s
       LEFT JOIN profiles p ON s.student_id = p.id
       WHERE s.push_token IS NOT NULL AND s.platform_key = ?
         AND (s.student_id IS NULL OR p.platform = ?)
       UNION
       SELECT d.push_token FROM devices d
       INNER JOIN profiles p ON d.student_id = p.id
       WHERE d.push_token IS NOT NULL AND p.platform = ?`
    ).bind(platform, platform, platform).all<{ push_token: string }>();
    tokens = results.map(r => r.push_token);
  } else if (d.audience === 'course') {
    const { results } = await c.env.DB.prepare(
      `WITH eligible_students AS (
         SELECT p.id FROM profiles p
         INNER JOIN enrollments e ON e.student_id = p.id
         INNER JOIN courses c ON e.course_id = c.id
         WHERE p.platform = ? AND e.platform = ? AND c.platform = ? AND c.id = ?
           AND e.status = 'active'
           AND (e.expires_at IS NULL OR datetime(e.expires_at) > datetime('now'))
       )
       SELECT s.push_token FROM push_subscriptions s
       INNER JOIN eligible_students p ON s.student_id = p.id
       WHERE s.push_token IS NOT NULL AND s.platform_key = ?
       UNION
       SELECT d.push_token FROM devices d
       INNER JOIN eligible_students p ON d.student_id = p.id
       WHERE d.push_token IS NOT NULL`
    ).bind(platform, platform, platform, courseId, platform).all<{ push_token: string }>();
    tokens = results.map(r => r.push_token);
  } else if (d.audience === 'user') {
    const { results } = await c.env.DB.prepare(
      `SELECT s.push_token FROM push_subscriptions s
       INNER JOIN profiles p ON s.student_id = p.id
       WHERE s.student_id = ? AND s.push_token IS NOT NULL AND s.platform_key = ? AND p.platform = ?
       UNION
       SELECT d.push_token FROM devices d
       INNER JOIN profiles p ON d.student_id = p.id
       WHERE d.student_id = ? AND d.push_token IS NOT NULL AND p.platform = ?`
    ).bind(recipientId, platform, platform, recipientId, platform).all<{ push_token: string }>();
    tokens = results.map(r => r.push_token);
  }
  // UNION deduplicates both sources; discard blank tokens without altering valid ones.
  tokens = tokens.filter(token => token.trim().length > 0);

  if (tokens.length > 0) {
    c.executionCtx.waitUntil(
      sendNotificationDirectly(c.env, {
        type: 'multicast',
        tokens,
        title: d.title,
        body: d.body,
        notificationId: notifId,
      })
    );
  }

  return c.json({ ok: true, notification_id: notifId, tokens_count: tokens.length });
});

// ── Quiz & Homework Administration Endpoints ──

// 1) GET /admin/lessons/:lessonId/quizzes — Get quizzes for a lesson
admin.get('/lessons/:lessonId/quizzes', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('lessonId');
  const { results } = await c.env.DB.prepare('SELECT * FROM quizzes WHERE lesson_id = ?').bind(lessonId).all();
  return c.json({ quizzes: results });
});

// 2) POST /admin/lessons/:lessonId/quizzes — Create or update a quiz for a lesson
admin.post('/lessons/:lessonId/quizzes', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('lessonId');
  const body = await c.req.json();
  const quizSchema = z.object({
    title: z.string().min(1),
    max_score: z.coerce.number().int().positive().default(100),
    is_published: z.preprocess((val) => val === true || val === 'true' || val === 1 || val === '1', z.boolean()).default(false),
    randomize_questions: z.preprocess((val) => val === true || val === 'true' || val === 1 || val === '1', z.boolean()).default(false),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    time_limit_mins: z.preprocess((val) => (val === '' || val === null || val === undefined) ? null : Number(val), z.number().int().positive().nullable()).optional(),
  });
  const parsed = quizSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;

  // Fetch course_id for this lesson
  const lesson = await c.env.DB.prepare('SELECT course_id FROM lessons WHERE id = ?').bind(lessonId).first();
  if (!lesson) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'المحاضرة غير موجودة' } }, 404);
  }
  const courseId = (lesson as any).course_id;

  // Check if quiz already exists for this lesson
  const existing = await c.env.DB.prepare('SELECT id FROM quizzes WHERE lesson_id = ?').bind(lessonId).first();
  let quizId = existing ? (existing as any).id : null;

  if (quizId) {
    // Update existing quiz
    await c.env.DB.prepare(
      `UPDATE quizzes 
       SET title = ?, max_score = ?, is_published = ?, randomize_questions = ?, start_time = ?, end_time = ?, time_limit_mins = ?, updated_at = datetime('now') 
       WHERE id = ?`
    ).bind(
      d.title,
      d.max_score,
      d.is_published ? 1 : 0,
      d.randomize_questions ? 1 : 0,
      d.start_time || null,
      d.end_time || null,
      d.time_limit_mins || null,
      quizId
    ).run();
  } else {
    // Insert new quiz
    quizId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quizzes (id, course_id, lesson_id, title, max_score, is_published, randomize_questions, start_time, end_time, time_limit_mins, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
    ).bind(
      quizId,
      courseId,
      lessonId,
      d.title,
      d.max_score,
      d.is_published ? 1 : 0,
      d.randomize_questions ? 1 : 0,
      d.start_time || null,
      d.end_time || null,
      d.time_limit_mins || null
    ).run();
  }

  const quiz = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(quizId).first();
  return c.json({ quiz });
});

// 3) GET /admin/quizzes/:id — Fetch quiz and its questions
admin.get('/quizzes/:id', requirePermission('can_manage_courses'), async (c) => {
  const quizId = c.req.param('id');
  const quiz = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(quizId).first();
  if (!quiz) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الاختبار غير موجود' } }, 404);
  }

  const { results: questions } = await c.env.DB.prepare(
    'SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).bind(quizId).all();

  const parsedQuestions = (questions as any[]).map(q => ({
    ...q,
    options: JSON.parse(q.options_json),
  }));

  return c.json({ quiz, questions: parsedQuestions });
});

// 4) DELETE /admin/quizzes/:id — Delete a quiz
admin.delete('/quizzes/:id', requirePermission('can_manage_courses'), async (c) => {
  const quizId = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM quizzes WHERE id = ?').bind(quizId).run();
  return c.json({ ok: true });
});

// 5) POST /admin/quizzes/:id/questions — Add a question to a quiz
admin.post('/quizzes/:id/questions', requirePermission('can_manage_courses'), async (c) => {
  const quizId = c.req.param('id');
  const body = await c.req.json();
  const questionSchema = z.object({
    question_text: z.string().optional().nullable(),
    image_url: z.string().max(1000).optional().nullable(),
    options: z.array(z.string().min(1)).min(2),
    correct_option: z.string().min(1),
    explanation: z.string().max(4000).optional().nullable(),
    score: z.number().int().positive().default(1),
    sort_order: z.number().int().default(0),
  });
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;

  const id = generateId();
  await c.env.DB.prepare(
    `INSERT INTO quiz_questions (id, quiz_id, question_text, image_url, options_json, correct_option, explanation, score, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    quizId,
    d.question_text || null,
    d.image_url || null,
    JSON.stringify(d.options),
    d.correct_option,
    d.explanation || null,
    d.score,
    d.sort_order
  ).run();

  const question = await c.env.DB.prepare('SELECT * FROM quiz_questions WHERE id = ?').bind(id).first() as any;
  return c.json({
    question: {
      ...question,
      options: JSON.parse(question.options_json),
    }
  }, 201);
});

// 6) PATCH /admin/quizzes/questions/:id — Update a quiz question
admin.patch('/quizzes/questions/:id', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const questionSchema = z.object({
    question_text: z.string().optional().nullable(),
    image_url: z.string().max(1000).optional().nullable(),
    options: z.array(z.string().min(1)).min(2).optional(),
    correct_option: z.string().min(1).optional(),
    explanation: z.string().max(4000).optional().nullable(),
    score: z.number().int().positive().optional(),
    sort_order: z.number().int().optional(),
  });
  const parsed = questionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;

  const question = await c.env.DB.prepare('SELECT * FROM quiz_questions WHERE id = ?').bind(id).first() as any;
  if (!question) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'السؤال غير موجود' } }, 404);
  }

  const qText = d.question_text !== undefined ? d.question_text : question.question_text;
  const imgUrl = d.image_url !== undefined ? d.image_url : question.image_url;
  const optJson = d.options !== undefined ? JSON.stringify(d.options) : question.options_json;
  const corrOpt = d.correct_option !== undefined ? d.correct_option : question.correct_option;
  const explVal = d.explanation !== undefined ? d.explanation : question.explanation;
  const scoreVal = d.score !== undefined ? d.score : question.score;
  const sortVal = d.sort_order !== undefined ? d.sort_order : question.sort_order;

  await c.env.DB.prepare(
    `UPDATE quiz_questions 
     SET question_text = ?, image_url = ?, options_json = ?, correct_option = ?, explanation = ?, score = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(qText, imgUrl, optJson, corrOpt, explVal, scoreVal, sortVal, id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM quiz_questions WHERE id = ?').bind(id).first() as any;
  return c.json({
    question: {
      ...updated,
      options: JSON.parse(updated.options_json),
    }
  });
});

// 7) DELETE /admin/quizzes/questions/:id — Delete a quiz question
admin.delete('/quizzes/questions/:id', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM quiz_questions WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// 8) POST /admin/quizzes/question-image-url — Generate presigned R2 upload URL for question images
admin.post('/quizzes/question-image-url', requirePermission('can_manage_courses'), async (c) => {
  const body = await c.req.json() as { filename: string; mime_type?: string };
  if (!body.filename) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'اسم الملف مطلوب' } }, 400);
  }

  const id = generateId();
  const cleanFilename = sanitizeFilename(body.filename);
  const r2Key = `questions/${id}_${cleanFilename}`;
  const contentType = body.mime_type || 'image/jpeg';

  const origin = new URL(c.req.url).origin;
  const uploadUrl = await getPresignedPutUrl(
    c.env,
    c.env.R2_BUCKET_NAME || 'fusha-ashraf-files',
    r2Key,
    contentType,
    3600, // 1 hour expiration
    origin
  );

  const publicUrl = `${origin}/files/questions/${id}_${cleanFilename}`;

  return c.json({
    upload_url: uploadUrl,
    public_url: publicUrl,
    r2_key: r2Key,
  });
});

// ── STANDALONE EXAMS (lesson_id IS NULL) ──

// 9) GET /admin/exams — List all standalone exams
admin.get('/exams', requirePermission('can_manage_courses'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const courseId = c.req.query('course_id');
  
  let query = `
    SELECT q.*, c.title as course_title 
    FROM quizzes q 
    INNER JOIN courses c ON q.course_id = c.id 
    WHERE q.lesson_id IS NULL AND c.platform = ?
  `;
  const params: unknown[] = [platform];
  
  if (courseId) {
    query += ' AND q.course_id = ?';
    params.push(courseId);
  }
  
  query += ' ORDER BY q.created_at DESC';
  
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ exams: results });
});

// 10) POST /admin/exams — Create or update a standalone exam
admin.post('/exams', requirePermission('can_manage_courses'), async (c) => {
  const body = await c.req.json();
  const examSchema = z.object({
    id: z.string().optional(),
    course_id: z.string().min(1),
    title: z.string().min(1),
    max_score: z.coerce.number().int().positive().default(100),
    is_published: z.preprocess((val) => val === true || val === 'true' || val === 1 || val === '1', z.boolean()).default(false),
    randomize_questions: z.preprocess((val) => val === true || val === 'true' || val === 1 || val === '1', z.boolean()).default(false),
    is_free: z.preprocess((val) => val === true || val === 'true' || val === 1 || val === '1', z.boolean()).default(false),
    cover_image: z.string().nullable().optional(),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    time_limit_mins: z.preprocess((val) => (val === '' || val === null || val === undefined) ? null : Number(val), z.number().int().positive().nullable()).optional(),
  });
  
  const parsed = examSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  
  const d = parsed.data;
  let examId = d.id;
  
  if (examId) {
    await c.env.DB.prepare(
      `UPDATE quizzes 
       SET course_id = ?, title = ?, max_score = ?, is_published = ?, randomize_questions = ?, is_free = ?, cover_image = ?, start_time = ?, end_time = ?, time_limit_mins = ?, updated_at = datetime('now') 
       WHERE id = ? AND lesson_id IS NULL`
    ).bind(
      d.course_id,
      d.title,
      d.max_score,
      d.is_published ? 1 : 0,
      d.randomize_questions ? 1 : 0,
      d.is_free ? 1 : 0,
      d.cover_image || null,
      d.start_time || null,
      d.end_time || null,
      d.time_limit_mins || null,
      examId
    ).run();
  } else {
    examId = generateId();
    await c.env.DB.prepare(
      `INSERT INTO quizzes (id, course_id, lesson_id, title, max_score, is_published, randomize_questions, is_free, cover_image, start_time, end_time, time_limit_mins, sort_order, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
    ).bind(
      examId,
      d.course_id,
      d.title,
      d.max_score,
      d.is_published ? 1 : 0,
      d.randomize_questions ? 1 : 0,
      d.is_free ? 1 : 0,
      d.cover_image || null,
      d.start_time || null,
      d.end_time || null,
      d.time_limit_mins || null
    ).run();
  }
  
  const exam = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(examId).first();
  return c.json({ exam });
});

// 11) GET /admin/exams/grades — Get analytical grade sheet for standalone exams
admin.get('/exams/grades', requirePermission('can_manage_courses'), async (c) => {
  const platform = c.env.PLATFORM_KEY || 'fusha';
  
  // 1. Get all published or draft standalone exams
  const { results: exams } = await c.env.DB.prepare(
    `SELECT q.id, q.title, q.max_score, c.title as course_title 
     FROM quizzes q 
     INNER JOIN courses c ON q.course_id = c.id
     WHERE q.lesson_id IS NULL AND c.platform = ?
     ORDER BY q.created_at ASC`
  ).bind(platform).all();
  
  // 2. Get all students
  const { results: students } = await c.env.DB.prepare(
    `SELECT id, full_name, phone 
     FROM profiles 
     WHERE role = 'student' AND platform = ?
     ORDER BY full_name ASC`
  ).bind(platform).all();
  
  // 3. Get submitted quiz attempts for standalone exams
  const { results: attempts } = await c.env.DB.prepare(
    `SELECT qa.student_id, qa.quiz_id, qa.score 
     FROM quiz_attempts qa
     INNER JOIN quizzes q ON qa.quiz_id = q.id
     WHERE q.lesson_id IS NULL AND qa.is_submitted = 1`
  ).all();

  // Map attempts for quick lookup
  const attemptMap = new Map<string, number>();
  attempts.forEach((att: any) => {
    attemptMap.set(`${att.student_id}_${att.quiz_id}`, att.score);
  });

  // Map students with their grades
  const studentGrades = students.map((s: any) => {
    const grades: Record<string, number | null> = {};
    let totalScore = 0;
    exams.forEach((exam: any) => {
      const score = attemptMap.get(`${s.id}_${exam.id}`);
      grades[exam.id] = score !== undefined ? score : null;
      if (score !== undefined) {
        totalScore += score;
      }
    });
    return {
      student_id: s.id,
      student_name: s.full_name,
      student_phone: s.phone,
      grades,
      total_score: totalScore
    };
  });

  return c.json({ exams, students: studentGrades });
});

export default admin;

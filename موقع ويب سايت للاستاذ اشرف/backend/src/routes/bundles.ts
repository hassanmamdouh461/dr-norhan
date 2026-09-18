import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { optionalAuth, requireAuth, requirePermission } from '../middleware/auth';
import { generateId } from '../utils/id';

const bundles = new Hono<HonoBindings>();

// مسارات /admin/* تحتاج تحميل المستخدم أولاً — requirePermission وحدها لا تقرأ التوكن.
bundles.use('/admin/*', requireAuth);

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.1). */
const BUNDLE_LABELS = {
  title: 'الباقات والخطط',
  subtitle: 'اختر الباقة المناسبة واشترك للوصول إلى الامتحانات',
  current_badge: 'الحالية',
  no_features: 'لا توجد ميزات محددة',
  upgrade: 'ترقية',
  change: 'تغيير',
  loading: 'جاري تحميل الباقات...',
  load_error: 'حدث خطأ أثناء تحميل الباقات',
  empty: 'لا توجد باقات متاحة حالياً',
  purchase_title: 'شراء الباقة',
  price_label: 'السعر',
  transfer_image_label: 'صورة إثبات التفعيل *',
  pick_image: 'اضغط لاختيار الصورة',
  submit: 'إرسال طلب الاشتراك',
  error_image_required: 'يرجى رفع صورة إثبات التحويل',
  success: 'تم إرسال طلب الاشتراك بنجاح',
  error_failed: 'حدث خطأ أثناء إرسال الطلب',
} as const;

function parseFeatures(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function loadBundleCourses(env: HonoBindings['Bindings'], bundleIds: string[]) {
  if (bundleIds.length === 0) return new Map<string, { id: string; title: string }[]>();
  const placeholders = bundleIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT bc.bundle_id, c.id, c.title
     FROM bundle_courses bc
     INNER JOIN courses c ON c.id = bc.course_id
     WHERE bc.bundle_id IN (${placeholders})
     ORDER BY c.title ASC`
  ).bind(...bundleIds).all<{ bundle_id: string; id: string; title: string }>();

  const map = new Map<string, { id: string; title: string }[]>();
  for (const row of results as any[]) {
    const list = map.get(row.bundle_id) || [];
    list.push({ id: row.id, title: row.title });
    map.set(row.bundle_id, list);
  }
  return map;
}

// ── GET /bundles — الباقات المتاحة للطالب ──
bundles.get('/bundles', optionalAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, description, cover_url, price, reference_price, is_price_hidden, features_json, sort_order
     FROM bundles
     WHERE platform = ? AND is_published = 1
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all<any[]>();

  const courseMap = await loadBundleCourses(c.env, (results as any[]).map(r => r.id));

  // الباقة «الحالية» = الطالب مشترك فعلياً في كل كورسات الباقة
  let enrolledCourseIds = new Set<string>();
  if (user) {
    const { results: enrollments } = await c.env.DB.prepare(
      "SELECT course_id FROM enrollments WHERE student_id = ? AND status = 'active'"
    ).bind(user.id).all<{ course_id: string }>();
    enrolledCourseIds = new Set((enrollments as any[]).map(e => e.course_id));
  }

  const list = (results as any[]).map(b => {
    const courses = courseMap.get(b.id) || [];
    const isCurrent = !!user && courses.length > 0 && courses.every(course => enrolledCourseIds.has(course.id));
    const priceHidden = b.is_price_hidden === 1;

    return {
      id: b.id,
      title: b.title,
      description: b.description,
      cover_url: b.cover_url,
      price: b.price,
      reference_price: b.reference_price,
      is_price_hidden: priceHidden,
      features: parseFeatures(b.features_json),
      sort_order: b.sort_order,
      courses,
      course_count: courses.length,
      is_current: isCurrent,
      status_label: isCurrent ? BUNDLE_LABELS.current_badge : null,
      action_label: priceHidden ? BUNDLE_LABELS.change : BUNDLE_LABELS.upgrade,
    };
  });

  return c.json({ bundles: list, labels: BUNDLE_LABELS });
});

// ── GET /admin/bundles — كل الباقات (بما فيها غير المنشورة) ──
bundles.get('/admin/bundles', requirePermission('can_manage_courses'), async (c) => {
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM bundles WHERE platform = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all<any[]>();

  const courseMap = await loadBundleCourses(c.env, (results as any[]).map(r => r.id));

  return c.json({
    bundles: (results as any[]).map(b => ({
      ...b,
      features: parseFeatures(b.features_json),
      courses: courseMap.get(b.id) || [],
      course_count: (courseMap.get(b.id) || []).length,
    })),
  });
});

// ── POST /admin/bundles — إنشاء حزمة ──
const bundleSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(2000).optional().nullable(),
  cover_url: z.string().max(500).optional().nullable(),
  price: z.number().int().min(0).max(1_000_000).optional(),
  reference_price: z.number().int().min(0).max(1_000_000).optional().nullable(),
  is_price_hidden: z.boolean().optional(),
  features: z.array(z.string().max(200)).max(50).optional(),
  is_published: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
  course_ids: z.array(z.string().min(1)).max(200).optional(),
});

bundles.post('/admin/bundles', requirePermission('can_manage_courses'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = bundleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const platform = platformOf(c.env);
  const id = generateId();

  const statements = [
    c.env.DB.prepare(
      `INSERT INTO bundles (id, title, description, cover_url, price, reference_price, is_price_hidden, features_json, is_published, sort_order, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      id,
      d.title,
      d.description ?? null,
      d.cover_url ?? null,
      d.price ?? 0,
      d.reference_price ?? null,
      d.is_price_hidden ? 1 : 0,
      d.features ? JSON.stringify(d.features) : null,
      d.is_published ? 1 : 0,
      d.sort_order ?? 0,
      platform
    ),
  ];

  for (const courseId of d.course_ids || []) {
    statements.push(
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO bundle_courses (bundle_id, course_id)
         SELECT ?, id FROM courses WHERE id = ? AND platform = ?`
      ).bind(id, courseId, platform)
    );
  }

  await c.env.DB.batch(statements);
  const created = await c.env.DB.prepare('SELECT * FROM bundles WHERE id = ?').bind(id).first();
  return c.json({ ok: true, bundle: created }, 201);
});

// ── PATCH /admin/bundles/:id — تعديل حزمة ──
const bundlePatchSchema = bundleSchema.partial();

bundles.patch('/admin/bundles/:id', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare('SELECT id FROM bundles WHERE id = ? AND platform = ?').bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الباقة غير موجودة' } }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = bundlePatchSchema.safeParse(body);
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
  if (d.description !== undefined) assign('description', d.description);
  if (d.cover_url !== undefined) assign('cover_url', d.cover_url);
  if (d.price !== undefined) assign('price', d.price);
  if (d.reference_price !== undefined) assign('reference_price', d.reference_price);
  if (d.is_price_hidden !== undefined) assign('is_price_hidden', d.is_price_hidden ? 1 : 0);
  if (d.features !== undefined) assign('features_json', JSON.stringify(d.features));
  if (d.is_published !== undefined) assign('is_published', d.is_published ? 1 : 0);
  if (d.sort_order !== undefined) assign('sort_order', d.sort_order);

  const statements = [];
  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    statements.push(c.env.DB.prepare(`UPDATE bundles SET ${sets.join(', ')} WHERE id = ?`).bind(...values));
  }

  if (d.course_ids !== undefined) {
    statements.push(c.env.DB.prepare('DELETE FROM bundle_courses WHERE bundle_id = ?').bind(id));
    for (const courseId of d.course_ids) {
      statements.push(
        c.env.DB.prepare(
          `INSERT OR IGNORE INTO bundle_courses (bundle_id, course_id)
           SELECT ?, id FROM courses WHERE id = ? AND platform = ?`
        ).bind(id, courseId, platform)
      );
    }
  }

  if (statements.length > 0) await c.env.DB.batch(statements);

  const updated = await c.env.DB.prepare('SELECT * FROM bundles WHERE id = ?').bind(id).first();
  return c.json({ ok: true, bundle: updated });
});

// ── DELETE /admin/bundles/:id — حذف حزمة ──
bundles.delete('/admin/bundles/:id', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare('SELECT id FROM bundles WHERE id = ? AND platform = ?').bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الباقة غير موجودة' } }, 404);
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM bundle_courses WHERE bundle_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM bundles WHERE id = ?').bind(id),
  ]);

  return c.json({ ok: true });
});

// ── POST /admin/bundles/:id/courses — ربط كورسات بالحزمة ──
bundles.post('/admin/bundles/:id/courses', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ course_ids: z.array(z.string().min(1)).min(1).max(200) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM bundles WHERE id = ? AND platform = ?').bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الباقة غير موجودة' } }, 404);
  }

  const statements = parsed.data.course_ids.map(courseId =>
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO bundle_courses (bundle_id, course_id)
       SELECT ?, id FROM courses WHERE id = ? AND platform = ?`
    ).bind(id, courseId, platform)
  );
  await c.env.DB.batch(statements);

  return c.json({ ok: true });
});

// ── DELETE /admin/bundles/:id/courses/:courseId — فصل كورس عن الحزمة ──
bundles.delete('/admin/bundles/:id/courses/:courseId', requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const courseId = c.req.param('courseId');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare('SELECT id FROM bundles WHERE id = ? AND platform = ?').bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الباقة غير موجودة' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM bundle_courses WHERE bundle_id = ? AND course_id = ?').bind(id, courseId).run();
  return c.json({ ok: true });
});

export default bundles;

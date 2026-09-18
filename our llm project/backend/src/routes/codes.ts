import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requireTrustedDevice, rateLimit, audit } from '../middleware/auth';
import { normalizeCode } from '../utils/id';
import { logError } from '../utils/logger';

const codes = new Hono<HonoBindings>();
const redeemSchema = z.object({
  code: z.string().trim().min(1),
  course_id: z.string().nullish(),
});

// ── POST /codes/redeem — Redeem an activation code ──
codes.post(
  '/redeem',
  requireAuth,
  requireTrustedDevice,
  rateLimit('redeem', 10, 60),
  audit('code.redeem'),
  async (c) => {
    const user = c.get('user');
    if (user.role !== 'student') {
      return c.json({ error: { code: 'FORBIDDEN', message: 'فقط الطلاب يمكنهم تفعيل الأكواد' } }, 403);
    }

    const parsed = redeemSchema.safeParse(await c.req.json<unknown>().catch(() => undefined));
    if (!parsed.success) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'يرجى إدخال كود التفعيل' } }, 400);
    }

    const body = parsed.data;
    const normalizedCode = normalizeCode(body.code);
    const db = c.env.DB;
    const currentPlatform = c.env.PLATFORM_KEY || 'dr-physics';
    // This lookup identifies the code only; all eligibility is checked again in the batch.
    const codeRow = await db.prepare(
      `SELECT ac.id FROM activation_codes ac
       JOIN code_batches cb ON cb.id = ac.batch_id AND cb.platform = ac.platform
       WHERE ac.code = ? AND ac.platform = ?`
    ).bind(normalizedCode, currentPlatform).first<{ id: string }>();

    if (!codeRow) {
      return c.json({ error: { code: 'CODE_NOT_FOUND', message: 'كود التفعيل غير صحيح' } }, 404);
    }

    const targetSql = `
      WITH redemption AS (
        SELECT ? AS code_id, ? AS platform, ? AS student_id, ? AS requested_course
      ), live_code AS (
        SELECT ac.*, COALESCE(NULLIF(ac.access_days, 0), cb.access_days) AS effective_access_days
        FROM activation_codes ac
        JOIN code_batches cb ON cb.id = ac.batch_id AND cb.platform = ac.platform
        JOIN redemption r ON ac.id = r.code_id AND ac.platform = r.platform
      ), target_courses AS (
        SELECT crs.id FROM courses crs
        JOIN live_code ac ON crs.platform = ac.platform
        WHERE (ac.scope_type = 'course' AND crs.id = ac.course_id)
           OR (ac.scope_type = 'bundle' AND EXISTS (
             SELECT 1 FROM bundle_courses bc
             JOIN bundles b ON b.id = bc.bundle_id AND b.platform = ac.platform
             WHERE bc.bundle_id = ac.bundle_id AND bc.course_id = crs.id
               AND bc.platform = ac.platform
           ))
           OR (ac.scope_type = 'all' AND crs.is_archived = 0 AND crs.is_published = 1)
      )`;
    const targetBindings = [codeRow.id, currentPlatform, user.id, body.course_id || null];

    let results: D1Result[];
    try {
      results = await db.batch([
        db.prepare(`${targetSql}
          INSERT INTO enrollments
            (id, student_id, course_id, source, code_id, status, platform, granted_at, expires_at, created_at)
          SELECT lower(hex(randomblob(16))), r.student_id, tc.id, 'code', ac.id, 'active', r.platform,
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
                 CASE WHEN ac.effective_access_days IS NULL OR ac.effective_access_days = 0 THEN NULL
                      ELSE strftime('%Y-%m-%dT%H:%M:%SZ', 'now', printf('%+d days', ac.effective_access_days)) END,
                 strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          FROM target_courses tc CROSS JOIN live_code ac CROSS JOIN redemption r
          JOIN profiles p ON p.id = r.student_id AND p.platform = r.platform
                         AND p.role = 'student' AND p.status = 'active'
          LEFT JOIN enrollments e ON e.student_id = r.student_id AND e.course_id = tc.id
          WHERE ac.status = 'active' AND ac.used_count < ac.max_uses
            AND (ac.expires_at IS NULL OR julianday(ac.expires_at) > julianday('now'))
            AND (ac.valid_from IS NULL OR julianday(ac.valid_from) <= julianday('now'))
            AND (r.requested_course IS NULL OR EXISTS (SELECT 1 FROM target_courses WHERE id = r.requested_course))
            AND (e.id IS NULL OR (e.platform = r.platform
                 AND (e.status <> 'active' OR julianday(e.expires_at) <= julianday('now'))))
          ON CONFLICT(student_id, course_id) DO UPDATE SET
            source = 'code', code_id = excluded.code_id, status = 'active',
            granted_at = excluded.granted_at, expires_at = excluded.expires_at
          WHERE enrollments.platform = excluded.platform
            AND (enrollments.status <> 'active' OR julianday(enrollments.expires_at) <= julianday('now'))
          RETURNING course_id, expires_at
        `).bind(...targetBindings),
        // Keep this immediately after INSERT: changes() is its affected row count,
        // not the number of courses to charge. D1 executes the batch in one transaction.
        db.prepare(`
          UPDATE activation_codes
          SET used_count = used_count + 1,
              status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE 'active' END,
              used_by = ?, used_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
          WHERE id = ? AND platform = ? AND changes() > 0
        `).bind(user.id, codeRow.id, currentPlatform),
        // Diagnose a no-op in the same transaction, not from the stale lookup above.
        db.prepare(`${targetSql}
          SELECT ac.status, ac.scope_type, ac.used_count, ac.max_uses,
                 ac.expires_at IS NOT NULL AND COALESCE(julianday(ac.expires_at) <= julianday('now'), 1) AS expired,
                 ac.valid_from IS NOT NULL AND COALESCE(julianday(ac.valid_from) > julianday('now'), 1) AS not_started,
                 EXISTS (SELECT 1 FROM profiles p WHERE p.id = r.student_id AND p.platform = r.platform
                         AND p.role = 'student' AND p.status = 'active') AS has_profile,
                 r.requested_course IS NULL OR EXISTS (SELECT 1 FROM target_courses WHERE id = r.requested_course) AS scope_matches,
                 (SELECT COUNT(*) FROM target_courses) AS target_count,
                 (SELECT COUNT(*) FROM target_courses tc JOIN enrollments e ON e.course_id = tc.id
                  WHERE e.student_id = r.student_id AND e.platform = r.platform AND e.status = 'active'
                    AND (e.expires_at IS NULL OR julianday(e.expires_at) > julianday('now'))) AS active_count
          FROM live_code ac CROSS JOIN redemption r
        `).bind(...targetBindings),
      ]);
    } catch (err) {
      // A failed batch rolls back both writes. Never compensate by overwriting live code status.
      logError('code.enrollment_failed', err, { student_id: user.id, code_id: codeRow.id });
      return c.json({ error: { code: 'ENROLLMENT_FAILED', message: 'فشل تفعيل الكورسات. يرجى المحاولة مرة أخرى.' } }, 500);
    }

    const enrolled = results[0].results as { course_id: string; expires_at: string | null }[];
    if (enrolled.length === 0) {
      const diagnostic = results[2].results[0] as {
        status: string; scope_type: string; used_count: number; max_uses: number;
        expired: number; not_started: number; has_profile: number; scope_matches: number;
        target_count: number; active_count: number;
      } | undefined;
      if (!diagnostic) {
        return c.json({ error: { code: 'CODE_NOT_FOUND', message: 'كود التفعيل غير صحيح' } }, 404);
      }
      if (diagnostic.status !== 'active') {
        const msgs: Record<string, string> = {
          used: 'هذا الكود مُستخدم بالفعل',
          expired: 'هذا الكود منتهي الصلاحية',
          revoked: 'هذا الكود ملغي',
        };
        return c.json({ error: { code: 'CODE_INVALID', message: msgs[diagnostic.status] || 'الكود غير صالح' } }, 400);
      }
      if (diagnostic.expired) {
        return c.json({ error: { code: 'CODE_EXPIRED', message: 'كود التفعيل منتهي الصلاحية' } }, 400);
      }
      if (diagnostic.not_started) {
        return c.json({ error: { code: 'CODE_INVALID', message: 'الكود غير صالح' } }, 400);
      }
      if (diagnostic.used_count >= diagnostic.max_uses) {
        return c.json({ error: { code: 'CODE_USED', message: 'هذا الكود تم استخدامه بالكامل' } }, 400);
      }
      if (!diagnostic.has_profile) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'فقط الطلاب يمكنهم تفعيل الأكواد' } }, 403);
      }
      if (!diagnostic.scope_matches) {
        const msgs: Record<string, string> = {
          course: 'هذا الكود مخصص لتفعيل كورس آخر وليس الكورس الحالي',
          bundle: 'هذا الكود مخصص لمجموعة كورسات لا تشمل الكورس الحالي',
          all: 'هذا الكود غير صالح لتفعيل الكورس الحالي',
        };
        return c.json({ error: { code: 'CODE_SCOPE_MISMATCH', message: msgs[diagnostic.scope_type] || 'الكود غير صالح' } }, 400);
      }
      if (diagnostic.target_count === 0) {
        return c.json({ error: { code: 'NO_COURSES', message: 'لا توجد كورسات مرتبطة بهذا الكود' } }, 400);
      }
      if (diagnostic.active_count === diagnostic.target_count) {
        return c.json({ error: { code: 'ALREADY_ENROLLED', message: 'أنت مشترك بالفعل في الكورس أو الكورسات التي يفعلها هذا الكود' } }, 400);
      }
      return c.json({ error: { code: 'CODE_INVALID', message: 'الكود غير صالح' } }, 400);
    }

    const enrollments = enrolled.map(row => row.course_id);
    return c.json({
      ok: true,
      enrolled_courses: enrollments.length,
      course_ids: enrollments,
      expires_at: enrolled[0].expires_at,
      message: `تم تفعيل ${enrollments.length} كورس بنجاح!`,
    });
  }
);

// ── GET /codes/verify/:code — Check code validity without redeeming ──
codes.get('/verify/:code', requireAuth, rateLimit('verify_code', 30, 60), async (c) => {
  const code = normalizeCode(c.req.param('code'));

  const currentPlatform = c.env.PLATFORM_KEY || 'dr-physics';
  const codeRow = await c.env.DB.prepare(
    `SELECT ac.status, ac.scope_type, ac.course_id, ac.used_count, ac.max_uses, ac.expires_at,
            c.title as course_title, cb.access_days
     FROM activation_codes ac
     JOIN code_batches cb ON cb.id = ac.batch_id
     LEFT JOIN courses c ON c.id = ac.course_id
     WHERE ac.code = ? AND ac.platform = ?`
  ).bind(code, currentPlatform).first<any>();

  if (!codeRow) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'كود غير صحيح' } }, 404);
  }

  return c.json({
    valid: codeRow.status === 'active',
    status: codeRow.status,
    scope_type: codeRow.scope_type,
    course_title: codeRow.course_title || (codeRow.scope_type === 'all' ? 'جميع الكورسات' : null),
    access_days: codeRow.access_days,
    remaining_uses: codeRow.max_uses - codeRow.used_count,
    expires_at: codeRow.expires_at,
  });
});

export default codes;

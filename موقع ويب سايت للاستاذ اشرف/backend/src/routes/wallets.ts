import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requireRole } from '../middleware/auth';
import { generateId, generateStudentCode } from '../utils/id';

const wallets = new Hono<HonoBindings>();

// مسارات /admin/* تحتاج تحميل المستخدم أولاً — requireRole وحدها لا تقرأ التوكن.
wallets.use('/admin/*', requireAuth);

const platformOf = (env: { PLATFORM_KEY?: string }) => env.PLATFORM_KEY || 'fusha';

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.9). */
const WALLET_LABELS = {
  section_title: 'محافظ الدفع',
  active_badge: 'نشط',
  transfer_number: 'رقم التحويل',
  empty: 'لا توجد محافظ متاحة حالياً',
} as const;

/** النصوص العربية الحرفية من المواصفات (الوثيقة 23 §3.10). */
const REFERRAL_LABELS = {
  button: 'خليك شريك معانا',
  title: 'خليك شريك معانا',
  code_label: 'كود الشريك',
  description: 'تقدر تبقي شريك وتكسب فلوس او نقاط تاخد بيها امتحانات لو شاركت الكود بتاعك و جه من خلال طلاب',
  whatsapp: 'واتساب',
  facebook: 'فيسبوك',
  register_field: 'كود الإحالة (اختياري)',
  uses: 'عدد التسجيلات بكودك',
  points_earned: 'النقاط المكتسبة',
} as const;

/** يحوّل الأرقام اللاتينية إلى أرقام عربية-هندية للعرض. */
function toArabicDigits(value: string | null | undefined): string {
  if (!value) return '';
  const map: Record<string, string> = {
    '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
    '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
  };
  return value.replace(/[0-9]/g, d => map[d]);
}

// ════════════════════════════════════════════════════════════
// محافظ الدفع
// ════════════════════════════════════════════════════════════

// ── GET /payment-wallets — عرض عام للمحافظ النشطة ──
wallets.get('/payment-wallets', async (c) => {
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, phone, sort_order
     FROM payment_wallets
     WHERE platform = ? AND is_active = 1
     ORDER BY sort_order ASC, created_at ASC`
  ).bind(platform).all<any[]>();

  return c.json({
    payment_wallets: (results as any[]).map(w => ({
      ...w,
      phone_ar: toArabicDigits(w.phone),
      is_active_label: WALLET_LABELS.active_badge,
    })),
    labels: WALLET_LABELS,
  });
});

// ── GET /admin/payment-wallets ──
wallets.get('/admin/payment-wallets', requireRole('admin'), async (c) => {
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM payment_wallets WHERE platform = ? ORDER BY sort_order ASC, created_at ASC'
  ).bind(platform).all();
  return c.json({ payment_wallets: results, labels: WALLET_LABELS });
});

const walletSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(3).max(30),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
});

// ── POST /admin/payment-wallets ──
wallets.post('/admin/payment-wallets', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = walletSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }
  const d = parsed.data;
  const id = generateId();

  await c.env.DB.prepare(
    `INSERT INTO payment_wallets (id, platform, name, phone, is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id,
    platformOf(c.env),
    d.name,
    d.phone,
    d.is_active === false ? 0 : 1,
    d.sort_order ?? 0
  ).run();

  const created = await c.env.DB.prepare('SELECT * FROM payment_wallets WHERE id = ?').bind(id).first();
  return c.json({ ok: true, payment_wallet: created }, 201);
});

// ── PATCH /admin/payment-wallets/:id ──
wallets.patch('/admin/payment-wallets/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM payment_wallets WHERE id = ? AND platform = ?'
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'المحفظة غير موجودة' } }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = walletSchema.partial().safeParse(body);
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

  if (d.name !== undefined) assign('name', d.name);
  if (d.phone !== undefined) assign('phone', d.phone);
  if (d.is_active !== undefined) assign('is_active', d.is_active ? 1 : 0);
  if (d.sort_order !== undefined) assign('sort_order', d.sort_order);

  if (sets.length > 0) {
    sets.push("updated_at = datetime('now')");
    values.push(id);
    await c.env.DB.prepare(`UPDATE payment_wallets SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  const updated = await c.env.DB.prepare('SELECT * FROM payment_wallets WHERE id = ?').bind(id).first();
  return c.json({ ok: true, payment_wallet: updated });
});

// ── DELETE /admin/payment-wallets/:id ──
wallets.delete('/admin/payment-wallets/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const platform = platformOf(c.env);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM payment_wallets WHERE id = ? AND platform = ?'
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'المحفظة غير موجودة' } }, 404);
  }

  await c.env.DB.prepare('DELETE FROM payment_wallets WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// ════════════════════════════════════════════════════════════
// نظام الإحالة
// ════════════════════════════════════════════════════════════

// ── GET /me/referral — كود الشريك + استخداماته ──
wallets.get('/me/referral', requireAuth, async (c) => {
  const user = c.get('user');
  const platform = platformOf(c.env);

  const profile = await c.env.DB.prepare(
    'SELECT student_code FROM profiles WHERE id = ?'
  ).bind(user.id).first<{ student_code: string | null }>();

  // كود الطالب يُنشأ عند أول طلب إحالة إن لم يكن موجوداً (بيانات قديمة).
  let code = profile?.student_code || null;
  if (!code) {
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = generateStudentCode();
      try {
        await c.env.DB.prepare(
          "UPDATE profiles SET student_code = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(candidate, user.id).run();
        code = candidate;
      } catch {
        // تعارض في الكود الفريد — أعد المحاولة
      }
    }
  }

  const { results } = await c.env.DB.prepare(
    `SELECT ru.id, ru.code, ru.points_awarded, ru.created_at, p.full_name AS referred_name
     FROM referral_uses ru
     INNER JOIN profiles p ON p.id = ru.referred_id
     WHERE ru.referrer_id = ? AND ru.platform = ?
     ORDER BY ru.created_at DESC`
  ).bind(user.id, platform).all<any[]>();

  const uses = results as any[];
  const pointsEarned = uses.reduce((sum, u) => sum + (u.points_awarded || 0), 0);

  return c.json({
    partner_code: code,
    uses_count: uses.length,
    points_earned: pointsEarned,
    uses,
    labels: REFERRAL_LABELS,
  });
});

// ── GET /admin/referrals — متابعة الإحالات ──
wallets.get('/admin/referrals', requireRole('admin'), async (c) => {
  const platform = platformOf(c.env);
  const { results } = await c.env.DB.prepare(
    `SELECT ru.*, ref.full_name AS referrer_name, ref.student_code,
            newp.full_name AS referred_name, newp.email AS referred_email
     FROM referral_uses ru
     INNER JOIN profiles ref  ON ref.id = ru.referrer_id
     INNER JOIN profiles newp ON newp.id = ru.referred_id
     WHERE ru.platform = ?
     ORDER BY ru.created_at DESC`
  ).bind(platform).all();

  return c.json({ referrals: results, labels: REFERRAL_LABELS });
});

export default wallets;
export { toArabicDigits, WALLET_LABELS, REFERRAL_LABELS };

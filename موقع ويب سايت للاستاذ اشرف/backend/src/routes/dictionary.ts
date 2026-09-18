import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requirePermission, rateLimit } from '../middleware/auth';
import { generateId, nowISO } from '../utils/id';

const dictionary = new Hono<HonoBindings>();

// ════════════════════════════════════════════════════════════
// التطبيع العربي — Arabic fuzzy normalisation
// حتى يجد الطالب الكلمة وإن أخطأ في التشكيل أو الهمزات أو "ال"
// ════════════════════════════════════════════════════════════

/** التشكيل وعلامات المدّ والتطويل والرموز القرآنية. */
const TASHKEEL = /[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g;
/** علامات الاتجاه ورموز التنسيق التي يضيفها نسخ النص من المصحف. */
const INVISIBLE = /[\u200E\u200F\u061C\uFEFF]/g;

/**
 * يطبّع نصاً عربياً للمقارنة:
 *  - ينزع التشكيل (الفتحة والضمة والكسرة والسكون والشدة والتنوين ومدّ الألف والهمزة فوق/تحت)
 *  - ينزع التطويل "ــــ"
 *  - يوحّد الهمزات: أ إ آ ٱ ٰ ← ا
 *  - ى ← ي
 *  - ة ← ه
 *  - ؤ ← و
 *  - ئ ← ي
 *  - ينزع "ال" التعريف من أول الكلمة
 *  - يضغط المسافات ويقصّ الأطراف
 */
export function normalizeArabic(input: string, stripArticle = true): string {
  if (!input) return '';
  let s = String(input).normalize('NFKC');
  s = s.replace(TASHKEEL, '');
  s = s.replace(INVISIBLE, '');
  s = s.replace(/[\u0622\u0623\u0625\u0671\u0670]/g, 'ا'); // آ أ إ ٱ ٰ ← ا
  s = s.replace(/ى/g, 'ي');          // ى ← ي
  s = s.replace(/ة/g, 'ه');          // ة ← ه
  s = s.replace(/ؤ/g, 'و');          // ؤ ← و
  s = s.replace(/ئ/g, 'ي');          // ئ ← ي
  s = s.replace(/\s+/g, ' ').trim();
  if (stripArticle && s.startsWith('ال') && s.length > 3) {
    s = s.slice(2);
  }
  return s;
}

/** يهرّب رموز LIKE حتى لا تُعامل كأحرف بدل. */
function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** مسافة ليفنشتاين — تُستخدم لاقتراح «هل تقصد…؟». */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

/** يفكّ حقول JSON ويهيّئ الصف للواجهة. */
function shape(row: any): any {
  if (!row) return row;
  const parse = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v as string[];
    try {
      const parsed = JSON.parse(String(v));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  return {
    ...row,
    synonyms: parse(row.synonyms_json),
    antonyms: parse(row.antonyms_json),
    tags: parse(row.tags_json),
  };
}

const entrySchema = z.object({
  word: z.string().min(1).max(120),
  root: z.string().max(20).optional(),
  type: z.enum(['اسم', 'فعل', 'حرف', 'صفة', 'مصدر']).optional(),
  meaning: z.string().min(1).max(2000),
  plural: z.string().max(200).optional(),
  singular: z.string().max(200).optional(),
  synonyms: z.array(z.string().max(120)).max(20).optional(),
  antonyms: z.array(z.string().max(120)).max(20).optional(),
  context: z.string().max(1000).optional(),
  exam_context: z.string().max(200).optional(),
  lesson_id: z.string().max(120).optional(),
  unit: z.string().max(200).optional(),
  audio_url: z.string().max(500).optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
});

// ════════════════════════════════════════════════════════════
// GET /dictionary/suggest?q= — إكمال تلقائي خفيف (8 نتائج)
// ════════════════════════════════════════════════════════════
dictionary.get('/suggest', rateLimit('dictionary_suggest', 120, 60), async (c) => {
  const raw = (c.req.query('q') || '').trim();
  const limit = Math.min(parseInt(c.req.query('limit') || '8'), 20);
  const platform = c.env.PLATFORM_KEY || 'fusha';

  if (raw.length < 1) return c.json({ suggestions: [] });

  const q = normalizeArabic(raw);
  if (!q) return c.json({ suggestions: [] });

  const { results } = await c.env.DB.prepare(
    `SELECT id, word, word_normalized, type, meaning
     FROM dictionary_entries
     WHERE platform = ? AND word_normalized LIKE ?
     ORDER BY search_count DESC, word ASC
     LIMIT ?`
  ).bind(platform, `${likeEscape(q)}%`, limit).all();

  return c.json({ suggestions: (results || []).map(shape) });
});

// ════════════════════════════════════════════════════════════
// GET /dictionary/popular — الأكثر بحثاً
// ════════════════════════════════════════════════════════════
dictionary.get('/popular', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '12'), 50);
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM dictionary_entries
     WHERE platform = ? AND search_count > 0
     ORDER BY search_count DESC, word ASC
     LIMIT ?`
  ).bind(platform, limit).all();

  return c.json({ entries: (results || []).map(shape) });
});

// ════════════════════════════════════════════════════════════
// POST /dictionary/import — استيراد جماعي (upsert) للمعلم
// ════════════════════════════════════════════════════════════
dictionary.post('/import', requireAuth, requirePermission('can_manage_courses'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({ entries: z.array(entrySchema).min(1).max(500) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات الاستيراد غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const platform = c.env.PLATFORM_KEY || 'fusha';
  const now = nowISO();
  const statements = parsed.data.entries.map((e) => {
    const normalized = normalizeArabic(e.word);
    const id = generateId();
    return c.env.DB.prepare(
      `INSERT INTO dictionary_entries
         (id, platform, word, word_normalized, root, type, meaning, plural, singular,
          synonyms_json, antonyms_json, context, exam_context, lesson_id, unit, audio_url,
          difficulty, tags_json, search_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
       ON CONFLICT(platform, word_normalized) DO UPDATE SET
         word = excluded.word,
         word_normalized = excluded.word_normalized,
         root = excluded.root,
         type = excluded.type,
         meaning = excluded.meaning,
         plural = excluded.plural,
         singular = excluded.singular,
         synonyms_json = excluded.synonyms_json,
         antonyms_json = excluded.antonyms_json,
         context = excluded.context,
         exam_context = excluded.exam_context,
         lesson_id = excluded.lesson_id,
         unit = excluded.unit,
         audio_url = excluded.audio_url,
         difficulty = excluded.difficulty,
         tags_json = excluded.tags_json,
         updated_at = excluded.updated_at`
    ).bind(
      id, platform, e.word, normalized, e.root || null, e.type || null, e.meaning,
      e.plural || null, e.singular || null,
      e.synonyms ? JSON.stringify(e.synonyms) : null,
      e.antonyms ? JSON.stringify(e.antonyms) : null,
      e.context || null, e.exam_context || null, e.lesson_id || null, e.unit || null,
      e.audio_url || null, e.difficulty || 2,
      e.tags ? JSON.stringify(e.tags) : null,
      now, now
    );
  });

  await c.env.DB.batch(statements);
  return c.json({ imported: statements.length });
});

// ════════════════════════════════════════════════════════════
// GET /dictionary/word/:word — بحث بالكلمة المطبّعة بالضبط
// ════════════════════════════════════════════════════════════
dictionary.get('/word/:word', async (c) => {
  const raw = c.req.param('word') || '';
  const q = normalizeArabic(decodeURIComponent(raw));
  const platform = c.env.PLATFORM_KEY || 'fusha';

  if (!q) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'يرجى إدخال كلمة صحيحة' } }, 400);
  }

  const row = await c.env.DB.prepare(
    'SELECT * FROM dictionary_entries WHERE platform = ? AND word_normalized = ? LIMIT 1'
  ).bind(platform, q).first();

  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الكلمة غير موجودة في المعجم' } }, 404);
  }

  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE dictionary_entries SET search_count = search_count + 1 WHERE id = ?')
      .bind((row as any).id).run()
  );

  return c.json({ entry: shape(row) });
});

// ════════════════════════════════════════════════════════════
// GET /dictionary?q= — البحث الرئيسي مع التطبيع الضبابي
// ════════════════════════════════════════════════════════════
dictionary.get('/', rateLimit('dictionary_search', 90, 60), async (c) => {
  const raw = (c.req.query('q') || '').trim();
  const page = Math.max(parseInt(c.req.query('page') || '1'), 1);
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = (page - 1) * limit;
  const type = c.req.query('type');
  const tag = c.req.query('tag');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  if (!raw) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'يرجى إدخال كلمة للبحث' } }, 400);
  }

  const q = normalizeArabic(raw);
  if (!q) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'يرجى إدخال كلمة للبحث' } }, 400);
  }

  const escaped = likeEscape(q);
  const contains = `%${escaped}%`;
  const prefix = `${escaped}%`;
  const bareRoot = q.replace(/\s+/g, '');

  const conditions = [
    `word_normalized LIKE ? ESCAPE '\\'`,
    `REPLACE(IFNULL(root, ''), ' ', '') LIKE ? ESCAPE '\\'`,
    `IFNULL(meaning, '') LIKE ? ESCAPE '\\'`,
  ];
  const params: unknown[] = [contains, `%${likeEscape(bareRoot)}%`, contains];

  let extra = '';
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (tag) {
    conditions.push(`IFNULL(tags_json, '') LIKE ? ESCAPE '\\'`);
    params.push(`%${likeEscape(tag)}%`);
  }

  const where = `platform = ? AND (${conditions.join(' OR ')})`;

  const { results } = await c.env.DB.prepare(
    `SELECT *,
       CASE
         WHEN word_normalized = ? THEN 0
         WHEN word_normalized LIKE ? ESCAPE '\\' THEN 1
         ELSE 2
       END AS rank
     FROM dictionary_entries
     WHERE ${where}
     ORDER BY rank ASC, search_count DESC, word ASC
     LIMIT ? OFFSET ?`
  ).bind(q, prefix, platform, ...params, limit, offset).all();

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM dictionary_entries WHERE ${where}`
  ).bind(platform, ...params).first<{ total: number }>();

  let suggestions: { word: string; word_normalized: string }[] = [];
  if (!results || results.length === 0) {
    // لا نتائج → «هل تقصد…؟» بمسافة ليفنشتاين
    const { results: pool } = await c.env.DB.prepare(
      'SELECT id, word, word_normalized FROM dictionary_entries WHERE platform = ? LIMIT 300'
    ).bind(platform).all();

    const maxDistance = q.length >= 4 ? 2 : 1;
    suggestions = (pool || [])
      .map((r: any) => ({ row: r, distance: levenshtein(q, r.word_normalized || '') }))
      .filter((x: any) => x.distance > 0 && x.distance <= maxDistance)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, 5)
      .map((x: any) => ({ word: x.row.word, word_normalized: x.row.word_normalized }));
  }

  return c.json({
    entries: (results || []).map(shape),
    suggestions,
    query: raw,
    normalized: q,
    total: totalRow?.total || 0,
    page,
    limit,
  });
});

// ════════════════════════════════════════════════════════════
// POST /dictionary — إضافة مدخل (المعلم/الإداري)
// ════════════════════════════════════════════════════════════
dictionary.post('/', requireAuth, requirePermission('can_manage_courses'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات الكلمة غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const d = parsed.data;
  const id = generateId();
  const now = nowISO();
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const normalized = normalizeArabic(d.word);

  const duplicate = await c.env.DB.prepare(
    'SELECT id FROM dictionary_entries WHERE platform = ? AND word_normalized = ?'
  ).bind(platform, normalized).first();
  if (duplicate) {
    return c.json({ error: { code: 'DUPLICATE_ENTRY', message: 'هذه الكلمة موجودة بالفعل في المعجم' } }, 409);
  }

  await c.env.DB.prepare(
    `INSERT INTO dictionary_entries
       (id, platform, word, word_normalized, root, type, meaning, plural, singular,
        synonyms_json, antonyms_json, context, exam_context, lesson_id, unit, audio_url,
        difficulty, tags_json, search_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(
    id, platform, d.word, normalized, d.root || null, d.type || null, d.meaning,
    d.plural || null, d.singular || null,
    d.synonyms ? JSON.stringify(d.synonyms) : null,
    d.antonyms ? JSON.stringify(d.antonyms) : null,
    d.context || null, d.exam_context || null, d.lesson_id || null, d.unit || null,
    d.audio_url || null, d.difficulty || 2,
    d.tags ? JSON.stringify(d.tags) : null,
    now, now
  ).run();

  return c.json(await c.env.DB.prepare('SELECT * FROM dictionary_entries WHERE id = ?').bind(id).first().then(shape), 201);
});

// ════════════════════════════════════════════════════════════
// GET /dictionary/:id — مدخل واحد (يزيد عدّاد البحث)
// ════════════════════════════════════════════════════════════
dictionary.get('/:id', async (c) => {
  const id = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const row = await c.env.DB.prepare(
    'SELECT * FROM dictionary_entries WHERE id = ? AND platform = ?'
  ).bind(id, platform).first();

  if (!row) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الكلمة غير موجودة في المعجم' } }, 404);
  }

  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE dictionary_entries SET search_count = search_count + 1, updated_at = ? WHERE id = ?')
      .bind(nowISO(), id).run()
  );

  return c.json({ entry: shape(row) });
});

// ════════════════════════════════════════════════════════════
// PATCH /dictionary/:id — تعديل مدخل
// ════════════════════════════════════════════════════════════
dictionary.patch('/:id', requireAuth, requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';
  const body = await c.req.json().catch(() => null);
  const parsed = entrySchema.partial().safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات التعديل غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM dictionary_entries WHERE id = ? AND platform = ?'
  ).bind(id, platform).first();
  if (!existing) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الكلمة غير موجودة في المعجم' } }, 404);
  }

  const d = parsed.data;
  const sets: string[] = [];
  const params: unknown[] = [];

  if (d.word !== undefined) {
    sets.push('word = ?', 'word_normalized = ?');
    params.push(d.word, normalizeArabic(d.word));
  }
  const direct: [keyof typeof d, string][] = [
    ['root', 'root'], ['type', 'type'], ['meaning', 'meaning'], ['plural', 'plural'],
    ['singular', 'singular'], ['context', 'context'], ['exam_context', 'exam_context'],
    ['lesson_id', 'lesson_id'], ['unit', 'unit'], ['audio_url', 'audio_url'], ['difficulty', 'difficulty'],
  ];
  for (const [key, column] of direct) {
    if (d[key] !== undefined) {
      sets.push(`${column} = ?`);
      params.push(d[key] as unknown);
    }
  }
  if (d.synonyms !== undefined) { sets.push('synonyms_json = ?'); params.push(JSON.stringify(d.synonyms)); }
  if (d.antonyms !== undefined) { sets.push('antonyms_json = ?'); params.push(JSON.stringify(d.antonyms)); }
  if (d.tags !== undefined) { sets.push('tags_json = ?'); params.push(JSON.stringify(d.tags)); }

  if (sets.length === 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'لا توجد بيانات للتعديل' } }, 400);
  }

  sets.push('updated_at = ?');
  params.push(nowISO(), id, platform);

  await c.env.DB.prepare(
    `UPDATE dictionary_entries SET ${sets.join(', ')} WHERE id = ? AND platform = ?`
  ).bind(...params).run();

  return c.json(await c.env.DB.prepare('SELECT * FROM dictionary_entries WHERE id = ?').bind(id).first().then(shape));
});

// ════════════════════════════════════════════════════════════
// DELETE /dictionary/:id — حذف مدخل
// ════════════════════════════════════════════════════════════
dictionary.delete('/:id', requireAuth, requirePermission('can_manage_courses'), async (c) => {
  const id = c.req.param('id');
  const platform = c.env.PLATFORM_KEY || 'fusha';

  const res = await c.env.DB.prepare(
    'DELETE FROM dictionary_entries WHERE id = ? AND platform = ?'
  ).bind(id, platform).run();

  const changes = ((res as any)?.meta?.changes) ?? 1;
  if (changes === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الكلمة غير موجودة في المعجم' } }, 404);
  }

  return c.json({ success: true });
});

export default dictionary;

import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, optionalAuth, requireTrustedDevice, rateLimit, audit } from '../middleware/auth';
import { generateId, nowISO } from '../utils/id';
import { getPresignedUrl } from '../utils/s3';

const playback = new Hono<HonoBindings>();

// In-memory cache to debounce D1 progress updates and avoid Workers KV operations
const lastHeartbeatWrites: Record<string, number> = {};

let lastHeartbeatCleanup = Date.now();
function cleanHeartbeatCache() {
  const now = Date.now();
  if (now - lastHeartbeatCleanup < 60000) return;
  lastHeartbeatCleanup = now;

  for (const key in lastHeartbeatWrites) {
    if (now - lastHeartbeatWrites[key] > 120000) {
      delete lastHeartbeatWrites[key];
    }
  }
}

// ── POST /lessons/:id/playback — Get signed HLS URL ──
playback.post(
  '/lessons/:id/playback',
  optionalAuth,
  rateLimit('playback', 30, 60),
  async (c) => {
    const lessonId = c.req.param('id');
    const user = c.get('user');
    const clientIp = c.get('clientIp') || '';

    const platform = c.env.PLATFORM_KEY || 'dr-physics';
    const lesson = await c.env.DB.prepare(
      `SELECT l.id, l.course_id, l.is_free_preview, 
         COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0) as duration_seconds, 
         c.is_free as course_is_free
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
    ).bind(lessonId, platform).first<any>();

    if (!lesson) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
    }

    const isFree = lesson.is_free_preview === 1 || lesson.course_is_free === 1;

    // Check access (enrollment or free preview)
    if (!isFree) {
      if (!user) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول لمشاهدة هذا الدرس' } }, 401);
      }

      if (user.role === 'student') {
        const enrollment = await c.env.DB.prepare(
          `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
        ).bind(user.id, lesson.course_id).first<any>();

        if (!enrollment) {
          return c.json({ error: { code: 'NOT_ENROLLED', message: 'لم يتم تفعيل الكورس' } }, 403);
        }

        if (enrollment.expires_at && new Date(enrollment.expires_at) < new Date()) {
          return c.json({ error: { code: 'ENROLLMENT_EXPIRED', message: 'انتهت صلاحية اشتراكك' } }, 403);
        }

        // Trust device check (inline requireTrustedDevice logic)
        const deviceId = c.req.header('X-Device-Id');
        if (!deviceId) {
          return c.json({ error: { code: 'DEVICE_ID_MISSING', message: 'معرّف الجهاز مطلوب' } }, 400);
        }

        const device = await c.env.DB.prepare(
          'SELECT id, is_trusted FROM devices WHERE student_id = ? AND device_id = ?'
        ).bind(user.id, deviceId).first<{ id: string; is_trusted: number }>();

        if (!device) {
          const { count } = await c.env.DB.prepare(
            'SELECT COUNT(*) as count FROM devices WHERE student_id = ?'
          ).bind(user.id).first<{ count: number }>() || { count: 0 };

          if (count >= user.maxDevices) {
            return c.json({ error: { code: 'DEVICE_NOT_REGISTERED', message: `تجاوزت الحد المسموح من الأجهزة (${user.maxDevices}). تواصل مع المدرس لتسجيل هذا الجهاز.` } }, 403);
          }

          // SECURITY: mirror requireTrustedDevice — only native mobile platforms are
          // auto-trusted. Web/unknown devices register as untrusted and are rejected
          // until an admin approves them (previously this path auto-trusted ANY new
          // device with a default platform of 'web', defeating device binding).
          const devId = crypto.randomUUID();
          const userAgent = c.req.header('User-Agent') || '';
          const isBrowser = /mozilla|chrome|safari|firefox|edge|opera/i.test(userAgent);
          
          let devPlatform = c.req.header('X-Platform') || 'web';
          if (isBrowser) {
            devPlatform = 'web';
          }
          const devIsNative = devPlatform === 'android' || devPlatform === 'ios';
          const devIsTrusted = devIsNative ? 1 : 0;
          await c.env.DB.prepare(
            `INSERT OR IGNORE INTO devices (id, student_id, device_id, platform, model, push_token, is_trusted, is_rooted, last_login_at, created_at)
             VALUES (?, ?, ?, ?, ?, NULL, ?, 0, datetime('now'), datetime('now'))`
          ).bind(devId, user.id, deviceId, devPlatform, `Auto-registered (${devPlatform})`, devIsTrusted).run();

          if (!devIsTrusted) {
            return c.json({ error: { code: 'DEVICE_NOT_TRUSTED', message: 'تم تسجيل هذا الجهاز ولكنه غير موثّق بعد. تواصل مع الدعم الفني لتفعيل جهازك.' } }, 403);
          }
        } else if (device.is_trusted !== 1) {
          return c.json({ error: { code: 'DEVICE_NOT_TRUSTED', message: 'هذا الجهاز غير موثوق. تواصل مع الدعم الفني لتفعيل جهازك.' } }, 403);
        }
      }
    }

    // Get primary video
    const video = await c.env.DB.prepare(
      `SELECT id, provider, stream_uid, youtube_id, require_drm FROM lesson_videos WHERE lesson_id = ? AND status = 'ready' ORDER BY sort_order ASC LIMIT 1`
    ).bind(lessonId).first<any>();

    if (!video) {
      return c.json({ error: { code: 'VIDEO_NOT_READY', message: 'الفيديو غير جاهز بعد' } }, 404);
    }

    // Get TTL from settings
    const ttlSetting = await c.env.DB.prepare(
      "SELECT value FROM app_settings WHERE key = 'signed_url_ttl_seconds'"
    ).first<{ value: string }>();
    let ttlSeconds = parseInt(ttlSetting?.value || '180');
    if (ttlSeconds > 7200) {
      ttlSeconds = 7200;
    }

    let response: Record<string, unknown>;

    // Generate watermark text based on authentication status
    let watermarkText = 'معاينة مجانية • Free Preview';
    if (user) {
      const userPhone = (await c.env.DB.prepare('SELECT phone FROM profiles WHERE id = ?').bind(user.id).first<{phone: string}>())?.phone || '';
      watermarkText = `${user.fullName} • ${userPhone}`;
    }

    if (video.provider === 'youtube' && video.youtube_id) {
      response = {
        provider: 'youtube',
        playback_url: `https://www.youtube.com/watch?v=${video.youtube_id}`,
        youtube_id: video.youtube_id,
        watermark_text: watermarkText,
        watermark: {
          text: watermarkText,
          mode: 'moving',
          opacity: 0.25,
        },
        policy: { allow_cast: true, allow_pip: true },
      };
    } else if (video.provider === 'r2_hls' && video.stream_uid) {
      const reqUrl = new URL(c.req.url);
      const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '';
      const userAgent = c.req.header('User-Agent') || '';
      const deviceId = c.req.header('X-Device-Id') || 'unknown';
      const tokenTtl = Math.max(7200, (lesson.duration_seconds || 0) + 3600); // 2 hours minimum

      const secret = c.env.SUPABASE_JWT_SECRET;
      if (!secret?.trim()) {
        return c.json({ error: { code: 'CONFIG_ERROR', message: 'SUPABASE_JWT_SECRET must be configured for playback tokens.' } }, 503);
      }
      const payload = {
        scope: 'playback',
        userId: user?.id || 'guest',
        deviceId,
        streamUid: video.stream_uid,
        clientIp,
        userAgent,
        exp: Math.floor(Date.now() / 1000) + tokenTtl
      };

      const playbackToken = await sign(payload, secret);

      // Track active session in KV by deviceId for single active session checks (playlists/keys)
      if (user?.id && c.env.KV) {
        await c.env.KV.put(`active_session:${user.id}`, deviceId, { expirationTtl: tokenTtl });
      }

      const playbackUrl = `${reqUrl.protocol}//${reqUrl.host}/lessons/${lessonId}/video/hls/playlist.m3u8?token=${playbackToken}`;

      response = {
        provider: 'r2_hls',
        playback_url: playbackUrl,
        watermark_text: watermarkText,
        watermark: {
          text: watermarkText,
          mode: 'moving',
          opacity: 0.25,
        },
        policy: { allow_cast: false, allow_pip: false },
      };
    } else if ((video.provider === 'r2' || video.provider === 'server') && video.stream_uid) {
      const signedUrl = await getPresignedUrl(
        c.env,
        c.env.R2_BUCKET_NAME || 'alhadaba-chemistry-files',
        video.stream_uid,
        'video/mp4',
        false,
        'video.mp4',
        ttlSeconds
      );

      response = {
        provider: video.provider,
        playback_url: signedUrl,
        watermark_text: watermarkText,
        watermark: {
          text: watermarkText,
          mode: 'moving',
          opacity: 0.25,
        },
        policy: { allow_cast: false, allow_pip: false },
      };
    } else {
      return c.json({ error: { code: 'VIDEO_NOT_READY', message: 'الفيديو غير متاح' } }, 404);
    }

    // Log playback start only if authenticated
    if (user) {
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, ip, meta_json, created_at)
           VALUES (?, ?, 'playback.start', 'lesson', ?, ?, ?, datetime('now'))`
        ).bind(
          generateId(), user.id, lessonId, clientIp,
          JSON.stringify({ device_id: c.req.header('X-Device-Id'), video_provider: video.provider })
        ).run()
      );
    }

    // Fetch last position from progress
    let lastPosition = 0;
    if (user) {
      const progress = await c.env.DB.prepare(
        'SELECT last_position FROM lesson_progress WHERE student_id = ? AND lesson_id = ?'
      ).bind(user.id, lessonId).first<{ last_position: number }>();
      lastPosition = progress?.last_position || 0;
    }
    response.last_position = lastPosition;

    return c.json(response);
  }
);

// ── POST /playback/heartbeat — Periodic heartbeat during playback ──
playback.post('/playback/heartbeat', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  const heartbeatSchema = z.object({
    lesson_id: z.string().min(1),
    position: z.number().nonnegative(),
    watched_seconds: z.number().nonnegative().optional(),
  });

  const parsed = heartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const { lesson_id: lessonId, position: rawPosition } = parsed.data;
  const position = Math.max(0, Math.floor(rawPosition));

  // Debounce FIRST — before any D1 reads. Clients send heartbeats every 15s but
  // we only persist once per 60s per student+lesson, so 3 out of 4 heartbeats
  // used to burn 2 D1 queries (lesson + enrollment) just to return "debounced".
  // A debounce hit implies a successful, fully-authorized write happened <60s
  // ago in this isolate, so skipping re-verification here is safe.
  cleanHeartbeatCache();
  const debounceKey = `heartbeat:${user.id}:${lessonId}`;
  const lastWrite = lastHeartbeatWrites[debounceKey];
  const now = Date.now();

  if (lastWrite && (now - lastWrite) < 60_000) {
    return c.json({ ok: true, debounced: true });
  }

  // Get lesson info and verify enrollment/access
  const platform = c.env.PLATFORM_KEY || 'dr-physics';
  const lesson = await c.env.DB.prepare(
    `SELECT l.course_id, 
       COALESCE(l.duration_seconds, (SELECT MAX(duration_seconds) FROM lesson_videos WHERE lesson_id = l.id), 0) as duration_seconds, 
       l.is_free_preview, c.is_free as course_is_free
     FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
  ).bind(lessonId, platform).first<{ course_id: string; duration_seconds: number | null; is_free_preview: number; course_is_free: number }>();

  if (!lesson) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
  }

  if (user.role === 'student' && !lesson.is_free_preview && lesson.course_is_free !== 1) {
    const enrollment = await c.env.DB.prepare(
      `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
    ).bind(user.id, lesson.course_id).first<any>();

    if (!enrollment) {
      return c.json({ error: { code: 'NOT_ENROLLED', message: 'لم يتم تفعيل الكورس' } }, 403);
    }

    if (enrollment.expires_at && new Date(enrollment.expires_at) < new Date()) {
      return c.json({ error: { code: 'ENROLLMENT_EXPIRED', message: 'انتهت صلاحية اشتراكك' } }, 403);
    }
  }

  // Get existing progress watched seconds
  const prevProgress = await c.env.DB.prepare(
    'SELECT watched_seconds FROM lesson_progress WHERE student_id = ? AND lesson_id = ?'
  ).bind(user.id, lessonId).first<{ watched_seconds: number }>();
  const prevWatched = prevProgress?.watched_seconds || 0;

  // Determine increment delta
  let delta = 0;
  if (body.watched_seconds !== undefined) {
    delta = Math.max(0, Math.floor(body.watched_seconds));
  } else {
    // Fallback: calculate delta from client watched position relative to prev progress
    const clientWatched = Math.max(0, Math.floor(position));
    delta = clientWatched - prevWatched;
  }

  // Determine max allowed increment delta (heartbeat interval/elapsed time + buffer)
  let maxDelta = 60;
  if (lastWrite) {
    const elapsedSeconds = Math.ceil((now - lastWrite) / 1000);
    maxDelta = Math.max(60, elapsedSeconds + 15);
  } else {
    maxDelta = Math.max(60, position + 15);
  }

  // Clamp delta
  if (delta < 0) {
    delta = 0;
  }
  if (delta > maxDelta) {
    delta = maxDelta;
  }

  let finalWatched = prevWatched + delta;

  // Determine if completed (watched >= 90% of duration)
  const duration = lesson.duration_seconds || 0;
  if (duration > 0 && finalWatched > duration) {
    finalWatched = duration;
  }

  const isCompleted = duration > 0 && position >= duration * 0.9 ? 1 : 0;

  // Upsert lesson_progress
  await c.env.DB.prepare(
    `INSERT INTO lesson_progress (id, student_id, lesson_id, course_id, watched_seconds, last_position, highest_position_watched, is_completed, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(student_id, lesson_id) DO UPDATE SET
       watched_seconds = MAX(lesson_progress.watched_seconds, excluded.watched_seconds),
       last_position = excluded.last_position,
       highest_position_watched = MAX(lesson_progress.highest_position_watched, excluded.highest_position_watched),
       is_completed = MAX(lesson_progress.is_completed, excluded.is_completed),
       completed_at = CASE WHEN excluded.is_completed = 1 AND lesson_progress.completed_at IS NULL THEN datetime('now') ELSE lesson_progress.completed_at END,
       updated_at = datetime('now')`
  ).bind(
    generateId(), user.id, lessonId, lesson.course_id,
    finalWatched, position, position,
    isCompleted, isCompleted ? nowISO() : null
  ).run();

  // Mark debounce in-memory
  lastHeartbeatWrites[debounceKey] = now;

  return c.json({ ok: true, is_completed: isCompleted === 1 });
});

// ── GET /lessons/:id/files/:fileId/url — Get signed R2 URL for file ──
playback.get('/lessons/:id/files/:fileId/url', optionalAuth, async (c) => {
  const lessonId = c.req.param('id');
  const fileId = c.req.param('fileId');
  const user = c.get('user');

  // Load lesson details
  const platform = c.env.PLATFORM_KEY || 'dr-physics';
  const lesson = await c.env.DB.prepare(
    `SELECT l.id, l.course_id, l.is_free_preview, c.is_free as course_is_free
     FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
  ).bind(lessonId, platform).first<any>();

  if (!lesson) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
  }

  const isFree = lesson.is_free_preview === 1 || lesson.course_is_free === 1;

  // Enforce access control: allow if staff OR if the lesson is a free preview
  if (!isFree) {
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'يجب تسجيل الدخول لتحميل هذا الملف' } }, 401);
    }

    if (user.role === 'student') {
      const enrollment = await c.env.DB.prepare(
        `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, lesson.course_id).first<any>();

      if (!enrollment) {
        return c.json({ error: { code: 'NOT_ENROLLED', message: 'لم يتم تفعيل الكورس' } }, 403);
      }

      if (enrollment.expires_at && new Date(enrollment.expires_at) < new Date()) {
        return c.json({ error: { code: 'ENROLLMENT_EXPIRED', message: 'انتهت صلاحية اشتراكك' } }, 403);
      }
    }
  }

  const file = await c.env.DB.prepare(
    'SELECT id, r2_key, mime_type, title, is_downloadable FROM lesson_files WHERE id = ? AND lesson_id = ?'
  ).bind(fileId, lessonId).first<any>();

  if (!file) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الملف غير موجود' } }, 404);
  }

  // Get the file from R2 and return a temporary URL
  try {
    const presignedUrl = await getPresignedUrl(
      c.env,
      c.env.R2_BUCKET_NAME || 'alhadaba-chemistry-files', // R2 bucket name
      file.r2_key,
      file.mime_type,
      file.is_downloadable === 1,
      file.title,
      3600 // 1 hour expiry
    );
    return c.redirect(presignedUrl, 302);
  } catch (err) {
    console.warn('[R2_PRESIGN_FALLBACK] Failed to generate presigned URL, falling back to direct stream:', err);

    const object = await c.env.R2.get(file.r2_key);
    if (!object) {
      return c.json({ error: { code: 'FILE_MISSING', message: 'الملف غير متوفر في التخزين' } }, 404);
    }

    const safeFilename = file.title.replace(/[\r\n"]/g, '_');
    return new Response(object.body, {
      headers: {
        'Content-Type': file.mime_type,
        'Content-Disposition': file.is_downloadable === 1 ? `attachment; filename="${safeFilename}"` : 'inline',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Watermark': file.watermark ? (user ? `${user.fullName}` : 'معاينة مجانية') : '',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
});

// ── POST /lessons/:id/playback/logs — Log open/close playback events ──
playback.post(
  '/lessons/:id/playback/logs',
  requireAuth,
  rateLimit('playback_logs', 30, 60),
  async (c) => {
    const lessonId = c.req.param('id');
    const user = c.get('user');
    const body = await c.req.json() as {
      action: 'open' | 'close';
      position_seconds: number;
    };

    if (!body.action || body.position_seconds === undefined) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'بيانات ناقصة' } }, 400);
    }

    if (body.action !== 'open' && body.action !== 'close') {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'إجراء غير صحيح' } }, 400);
    }

    // Get lesson details and verify enrollment/access
    const platform = c.env.PLATFORM_KEY || 'dr-physics';
    const lesson = await c.env.DB.prepare(
      `SELECT l.course_id, l.is_free_preview, c.is_free as course_is_free
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
    ).bind(lessonId, platform).first<{ course_id: string; is_free_preview: number; course_is_free: number }>();

    if (!lesson) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
    }

    if (user.role === 'student' && !lesson.is_free_preview && lesson.course_is_free !== 1) {
      const enrollment = await c.env.DB.prepare(
        `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
      ).bind(user.id, lesson.course_id).first<any>();

      if (!enrollment) {
        return c.json({ error: { code: 'NOT_ENROLLED', message: 'لم يتم تفعيل الكورس' } }, 403);
      }

      if (enrollment.expires_at && new Date(enrollment.expires_at) < new Date()) {
        return c.json({ error: { code: 'ENROLLMENT_EXPIRED', message: 'انتهت صلاحية اشتراكك' } }, 403);
      }
    }

    const id = generateId();
    await c.env.DB.prepare(
      `INSERT INTO lecture_playback_logs (id, student_id, lesson_id, action, position_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(id, user.id, lessonId, body.action, Math.floor(body.position_seconds)).run();

    if (body.action === 'close') {
      await c.env.DB.prepare(
        `INSERT INTO lesson_progress (id, student_id, lesson_id, course_id, last_position, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(student_id, lesson_id) DO UPDATE SET 
           last_position = excluded.last_position,
           updated_at = datetime('now')`
      ).bind(`lp_${user.id}_${lessonId}`, user.id, lessonId, lesson.course_id, Math.floor(body.position_seconds)).run();
    }

    return c.json({ ok: true });
  }
);

// ── GET /lessons/:id/video/hls/* — Serve secure HLS files from R2 ──
playback.get('/lessons/:id/video/hls/:file{.*}', async (c) => {
  const lessonId = c.req.param('id');
  const filePath = c.req.param('file');

  let token = c.req.query('token');
  if (!token) {
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  const platform = c.env.PLATFORM_KEY || 'dr-physics';
  const lesson = await c.env.DB.prepare(
    `SELECT l.course_id, l.is_free_preview, c.is_free as course_is_free
     FROM lessons l
     JOIN courses c ON l.course_id = c.id
     WHERE l.id = ? AND l.is_archived = 0 AND l.is_published = 1 AND c.platform = ?`
  ).bind(lessonId, platform).first<{ course_id: string; is_free_preview: number; course_is_free: number }>();

  if (!lesson) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الدرس غير موجود' } }, 404);
  }

  const isFree = lesson.is_free_preview === 1 || lesson.course_is_free === 1;
  let streamUid = '';

  if (isFree) {
    const video = await c.env.DB.prepare(
      `SELECT id, stream_uid FROM lesson_videos WHERE lesson_id = ? AND provider = 'r2_hls' AND status = 'ready' LIMIT 1`
    ).bind(lessonId).first<any>();

    if (!video || !video.stream_uid) {
      return c.json({ error: { code: 'VIDEO_NOT_READY', message: 'الفيديو غير متاح' } }, 404);
    }
    streamUid = video.stream_uid;
  } else {
    if (!token) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'توكن المصادقة مفقود' } }, 401);
    }

    // Fast path for playback token: skip D1 queries entirely
    const isOpaqueToken = token.startsWith('pb_') || !token.includes('.');
    if (isOpaqueToken && c.env.KV) {
      const cached = await c.env.KV.get(`playback_token:${token}`);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          
          // 1. IP & User-Agent Session Binding Check
          const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '';
          const userAgent = c.req.header('User-Agent') || '';
          
          if (data.clientIp && data.clientIp !== clientIp) {
            return c.json({ error: { code: 'UNAUTHORIZED', message: 'تغيير غير مصرح به لعنوان الجلسة (IP)' } }, 403);
          }
          if (data.userAgent && data.userAgent !== userAgent) {
            return c.json({ error: { code: 'UNAUTHORIZED', message: 'تغيير غير مصرح به لبيانات المتصفح' } }, 403);
          }

          // 2. Single Active Session Check (Only for playlists & keys - skip for segment requests)
          const isSegment = filePath.endsWith('.ts') || filePath.endsWith('.m4s') || filePath.endsWith('.mp4');
          if (!isSegment && data.userId && data.userId !== 'guest') {
            const activeToken = await c.env.KV.get(`active_session:${data.userId}`);
            if (activeToken && activeToken !== token) {
              return c.json({ error: { code: 'SESSION_KICKED', message: 'تم بدء المشاهدة من جهاز آخر، تم تسجيل خروجك.' } }, 403);
            }
          }

          streamUid = data.streamUid || '';
        } catch (e) {
          // ignore
        }
      }
    } else if (!isOpaqueToken) {
      const secret = c.env.SUPABASE_JWT_SECRET;
      if (!secret?.trim()) {
        return c.json({ error: { code: 'CONFIG_ERROR', message: 'SUPABASE_JWT_SECRET must be configured for playback tokens.' } }, 503);
      }
      try {
        const data = await verify(token, secret, 'HS256') as any;
        
        // 1. IP & User-Agent Session Binding Check
        const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '';
        const userAgent = c.req.header('User-Agent') || '';

        if (data.clientIp && data.clientIp !== clientIp) {
          console.warn('[Playback DBG] IP Mismatch! Token:', data.clientIp, 'Request:', clientIp);
          return c.json({ error: { code: 'UNAUTHORIZED', message: 'تغيير غير مصرح به لعنوان الجلسة (IP)' } }, 403);
        }
        if (data.userAgent && data.userAgent !== userAgent) {
          console.warn('[Playback DBG] UA Mismatch! Token:', data.userAgent, 'Request:', userAgent);
          return c.json({ error: { code: 'UNAUTHORIZED', message: 'تغيير غير مصرح به لبيانات المتصفح' } }, 403);
        }

        // 2. Single Active Session Check (Only for playlists & keys - skip for segment requests)
        const isSegment = filePath.endsWith('.ts') || filePath.endsWith('.m4s') || filePath.endsWith('.mp4');
        if (!isSegment && data.userId && data.userId !== 'guest' && c.env.KV) {
          const activeDevice = await c.env.KV.get(`active_session:${data.userId}`);
          if (activeDevice && data.deviceId && activeDevice !== data.deviceId) {
            console.warn('[Playback DBG] Session kicked! KV active:', activeDevice, 'Token device:', data.deviceId);
            return c.json({ error: { code: 'SESSION_KICKED', message: 'تم بدء المشاهدة من جهاز آخر، تم تسجيل خروجك.' } }, 403);
          }
        }

        streamUid = data.streamUid || '';
      } catch (e: any) {
        console.error('[Playback DBG] JWT Verify Error:', e.message || e);
      }
    }

    // Fallback if not verified
    if (!streamUid) {
      let authenticated = false;
      const authResponse = await requireAuth(c, async () => {
        authenticated = true;
      });

      // Direct middleware invocation must propagate its returned denial response.
      if (!authenticated) return authResponse;

      const user = c.get('user');

      if (user.role === 'student' && lesson.course_is_free !== 1) {
        const enrollment = await c.env.DB.prepare(
          `SELECT id, expires_at FROM enrollments WHERE student_id = ? AND course_id = ? AND status = 'active'`
        ).bind(user.id, lesson.course_id).first<any>();

        if (!enrollment) {
          return c.json({ error: { code: 'NOT_ENROLLED', message: 'لم يتم تفعيل الكورس' } }, 403);
        }

        if (enrollment.expires_at && new Date(enrollment.expires_at) < new Date()) {
          return c.json({ error: { code: 'ENROLLMENT_EXPIRED', message: 'انتهت صلاحية اشتراكك' } }, 403);
        }
      }

      // Get the video info for this lesson
      const video = await c.env.DB.prepare(
        `SELECT id, stream_uid FROM lesson_videos WHERE lesson_id = ? AND provider = 'r2_hls' AND status = 'ready' LIMIT 1`
      ).bind(lessonId).first<any>();

      if (!video || !video.stream_uid) {
        return c.json({ error: { code: 'VIDEO_NOT_READY', message: 'الفيديو غير متاح' } }, 404);
      }

      streamUid = video.stream_uid;
    }
  }

  if (!streamUid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'غير مصرح لك بمشاهدة هذا الفيديو' } }, 401);
  }

  // ── Intercept Decryption Key Requests ──
  const isKeyRequest = filePath.endsWith('/key') || filePath === 'key';
  if (isKeyRequest) {
    // SECURITY: the AES decryption key must ALWAYS be bound to a server-issued
    // playback session token — including free-preview lessons. Previously the free
    // path served the key with no token at all (and rate limiting only applied when
    // a token happened to be present), so the key could be scraped anonymously and
    // reused to decrypt the whole stream. POST /lessons/:id/playback issues a pb_
    // session token to every caller (guests included), so requiring one here does
    // not break the legitimate client flow.
    if (!token) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'مفتاح التشفير يتطلب جلسة تشغيل صالحة' } }, 401);
    }

    let session: { streamUid?: string; userId?: string } = {};
    const isOpaqueToken = token.startsWith('pb_') || !token.includes('.');

    if (isOpaqueToken) {
      const sessionRaw = c.env.KV ? await c.env.KV.get(`playback_token:${token}`) : null;
      if (!sessionRaw) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'جلسة التشغيل غير صالحة أو منتهية' } }, 403);
      }
      try {
        session = JSON.parse(sessionRaw);
      } catch {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'جلسة التشغيل غير صالحة' } }, 403);
      }
    } else {
      const secret = c.env.SUPABASE_JWT_SECRET;
      if (!secret?.trim()) {
        return c.json({ error: { code: 'CONFIG_ERROR', message: 'SUPABASE_JWT_SECRET must be configured for playback tokens.' } }, 503);
      }
      try {
        session = await verify(token, secret, 'HS256') as any;
      } catch (e: any) {
        console.error('[Playback DBG] Key verify JWT error:', e.message || e);
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'جلسة التشغيل غير صالحة أو منتهية' } }, 403);
      }
    }

    // The token must have been minted for THIS video — a token issued for one
    // (e.g. free) lesson cannot be replayed to fetch another lesson's key.
    if (!session.streamUid || session.streamUid !== streamUid) {
      console.warn('[Playback DBG] Key Request - Forbidden! Stream Uid mismatch.');
      return c.json({ error: { code: 'FORBIDDEN', message: 'جلسة التشغيل لا تخص هذا الدرس' } }, 403);
    }

    const parts = streamUid.split('/');
    const videoId = parts[3]; // Format: lessons/lessonId/videos/videoId/hls

    if (!videoId) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'الفيديو غير موجود' } }, 404);
    }

    // Fetch the AES key from KV
    const keyHex = await c.env.KV.get(`video_aes_key:${videoId}`);
    if (!keyHex) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'مفتاح التشفير غير متوفر' } }, 404);
    }

    // Rate limit key requests to prevent scraping keys (token is always present here)
    const tokenSignature = token.split('.').pop() || token;
    const keyRateKey = `rate_limit:key:${tokenSignature}`;
    const countStr = await c.env.KV.get(keyRateKey);
    const count = countStr ? parseInt(countStr) : 0;
    if (count > 3) { // Max 3 key fetches per token session
      console.warn('[Playback DBG] Key Rate Limit Exceeded!');
      if (token.startsWith('pb_')) {
        await c.env.KV.delete(`playback_token:${token}`);
      }
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'تم تجاوز عدد محاولات جلب مفتاح التشفير' } }, 403);
    }
    await c.env.KV.put(keyRateKey, (count + 1).toString(), { expirationTtl: 3600 });

    // Convert hex key back to Uint8Array buffer
    const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    return new Response(keyBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  // The stream_uid is the R2 prefix/path of the folder containing the HLS files.
  // For example: "lessons/lessonId/videos/videoId/hls"
  // So the full R2 key would be: `${streamUid}/${filePath}`
  const r2Key = `${streamUid}/${filePath}`;

  // 2. Fetch the file from R2 (try R2_VIDEO first, then fallback to R2 for old uploads)
  let isFromVideoBucket = false;
  let r2Object: R2ObjectBody | null = null;
  
  if (c.env.R2_VIDEO) {
    r2Object = await c.env.R2_VIDEO.get(r2Key);
    if (r2Object) {
      isFromVideoBucket = true;
    }
  }
  
  if (!r2Object) {
    r2Object = await c.env.R2.get(r2Key);
  }

  if (!r2Object) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الملف غير موجود' } }, 404);
  }

  // 3. Set content type based on file extension
  let contentType = 'application/octet-stream';
  if (filePath.endsWith('.m3u8')) {
    contentType = 'application/x-mpegURL';
  } else if (filePath.endsWith('.ts')) {
    contentType = 'video/MP2T';
  } else if (filePath.endsWith('.m4s')) {
    contentType = 'video/iso.segment';
  } else if (filePath.endsWith('.mp4')) {
    contentType = 'video/mp4';
  }

  const headers = new Headers();
  headers.set('Content-Type', contentType);

  if (filePath.endsWith('.m3u8')) {
    // Playlist files: do not cache aggressively, but clean up and rewrite token paths
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    if (token) {
      const videoCdnHost = c.env.VIDEO_CDN_HOST;
      const text = await r2Object.text();

      // Relative paths inside a playlist resolve against the playlist's own
      // directory. For a quality playlist (filePath = "480p/video.m3u8") a
      // segment line like "video0.ts" lives at "<streamUid>/480p/video0.ts" —
      // rewriting it against streamUid alone drops the quality folder and 404s.
      const playlistDir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/') + 1) : '';

      const lines = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // 1. Handle URI="path" (e.g. #EXT-X-KEY:URI="key" or #EXT-X-MAP:URI="init.mp4")
        if (trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/g, (match, p1) => {
            const isKey = p1 === 'key' || p1.startsWith('key?') || p1.endsWith('/key');
            if (isKey) {
              const separator = p1.includes('?') ? '&' : '?';
              return `URI="${p1}${separator}token=${token}"`;
            }
            
            // Rewrite init segments (.mp4, etc.) to CDN if host is configured AND video is in new bucket
            if (videoCdnHost && isFromVideoBucket) {
              return `URI="https://${videoCdnHost}/${streamUid}/${playlistDir}${p1}"`;
            }
            
            const separator = p1.includes('?') ? '&' : '?';
            return `URI="${p1}${separator}token=${token}"`;
          });
        }

        // 2. Handle normal relative path lines (segments or child playlists)
        if (!trimmed.startsWith('#')) {
          const isPlaylist = trimmed.endsWith('.m3u8') || trimmed.includes('.m3u8?');
          if (isPlaylist) {
            // Child playlists must be served through the Worker with the token
            const separator = trimmed.includes('?') ? '&' : '?';
            return `${trimmed}${separator}token=${token}`;
          }
          
          // Video segments (.ts, .m4s) -> redirect directly to CDN if configured AND video is in new bucket
          if (videoCdnHost && isFromVideoBucket) {
            return `https://${videoCdnHost}/${streamUid}/${playlistDir}${trimmed}`;
          }
          
          const separator = trimmed.includes('?') ? '&' : '?';
          return `${trimmed}${separator}token=${token}`;
        }

        return line;
      });

      return c.text(lines.join('\n'), 200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
    }
  } else {
    // Video segments (.ts): cache aggressively at the CDN edge for 1 year
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  return new Response(r2Object.body, {
    status: 200,
    headers,
  });
});

export default playback;

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie } from 'hono/cookie';
import type { HonoBindings, Env, NotificationMessage } from './types';
import { handleNotificationQueue } from './queues/notificationConsumer';
import { requireAuth, requireRole } from './middleware/auth';

import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import playbackRoutes from './routes/playback';
import codeRoutes from './routes/codes';
import questionRoutes from './routes/questions';
import adminRoutes from './routes/admin';
import bunnyRoutes from './routes/bunny';
import pushRoutes from './routes/push';
import questionBankRoutes from './routes/questionBank';
import dictionaryRoutes from './routes/dictionary';
import parentRoutes from './routes/parent';
import bundleRoutes from './routes/bundles';
import newsRoutes from './routes/news';
import purchaseRoutes from './routes/purchases';
import examBuildRoutes from './routes/examBuilds';
import mistakeRoutes from './routes/mistakes';
import pointRoutes from './routes/points';
import walletRoutes from './routes/wallets';
import challengeRoutes from './routes/challenges';
import conversationRoutes from './routes/conversations';
import configRoutes from './routes/config';
import { handleVideoTransferQueue } from './queues/videoTransferConsumer';
import { verifyDirectUploadSignature } from './utils/s3';

const app = new Hono<HonoBindings>({ strict: false });

function isOriginAllowed(origin: string, env: Env): boolean {
  if (!origin) return false;
  const allowed = env.CORS_ORIGIN || '';
  const origins = allowed.split(',').map(o => o.trim());
  const isAllowedSubdomain = 
    origin === 'https://fusha-student-web.pages.dev' ||
    origin === 'https://fusha-dashboard.pages.dev' ||
    origin.endsWith('.fusha-student-web.pages.dev') ||
    origin.endsWith('.fusha-dashboard.pages.dev') ||
    origin === 'https://fusha.site' ||
    origin === 'https://www.fusha.site' ||
    origin === 'https://dashboard.fusha.site' ||
    origin === 'https://mansah-tollabiah.pages.dev' ||
    origin === 'https://mowqe-al-modares.pages.dev' ||
    origin.endsWith('.mansah-tollabiah.pages.dev') ||
    origin.endsWith('.mowqe-al-modares.pages.dev') ||
    (env.ENVIRONMENT !== 'production' && (
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:')
    ));
  return origins.includes(origin) || isAllowedSubdomain;
}

// ── Global CORS ──
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowed = c.env.CORS_ORIGIN;
  
  if (!allowed) {
    console.error('[SECURITY] CORS_ORIGIN is not configured. Request blocked.');
    return c.json({ error: { code: 'SERVER_ERROR', message: 'CORS configuration missing' } }, 500);
  }
  
  let allowOrigin: string | null = null;
  let credentials = false;

  if (isOriginAllowed(origin, c.env)) {
    allowOrigin = origin;
    credentials = true;
  }
  
  if (!allowOrigin) {
    await next();
    return;
  }
  
  const corsMiddleware = cors({
    origin: allowOrigin,
    // X-Signature / X-Timestamp / X-Nonce retained for backwards compatibility with
    // older mobile clients still sending them; the middleware that consumed them has
    // been removed (request signing was broken: the secret shipped in the web client
    // bundle and the server failed open when it was unset). Our own HS256 access
    // tokens (AUTH_SECRET) are the sole request-authenticity mechanism now.
    allowHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-App-Version', 'X-Platform', 'X-Requested-With', 'X-CSRF-Token', 'x-csrf-token', 'X-Signature', 'X-Timestamp', 'X-Nonce'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['X-Request-Id'],
    maxAge: 86400,
    credentials,
  });
  
  return corsMiddleware(c, next);
});

// ── Request ID ──
app.use('*', async (c, next) => {
  const requestId = crypto.randomUUID();
  c.header('X-Request-Id', requestId);
  await next();
});

// ── Global CSRF Guard ──
app.use('*', async (c, next) => {
  // Set CSRF cookie if not present
  const existingToken = getCookie(c, 'csrf_token');
  if (!existingToken) {
    const token = crypto.randomUUID();
    setCookie(c, 'csrf_token', token, {
      path: '/',
      secure: true,
      sameSite: 'Lax',
      httpOnly: false, // Must be readable by client JS
      maxAge: 365 * 24 * 60 * 60,
    });
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    const path = c.req.path;
    if (!path.startsWith('/webhooks') && !path.startsWith('/uploads/')) {
      const requestedWith = c.req.header('X-Requested-With')?.toLowerCase();
      const platform = c.req.header('X-Platform')?.toLowerCase();
      const origin = c.req.header('Origin') || '';
      
      const isXmlHttpRequest = requestedWith === 'xmlhttprequest';
      const isMobileOrValidPlatform = ['web', 'android', 'ios'].includes(platform || '');
      const isPublicAuthPath =
        path.startsWith('/auth/login') ||
        path.startsWith('/auth/register') ||
        path.startsWith('/auth/refresh') ||
        path.startsWith('/auth/forgot-password') ||
        path.startsWith('/auth/reset-password');
      const hasAuthHeader = !!c.req.header('Authorization');
      const isAllowedOrigin = isOriginAllowed(origin, c.env);

      if (!isXmlHttpRequest && !(isMobileOrValidPlatform && (isPublicAuthPath || hasAuthHeader)) && !(isPublicAuthPath && isAllowedOrigin)) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'طلب غير مصرح به (CSRF Guard)' } }, 403);
      }

      // Double-submit cookie verification for web clients
      // SECURITY: If the request contains a custom Authorization header, it is immune
      // to CSRF (since browser credentials/cookies are not used for auth and malicious 
      // cross-origin sites cannot read or attach custom headers like Authorization).
      const isWeb = platform === 'web' || !!origin;
      if (isWeb && !hasAuthHeader && !isXmlHttpRequest && !isPublicAuthPath) {
        const csrfCookie = getCookie(c, 'csrf_token') || existingToken;
        const csrfHeader = c.req.header('X-CSRF-Token');
        if (!csrfCookie || csrfCookie !== csrfHeader) {
          return c.json({ error: { code: 'CSRF_ERROR', message: 'رمز الحماية ضد الثغرات (CSRF) غير صالح أو منتهي الصلاحية' } }, 403);
        }
      }
    }
  }
  await next();
});

// ── Global Security Headers ──
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  c.header('Cross-Origin-Opener-Policy', 'same-origin');
  c.header('Cross-Origin-Resource-Policy', 'cross-origin');
});

// ── Health Check ──
app.get('/', (c) => c.json({
  name: 'Fusha API',
  version: '1.0.0',
  status: 'healthy',
  timestamp: new Date().toISOString(),
}));

app.get('/health', (c) => c.json({ ok: true }));

app.get('/health/providers', requireAuth, requireRole('admin'), (c) => {
  return c.json({
    bunny_stream: {
      configured: !!(c.env.BUNNY_LIBRARY_ID && c.env.BUNNY_API_KEY),
    }
  });
});

// ── Public: serve student avatars from R2 ──
app.get('/files/avatars/:id', async (c) => {
  const obj = await c.env.R2.get(`avatars/${c.req.param('id')}`);
  if (!obj) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الصورة غير موجودة' } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=300');
  headers.set('X-Content-Type-Options', 'nosniff');
  
  const storedType = obj.httpMetadata?.contentType || 'image/jpeg';
  const safeType = ['image/jpeg', 'image/png', 'image/webp'].includes(storedType) ? storedType : 'image/jpeg';
  headers.set('Content-Type', safeType);
  headers.set('Content-Disposition', 'inline');
  
  return new Response(obj.body, { headers });
});

// ── Public: serve course cover images from R2 ──
app.get('/files/covers/:id', async (c) => {
  const obj = await c.env.R2.get(`covers/${c.req.param('id')}`);
  if (!obj) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الصورة غير موجودة' } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400'); // 1 day cache
  headers.set('X-Content-Type-Options', 'nosniff');
  
  const storedType = obj.httpMetadata?.contentType || 'image/jpeg';
  const safeType = ['image/jpeg', 'image/png', 'image/webp'].includes(storedType) ? storedType : 'image/jpeg';
  headers.set('Content-Type', safeType);
  headers.set('Content-Disposition', 'inline');
  
  return new Response(obj.body, { headers });
});

// ── Public: serve quiz question images from R2 ──
app.get('/files/questions/:id', async (c) => {
  const obj = await c.env.R2.get(`questions/${c.req.param('id')}`);
  if (!obj) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الصورة غير موجودة' } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'public, max-age=86400'); // 1 day cache
  headers.set('X-Content-Type-Options', 'nosniff');
  
  const storedType = obj.httpMetadata?.contentType || 'image/jpeg';
  const safeType = ['image/jpeg', 'image/png', 'image/webp'].includes(storedType) ? storedType : 'image/jpeg';
  headers.set('Content-Type', safeType);
  headers.set('Content-Disposition', 'inline');
  
  return new Response(obj.body, { headers });
});

// ── Public: serve student app APK from R2 ──
app.get('/files/apk', async (c) => {
  const obj = await c.env.R2.get('apk/fusha.apk');
  if (!obj) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الملف غير موجود' } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Content-Type', 'application/vnd.android.package-archive');
  headers.set('Content-Disposition', 'attachment; filename="fusha.apk"');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(obj.body, { headers });
});

// ── Public: serve conversation voice messages from R2 ──
app.get('/files/voice/:id', async (c) => {
  const obj = await c.env.R2.get(`voice/${c.req.param('id')}`);
  if (!obj) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الملف غير موجود' } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('X-Content-Type-Options', 'nosniff');

  const storedType = obj.httpMetadata?.contentType || 'audio/mpeg';
  const safeType = storedType.startsWith('audio/') ? storedType : 'audio/mpeg';
  headers.set('Content-Type', safeType);
  headers.set('Content-Disposition', 'inline');

  return new Response(obj.body, { headers });
});

// ── Public: secure direct R2 file upload via signed URL ──
app.put('/uploads/direct', async (c) => {
  const key = c.req.query('key');
  const expiresStr = c.req.query('expires');
  const sig = c.req.query('sig');

  if (!key || !expiresStr || !sig) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'معاملات الرفع غير مكتملة' } }, 400);
  }

  // Validate key to prevent path traversal
  if (key.includes('..') || key.startsWith('/')) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'مسار الملف غير صالح' } }, 400);
  }

  const expires = parseInt(expiresStr, 10);
  if (isNaN(expires)) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'صلاحية غير صالحة' } }, 400);
  }

  const secret = c.env.AUTH_SECRET || 'fusha_upload_fallback_secret';
  const isValid = await verifyDirectUploadSignature(secret, key, expires, sig);
  if (!isValid) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'رابط الرفع غير صالح أو منتهي الصلاحية' } }, 403);
  }

  // Determine target bucket (HLS videos go to R2_VIDEO if bound, others to R2)
  const isVideoHls = key.startsWith('lessons/') && key.includes('/hls/');
  const bucket = isVideoHls && c.env.R2_VIDEO ? c.env.R2_VIDEO : c.env.R2;

  if (!bucket) {
    return c.json({ error: { code: 'STORAGE_UNAVAILABLE', message: 'خدمة التخزين R2 غير متوفرة' } }, 500);
  }

  const contentType = c.req.header('content-type') || 'application/octet-stream';
  const body = c.req.raw.body || await c.req.arrayBuffer();

  await bucket.put(key, body, {
    httpMetadata: {
      contentType,
    },
  });

  return c.json({ ok: true, key });
});

// ── Mount Routes ──
app.route('/auth', authRoutes);
app.route('/courses', courseRoutes);
app.route('/', playbackRoutes);     // /lessons/:id/playback, /playback/heartbeat
app.route('/codes', codeRoutes);
app.route('/questions', questionRoutes);
app.route('/push', pushRoutes);
app.route('/admin', adminRoutes);
app.route('/admin', bunnyRoutes);
app.route('/', questionBankRoutes);   // /question-bank/* — بنك الأسئلة
// ⚠️ مسارات dictionary.ts نسبيّة ("/", "/suggest", "/:id") بخلاف بقية الراوترات،
//    لذا تُركَّب على "/dictionary" لا على "/" — وإلا صارت "/" و"/suggest" في الجذر.
app.route('/dictionary', dictionaryRoutes);   // /dictionary/* — معجم فُصْحى (القراءة عامة)
app.route('/', parentRoutes);         // /parent/* و /admin/students/:id/parent-* — عرض وليّ الأمر

// ── الميزات الموروثة (migration 0023) ──
// مساراتها مطلقة (تبدأ بـ "/") لذا تُركَّب على الجذر، مثل questionBank/parent.
app.route('/', bundleRoutes);         // /bundles + /admin/bundles/*
app.route('/', newsRoutes);           // /news + /admin/news/*
app.route('/', purchaseRoutes);       // /purchases/* + /admin/purchase-requests/*
app.route('/', examBuildRoutes);      // /exam-builds/* + /admin/exam-build-requests/*
app.route('/', mistakeRoutes);        // /me/mistakes/* + /common-mistakes + /admin/common-mistakes/*
app.route('/', pointRoutes);          // /me/points + /admin/students/:id/points
app.route('/', walletRoutes);         // /payment-wallets + /me/referral + /admin/payment-wallets|referrals

// ── إغلاق بقية فجوات الوثيقة 23 (migration 0024) ──
app.route('/', challengeRoutes);      // /challenges/* — تحدي 1v1
app.route('/', conversationRoutes);   // /conversations/* — المحادثات (نصية + صوتية)
app.route('/', configRoutes);         // /tabs-config — ترتيب التبويبات + شريط الأخبار

// ── 404 Handler ──
app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'المسار غير موجود' } }, 404)
);

// ── Global Error Handler ──
app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.url}:`, err);

  // Don't leak internal errors in production
  const isProduction = c.env.ENVIRONMENT === 'production';
  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'حدث خطأ داخلي. حاول مرة أخرى.' : err.message,
      ...(isProduction ? {} : { stack: err.stack?.slice(0, 500) }),
    }
  }, 500);
});

// ── Export Worker ──
export default {
  fetch: app.fetch,

  // Queue consumer for background jobs
  async queue(batch: any, env: Env, ctx: ExecutionContext): Promise<void> {
    const isVideoTransfer = 
      batch.queue === 'fusha-ashraf-video-transfer' || 
      (batch.messages && batch.messages.length > 0 && 
       (batch.messages[0].body.type === 'check_encoding' || 
        batch.messages[0].body.type === 'transfer_quality' || 
        batch.messages[0].body.type === 'finalize'));

    if (isVideoTransfer) {
      ctx.waitUntil(handleVideoTransferQueue(batch, env));
    } else {
      ctx.waitUntil(handleNotificationQueue(batch, env));
    }
  },

  // Cron trigger (weekly maintenance)
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      // Expire old enrollments
      await env.DB.prepare(
        `UPDATE enrollments SET status = 'expired'
         WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < datetime('now')`
      ).run();

      // Expire old activation codes
      await env.DB.prepare(
        `UPDATE activation_codes SET status = 'expired'
         WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < datetime('now')`
      ).run();

      // Clean old audit logs (> 90 days)
      await env.DB.prepare(
        `DELETE FROM audit_logs WHERE created_at < datetime('now', '-90 days')`
      ).run();

      console.log('Weekly maintenance completed');
    })());
  },
};

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
import webhookRoutes from './routes/webhooks';
import bunnyRoutes from './routes/bunny';
import pushRoutes from './routes/push';
import { handleVideoTransferQueue } from './queues/videoTransferConsumer';

const app = new Hono<HonoBindings>({ strict: false });

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
  
  const origins = allowed.split(',').map(o => o.trim());
  const isAllowedSubdomain = 
    origin === 'https://synaptic-alhadaba-chemistry.pages.dev' ||
    origin === 'https://synaptic-alhadaba-student.pages.dev' ||
    origin === 'https://mansah-tollabiah.pages.dev' ||
    origin === 'https://mowqe-al-modares.pages.dev' ||
    origin.endsWith('.mansah-tollabiah.pages.dev') ||
    origin.endsWith('.mowqe-al-modares.pages.dev') ||
    origin === 'https://synapticstudio.tech' ||
    origin === 'https://www.synapticstudio.tech' ||
    (c.env.ENVIRONMENT !== 'production' && (
      origin.startsWith('http://localhost:') || 
      origin.startsWith('http://127.0.0.1:')
    ));

  if (origins.includes(origin) || isAllowedSubdomain) {
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
    // bundle and the server failed open when it was unset). JWT (JWKS) is the sole
    // request-authenticity mechanism now.
    allowHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-App-Version', 'X-Platform', 'X-Requested-With', 'X-Signature', 'X-Timestamp', 'X-Nonce'],
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
    if (!path.startsWith('/webhooks')) {
      const requestedWith = c.req.header('X-Requested-With')?.toLowerCase();
      const platform = c.req.header('X-Platform')?.toLowerCase();
      
      const isXmlHttpRequest = requestedWith === 'xmlhttprequest';
      const isMobileOrValidPlatform = ['web', 'android', 'ios'].includes(platform || '');
      const isPublicAuthPath = path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/reset-password');
      const hasAuthHeader = !!c.req.header('Authorization');

      if (!isXmlHttpRequest && !(isMobileOrValidPlatform && (isPublicAuthPath || hasAuthHeader))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'طلب غير مصرح به (CSRF Guard)' } }, 403);
      }

      // Double-submit cookie verification for web clients
      // SECURITY: If the request contains a custom Authorization header, it is immune
      // to CSRF (since browser credentials/cookies are not used for auth and malicious 
      // cross-origin sites cannot read or attach custom headers like Authorization).
      const origin = c.req.header('Origin');
      const isWeb = platform === 'web' || !!origin;
      if (isWeb && !hasAuthHeader && !isXmlHttpRequest) {
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
  name: 'Al-Hadaba Chemistry API',
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
  const obj = await c.env.R2.get('apk/alhadaba-chemistry.apk');
  if (!obj) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'الملف غير موجود' } }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('Content-Type', 'application/vnd.android.package-archive');
  headers.set('Content-Disposition', 'attachment; filename="alhadaba-chemistry.apk"');
  headers.set('Cache-Control', 'public, max-age=3600');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(obj.body, { headers });
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
app.route('/webhooks', webhookRoutes);

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
      batch.queue === 'alhadaba-chemistry-video-transfer' || 
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

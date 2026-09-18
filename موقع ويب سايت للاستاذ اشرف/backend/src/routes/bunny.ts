import { Hono } from 'hono';
import { z } from 'zod';
import type { HonoBindings } from '../types';
import { requireAuth, requirePermission } from '../middleware/auth';
import { generateId } from '../utils/id';

const bunny = new Hono<HonoBindings>();

bunny.use('/*', requireAuth);

// Helper to compute SHA-256 hash for Bunny Stream TUS signature
async function calculateSignature(
  libraryId: string,
  apiKey: string,
  expirationTime: number,
  videoId: string
): Promise<string> {
  const data = new TextEncoder().encode(libraryId + apiKey + expirationTime + videoId);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Restricts the Bunny Stream library to only encode the resolutions we
// actually serve (480p/720p/1080p), so Bunny stops wasting encode time/
// storage on renditions we'd otherwise just discard. Runs at most once per
// deployment (cached via a KV flag) since this is an account-wide library
// setting, not something that needs to be re-applied on every upload.
async function ensureLibraryResolutionsConfigured(env: any, libraryId: string, apiKey: string) {
  const kvFlag = 'bunny_library_resolutions_configured';
  try {
    if (env.KV) {
      const alreadyConfigured = await env.KV.get(kvFlag);
      if (alreadyConfigured) return;
    }

    const resp = await fetch(`https://video.bunnycdn.com/library/${libraryId}`, {
      method: 'POST',
      headers: {
        'AccessKey': apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({ EnabledResolutions: '480p,720p,1080p' }),
    });

    if (resp.ok) {
      if (env.KV) {
        await env.KV.put(kvFlag, '1');
      }
    } else {
      const errorText = await resp.text().catch(() => '');
      console.warn(`[Bunny Route] Failed to configure library resolutions (HTTP ${resp.status}): ${errorText}`);
    }
  } catch (err) {
    console.warn('[Bunny Route] Error configuring library resolutions:', err);
  }
}

// Helper to clear video transfer state from KV to prevent stale progress values
async function clearVideoTransferKV(env: any, videoId: string) {
  if (!env.KV) return;
  await env.KV.delete(`video_transfer:${videoId}:qualities`);
  await env.KV.delete(`video_transfer:${videoId}:total`);
  await env.KV.delete(`video_transfer:${videoId}:progress`);
  await env.KV.delete(`video_transfer:${videoId}:expected_qualities`);

  const standardQualities = ['240p', '360p', '480p', '720p', '1080p', 'audio'];
  for (const q of standardQualities) {
    await env.KV.delete(`video_transfer:${videoId}:${q}:segments_total`);
    await env.KV.delete(`video_transfer:${videoId}:${q}:segments_transferred`);
  }
}

// ── POST /admin/lessons/:id/videos/bunny-upload ──
// Creates a video record in Bunny Stream and returns TUS credentials
bunny.post('/lessons/:id/videos/bunny-upload', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const body = await c.req.json();
  
  const schema = z.object({
    title: z.string().min(1).max(500),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const libraryId = c.env.BUNNY_LIBRARY_ID;
  const apiKey = c.env.BUNNY_API_KEY;

  if (!libraryId || !apiKey) {
    return c.json({
      error: {
        code: 'BUNNY_NOT_CONFIGURED',
        message: 'خدمة المعالجة السحابية (Bunny) غير مفعلة على السيرفر حالياً. يرجى استخدام التبويب "معالجة محلية" لمعالجة ورفع الفيديو مباشرة لـ R2، أو إضافة مفاتيح Bunny Stream إلى إعدادات السيرفر.'
      }
    }, 400);
  }

  // 0. Ensure the library only encodes the resolutions we serve (idempotent, best-effort)
  await ensureLibraryResolutionsConfigured(c.env, libraryId, apiKey);

  // 1. Create video object in Bunny Stream
  const createUrl = `https://video.bunnycdn.com/library/${libraryId}/videos`;
  const bunnyResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'AccessKey': apiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({ title: parsed.data.title }),
  });

  if (!bunnyResponse.ok) {
    const errorText = await bunnyResponse.text();
    console.error('Failed to create video in Bunny Stream:', errorText);
    return c.json({ error: { code: 'BUNNY_ERROR', message: 'فشل إنشاء الفيديو في خادم الترميز' } }, 500);
  }

  const bunnyData = (await bunnyResponse.json()) as { guid: string };
  const bunnyGuid = bunnyData.guid;

  // 2. Generate new Video ID for our R2 key structure
  const videoId = generateId();
  const streamUid = `lessons/${lessonId}/videos/${videoId}/hls`;

  // Generate secure random AES-128 key (16 bytes) and IV (16 bytes)
  const keyBytes = crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = crypto.getRandomValues(new Uint8Array(16));
  
  const keyHex = Array.from(keyBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(ivBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (c.env.KV) {
    await c.env.KV.put(`video_aes_key:${videoId}`, keyHex);
    await c.env.KV.put(`video_aes_iv:${videoId}`, ivHex);
  }

  // 3. Calculate Bunny TUS Signature
  // 24h expiry (was 2h) so very large/slow uploads (e.g. long lecture videos
  // on a slow connection) don't have their TUS signature expire mid-upload.
  const expirationTime = Math.floor(Date.now() / 1000) + 86400;
  const signature = await calculateSignature(libraryId, apiKey, expirationTime, bunnyGuid);

  // 4. Record the video entry in D1 as "uploading"
  // Find and clean up any existing videos for this lesson first, including KV keys
  const oldVideo = await c.env.DB.prepare(
    "SELECT id FROM lesson_videos WHERE lesson_id = ? LIMIT 1"
  ).bind(lessonId).first<{ id: string }>();

  if (oldVideo) {
    await clearVideoTransferKV(c.env, oldVideo.id);
    await c.env.DB.prepare('DELETE FROM lesson_videos WHERE id = ?').bind(oldVideo.id).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO lesson_videos (id, lesson_id, provider, stream_uid, youtube_id, thumbnail_url, duration_seconds, status, require_drm, sort_order, created_at, updated_at)
     VALUES (?, ?, 'r2_hls', ?, null, null, null, 'uploading', 0, 0, datetime('now'), datetime('now'))`
  ).bind(videoId, lessonId, streamUid).run();

  const uploadUrl = `https://video.bunnycdn.com/tusupload?VideoId=${bunnyGuid}&LibraryId=${libraryId}&Signature=${signature}&ExpirationTime=${expirationTime}`;

  return c.json({
    video_id: videoId,
    bunny_guid: bunnyGuid,
    library_id: libraryId,
    upload_url: uploadUrl,
    expiration_time: expirationTime,
    signature: signature,
  }, 201);
});

// ── POST /admin/lessons/:id/videos/bunny-upload-complete ──
// Invoked by the frontend when TUS upload to Bunny Stream completes
bunny.post('/lessons/:id/videos/bunny-upload-complete', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const body = await c.req.json();

  const schema = z.object({
    video_id: z.string().min(1),
    bunny_guid: z.string().min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'بيانات غير صحيحة', details: parsed.error.flatten() } }, 400);
  }

  const d = parsed.data;

  // Run database update and queue scheduling asynchronously AFTER returning HTTP response
  c.executionCtx.waitUntil((async () => {
    try {
      // 1. Update video status in DB to "processing"
      await c.env.DB.prepare(
        "UPDATE lesson_videos SET status = 'processing', updated_at = datetime('now') WHERE id = ?"
      ).bind(d.video_id).run();

      // 2. Trigger the transfer queue pipeline starting with check_encoding
      await c.env.VIDEO_QUEUE.send({
        type: 'check_encoding',
        lessonId,
        videoId: d.video_id,
        bunnyGuid: d.bunny_guid,
        attempt: 1,
      });

      console.log(`[Bunny Route] Queued check_encoding for video ${d.video_id}`);
    } catch (err) {
      console.error('[Bunny Route] Error in bunny-upload-complete waitUntil task:', err);
    }
  })());

  return c.json({ ok: true });
});

// ── GET /admin/lessons/:id/videos/transfer-status ──
// Polls the database for the current transfer status of the video
bunny.get('/lessons/:id/videos/transfer-status', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  
  const video = await c.env.DB.prepare(
    `SELECT id, provider, status, stream_uid, duration_seconds 
     FROM lesson_videos 
     WHERE lesson_id = ? 
     LIMIT 1`
  ).bind(lessonId).first<{ id: string; provider: string; status: string; stream_uid: string; duration_seconds: number | null }>();

  if (!video) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'لم يتم العثور على فيديو لهذا الدرس' } }, 404);
  }

  // Get completed qualities count from KV for detailed progress
  const kvKey = `video_transfer:${video.id}:qualities`;
  const qualitiesStr = await c.env.KV.get(kvKey);
  const qualities = qualitiesStr ? (JSON.parse(qualitiesStr) as string[]) : [];

  // Get total expected qualities count from KV
  const totalStr = await c.env.KV.get(`video_transfer:${video.id}:total`);
  const totalQualities = totalStr ? parseInt(totalStr, 10) : null;

  // Get transcoding progress from KV
  const progressKey = `video_transfer:${video.id}:progress`;
  const progressStr = await c.env.KV.get(progressKey);
  const transcodingProgress = progressStr ? parseInt(progressStr, 10) : null;

  // Calculate detailed segment transfer progress across all expected qualities
  const expectedQualitiesStr = await c.env.KV.get(`video_transfer:${video.id}:expected_qualities`);
  let totalSegments = 0;
  let transferredSegments = 0;
  let transferProgress: number | null = null;

  if (expectedQualitiesStr) {
    try {
      const expectedQualities = JSON.parse(expectedQualitiesStr) as string[];
      for (const q of expectedQualities) {
        const qTotal = await c.env.KV.get(`video_transfer:${video.id}:${q}:segments_total`);
        const qTransferred = await c.env.KV.get(`video_transfer:${video.id}:${q}:segments_transferred`);
        if (qTotal) {
          totalSegments += parseInt(qTotal, 10);
          transferredSegments += qTransferred ? parseInt(qTransferred, 10) : 0;
        }
      }
      if (totalSegments > 0) {
        transferProgress = Math.round((transferredSegments / totalSegments) * 100);
      }
    } catch (e) {
      console.error('Error computing segment progress:', e);
    }
  }

  return c.json({
    video_id: video.id,
    provider: video.provider,
    status: video.status, // uploading, processing, ready, error
    stream_uid: video.stream_uid,
    duration_seconds: video.duration_seconds,
    completed_qualities: qualities,
    total_qualities: totalQualities,
    transcoding_progress: transcodingProgress,
    transfer_progress: transferProgress,
  });
});

// ── POST /admin/lessons/:id/videos/transfer-retry ──
// Securely retry a stuck or failed video transfer
bunny.post('/lessons/:id/videos/transfer-retry', requirePermission('can_manage_courses'), async (c) => {
  const lessonId = c.req.param('id');
  const body = await c.req.json();
  
  const schema = z.object({
    bunny_guid: z.string().min(1),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'معرف فيديو Bunny Stream مطلوب', details: parsed.error.flatten() } }, 400);
  }

  const bunnyGuid = parsed.data.bunny_guid;

  // Find the video record
  const video = await c.env.DB.prepare(
    "SELECT id, provider, status FROM lesson_videos WHERE lesson_id = ? LIMIT 1"
  ).bind(lessonId).first<{ id: string; provider: string; status: string }>();

  if (!video) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'لم يتم العثور على فيديو لهذا الدرس' } }, 404);
  }

  if (video.provider !== 'r2_hls') {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'هذا الفيديو لا يدعم التحويل المشفر لـ R2 HLS' } }, 400);
  }

  // Clear any existing stale transfer progress metrics in KV
  await clearVideoTransferKV(c.env, video.id);

  // Re-queue check_encoding to start transfer pipeline
  await c.env.VIDEO_QUEUE.send({
    type: 'check_encoding',
    lessonId,
    videoId: video.id,
    bunnyGuid,
    attempt: 1,
  });

  // Set DB status to processing
  await c.env.DB.prepare(
    "UPDATE lesson_videos SET status = 'processing', updated_at = datetime('now') WHERE id = ?"
  ).bind(video.id).run();

  console.log(`[Bunny Route] Queued check_encoding for video retry: ${video.id}`);

  return c.json({ ok: true, message: 'تم إعادة جدولة عملية تحويل الفيديو بنجاح.' });
});

export default bunny;

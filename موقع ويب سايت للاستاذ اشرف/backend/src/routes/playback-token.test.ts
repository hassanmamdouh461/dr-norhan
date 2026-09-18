import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';
import type { Env, HonoBindings } from '../types';
import { requireAuth } from '../middleware/auth';
import { getPresignedUrl } from '../utils/s3';
import playback from './playback';

vi.mock('../middleware/auth', () => {
  const passThrough = async (_c: Context<HonoBindings>, next: Next) => next();
  return {
    optionalAuth: vi.fn(async (c: Context<HonoBindings>, next: Next) => {
      if (c.req.header('X-Test-User')) {
        c.set('user', {
          id: 'test-user', supabaseUserId: 'test-user', email: 'test@example.invalid',
          role: 'admin', status: 'active', fullName: 'Test User', maxDevices: 2,
        });
      }
      await next();
    }),
    requireAuth: vi.fn(async (c: Context<HonoBindings>) => {
      // Match production: return the response without finalizing the context.
      const code = c.req.header('Authorization') ? 'INVALID_TOKEN' : 'UNAUTHORIZED';
      return c.json({ error: { code, message: 'Test auth denied.' } }, 401);
    }),
    requireTrustedDevice: passThrough,
    rateLimit: () => passThrough,
    audit: () => passThrough,
  };
});

vi.mock('../utils/s3', () => ({
  getPresignedUrl: vi.fn(async () => 'https://storage.example.invalid/video.mp4'),
}));

// Synthetic fixtures only; no application configuration or real credentials are read.
const configuredSecret = 'test-only-playback-signing-key';
const legacySecret = 'playback-fallback-secret-2026';
const streamUid = 'lessons/test-lesson/videos/test-video/hls';
const hlsPath = '/lessons/test-lesson/video/hls/';
const playbackPath = '/lessons/test-lesson/playback';
const playlist = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key"\nsegment.ts\n';
const keyHex = '00112233445566778899aabbccddeeff';
const requestHeaders = {
  'CF-Connecting-IP': '192.0.2.1',
  'User-Agent': 'offline-playback-test',
  'X-Device-Id': 'test-device',
};
const missingConfigs = [
  { label: 'missing', secret: undefined },
  { label: 'empty', secret: '' },
  { label: 'whitespace-only', secret: ' \t\r\n ' },
];
const verificationRoutes = [
  { label: 'protected playlist', free: false, file: 'playlist.m3u8', isKey: false },
  { label: 'protected segment', free: false, file: 'segment.ts', isKey: false },
  { label: 'protected key', free: false, file: 'key', isKey: true },
  { label: 'free-preview key', free: true, file: 'key', isKey: true },
];
const network = vi.fn(() => { throw new Error('Network access is forbidden in playback route tests.'); });

function fixture(secret: string | undefined, free = true, provider = 'r2_hls') {
  const run = vi.fn(async () => ({ success: true }));
  const db = {
    prepare: vi.fn((sql: string) => {
      let row: unknown;
      if (sql.includes('FROM lessons l')) {
        row = { id: 'test-lesson', course_id: 'test-course', is_free_preview: free ? 1 : 0, course_is_free: 0, duration_seconds: 9000 };
      } else if (sql.includes('FROM lesson_videos')) {
        row = { id: 'test-video', provider, stream_uid: streamUid, youtube_id: 'test-youtube-id' };
      } else if (sql.includes('FROM app_settings')) {
        row = { value: '180' };
      } else if (sql.includes('FROM profiles')) {
        row = { phone: 'test-phone' };
      } else if (sql.includes('FROM lesson_progress')) {
        row = { last_position: 42 };
      } else if (!sql.includes('INSERT INTO audit_logs')) {
        throw new Error(`Unexpected test SQL: ${sql}`);
      }
      return { bind: vi.fn().mockReturnThis(), first: vi.fn(async () => row), run };
    }),
  };
  const kv = {
    get: vi.fn(async (key: string) => key === 'video_aes_key:test-video' ? keyHex : null),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
  };
  const r2 = {
    get: vi.fn(async () => ({ body: playlist, text: async () => playlist })),
  };
  const bindings = {
    DB: db, KV: kv, R2: r2, PLATFORM_KEY: 'test-platform',
    ...(secret === undefined ? {} : { AUTH_SECRET: secret }),
  };
  const env = bindings as unknown as Env;
  const executionCtx = { waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} };
  return { env, db, kv, r2, run, executionCtx };
}

async function tokenFor(secret: string) {
  return sign({
    scope: 'playback', userId: 'test-user', deviceId: 'test-device', streamUid,
    clientIp: requestHeaders['CF-Connecting-IP'], userAgent: requestHeaders['User-Agent'],
    exp: Math.floor(Date.now() / 1000) + 3600,
  }, secret, 'HS256');
}

async function expectConfigError(response: Response) {
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: { code: 'CONFIG_ERROR', message: 'AUTH_SECRET must be configured for playback tokens.' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', network);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  try {
    expect(network).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});

describe.each(missingConfigs)('playback signing configuration: $label', ({ secret }) => {
  it.each([false, true])('refuses issuance without writing sessions (authenticated=%s)', async (authenticated) => {
    const { env, kv, r2, run, executionCtx } = fixture(secret, !authenticated);
    const response = await playback.request(playbackPath, {
      method: 'POST',
      headers: { ...requestHeaders, ...(authenticated ? { 'X-Test-User': 'yes' } : {}) },
    }, env, executionCtx);

    await expectConfigError(response);
    expect(kv.put).not.toHaveBeenCalled();
    expect(r2.get).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it.each(verificationRoutes)('fails closed on $label before auth fallback or media access', async ({ free, file }) => {
    const { env, kv, r2 } = fixture(secret, free);
    const token = await tokenFor(legacySecret);
    const response = await playback.request(`${hlsPath}${file}?token=${token}`, {
      headers: requestHeaders,
    }, env);

    await expectConfigError(response);
    expect(requireAuth).not.toHaveBeenCalled();
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
    expect(r2.get).not.toHaveBeenCalled();
  });

  it.each(['youtube', 'r2', 'server'])('preserves non-HLS provider %s', async (provider) => {
    const { env } = fixture(secret, true, provider);
    const response = await playback.request(playbackPath, { method: 'POST' }, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider, last_position: 0,
      playback_url: provider === 'youtube'
        ? 'https://www.youtube.com/watch?v=test-youtube-id'
        : 'https://storage.example.invalid/video.mp4',
    });
    expect(getPresignedUrl).toHaveBeenCalledTimes(provider === 'youtube' ? 0 : 1);
  });
});

describe('configured playback tokens', () => {
  it.each([
    { label: 'ordinary', secret: configuredSecret },
    { label: 'nonblank with surrounding whitespace', secret: ` ${configuredSecret}\t` },
  ])('issues and verifies tokens with the exact $label key', async ({ secret }) => {
    const { env, kv, executionCtx } = fixture(secret, false);
    const response = await playback.request(playbackPath, {
      method: 'POST', headers: { ...requestHeaders, 'X-Test-User': 'yes' },
    }, env, executionCtx);
    expect(response.status).toBe(200);
    const body = await response.json() as { provider: string; playback_url: string; last_position: number };
    expect(body).toMatchObject({ provider: 'r2_hls', last_position: 42 });
    const url = new URL(body.playback_url);
    expect(url.pathname).toBe(`${hlsPath}playlist.m3u8`);
    const token = url.searchParams.get('token')!;
    expect(await verify(token, secret, 'HS256')).toMatchObject({
      scope: 'playback', userId: 'test-user', deviceId: 'test-device', streamUid,
      clientIp: requestHeaders['CF-Connecting-IP'], userAgent: requestHeaders['User-Agent'],
      exp: expect.any(Number),
    });
    await expect(verify(token, legacySecret, 'HS256')).rejects.toThrow();
    expect(kv.put).toHaveBeenCalledWith('active_session:test-user', 'test-device', { expirationTtl: 12600 });

    for (const route of verificationRoutes) {
      const target = fixture(secret, route.free);
      const media = await playback.request(`${hlsPath}${route.file}?token=${token}`, {
        headers: requestHeaders,
      }, target.env);
      expect(media.status).toBe(200);
      if (route.isKey) {
        expect(media.headers.get('Content-Type')).toBe('application/octet-stream');
        expect(Buffer.from(await media.arrayBuffer()).toString('hex')).toBe(keyHex);
        expect(target.kv.get).toHaveBeenCalledWith('video_aes_key:test-video');
        expect(target.r2.get).not.toHaveBeenCalled();
      } else {
        expect(target.r2.get).toHaveBeenCalledWith(`${streamUid}/${route.file}`);
        if (route.file.endsWith('.m3u8')) {
          const text = await media.text();
          expect(text).toContain(`URI="key?token=${token}"`);
          expect(text).toContain(`segment.ts?token=${token}`);
        }
      }
    }
    expect(requireAuth).not.toHaveBeenCalled();
  });

  describe.each([
    { label: 'wrong key', secret: 'test-only-wrong-key' },
    { label: 'removed fallback key', secret: legacySecret },
  ])('rejects tokens signed with $label', ({ secret }) => {
    it.each(verificationRoutes)('does not serve $label', async ({ free, file }) => {
      const { env, kv, r2 } = fixture(configuredSecret, free);
      const token = await tokenFor(secret);
      const response = await playback.request(`${hlsPath}${file}?token=${token}`, {
        headers: requestHeaders,
      }, env);
      expect(response.status).toBe(free ? 403 : 401);
      expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
      expect(requireAuth).toHaveBeenCalledTimes(free ? 0 : 1);
      expect(kv.get).not.toHaveBeenCalled();
      expect(kv.put).not.toHaveBeenCalled();
      expect(r2.get).not.toHaveBeenCalled();
    });
  });

  it('accepts a configured token from the Authorization header', async () => {
    const { env, r2 } = fixture(configuredSecret, false);
    const token = await tokenFor(configuredSecret);
    const response = await playback.request(`${hlsPath}segment.ts`, {
      headers: { ...requestHeaders, Authorization: `Bearer ${token}` },
    }, env);
    expect(response.status).toBe(200);
    expect(r2.get).toHaveBeenCalledWith(`${streamUid}/segment.ts`);
    expect(requireAuth).not.toHaveBeenCalled();
  });
});

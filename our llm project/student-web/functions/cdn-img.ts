// Pages Function: on-the-fly optimization for teacher-uploaded course cover
// images via the Cloudflare Images binding (Workers Paid plan feature).
// Usage: /cdn-img?src=<encoded R2 url>&w=<width>
//
// Only proxies the platform's own R2 files bucket — never an arbitrary
// caller-supplied host — to avoid turning this into an open image proxy.
const ALLOWED_HOSTS = new Set([
  'alhadaba-chemistry-files.780ddc00154813b98d142686dc31ecde.r2.cloudflarestorage.com',
]);

const MIN_WIDTH = 16;
const MAX_WIDTH = 1600;

export const onRequestGet: PagesFunction<{ IMAGES: unknown }> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const src = url.searchParams.get('src');
  if (!src) {
    return new Response('missing src', { status: 400 });
  }

  let srcUrl: URL;
  try {
    srcUrl = new URL(src);
  } catch {
    return new Response('invalid src', { status: 400 });
  }
  if (srcUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(srcUrl.hostname)) {
    return new Response('host not allowed', { status: 403 });
  }

  const upstream = await fetch(srcUrl.toString(), {
    cf: { cacheTtl: 3600, cacheEverything: true } as RequestInitCfProperties,
  });
  if (!upstream.ok || !upstream.body) {
    return new Response('upstream fetch failed', { status: 502 });
  }

  const requestedWidth = Number(url.searchParams.get('w'));
  const width = Number.isFinite(requestedWidth) && requestedWidth > 0
    ? Math.min(Math.max(Math.round(requestedWidth), MIN_WIDTH), MAX_WIDTH)
    : undefined;

  const accept = request.headers.get('Accept') || '';
  const format = accept.includes('image/avif') ? 'image/avif' : 'image/webp';

  try {
    // @ts-expect-error — Images binding types ship separately; kept loose here.
    const pipeline = env.IMAGES.input(upstream.body).transform({
      width,
      sharpen: 1,
    });
    const output = await pipeline.output({ format, quality: 88 });
    const response: Response = output.response();
    response.headers.set('Cache-Control', 'public, max-age=86400, immutable');
    return response;
  } catch {
    // Images binding unavailable/not entitled or transform failed — never
    // break the page, just serve the untouched original.
    return new Response(upstream.body, {
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
};

// R2 files bucket that the /cdn-img Pages Function is allowed to proxy —
// keep in sync with functions/cdn-img.ts's ALLOWED_HOSTS.
const OPTIMIZABLE_HOST = 'alhadaba-chemistry-files.780ddc00154813b98d142686dc31ecde.r2.cloudflarestorage.com';

// Routes teacher-uploaded course cover images through the Cloudflare Images
// transform proxy for a sharper, better-compressed result at the size they're
// actually displayed at. Any other source (stock fallback URLs, etc.) is
// returned untouched.
export function optimizedCoverUrl(src: string | null | undefined, width: number): string | undefined {
  if (!src) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return src;
  }
  if (parsed.hostname !== OPTIMIZABLE_HOST) return src;
  return `/cdn-img?src=${encodeURIComponent(src)}&w=${width}`;
}

export function parseCoverPosition(src: string | null | undefined): { objectPosition?: string; transform?: string; transformOrigin?: string } {
  if (!src) return {};
  const match = src.match(/[?&]pos=([^&]+)/);
  if (match && match[1]) {
    const parts = match[1].split(',');
    const x = parts[0];
    const y = parts[1];
    const zoom = parts[2];
    
    const style: { objectPosition?: string; transform?: string; transformOrigin?: string } = {};
    if (x !== undefined && y !== undefined) {
      style.objectPosition = `${x}% ${y}%`;
    }
    if (zoom !== undefined) {
      const zoomVal = parseInt(zoom);
      if (zoomVal && zoomVal !== 100) {
        style.transform = `scale(${zoomVal / 100})`;
        style.transformOrigin = 'center center';
      }
    }
    return style;
  }
  return {};
}

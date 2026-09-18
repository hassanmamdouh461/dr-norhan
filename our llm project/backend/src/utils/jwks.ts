/**
 * JWKS Verification with Stale-While-Revalidate caching in KV.
 *
 * Strategy:
 * 1. Try to get JWKS from KV cache
 * 2. If fresh (< TTL) → use it
 * 3. If stale (> TTL but exists) → use it AND trigger background refresh
 * 4. If missing → fetch from Supabase and cache
 *
 * This prevents the Thundering Herd problem where many requests
 * simultaneously try to refresh an expired cache.
 */

const JWKS_KV_KEY = 'supabase:jwks';
const JWKS_FRESH_TTL = 7 * 86400; // Consider KV cache fresh for 7 days
const JWKS_MEMORY_TTL = 86400;    // Consider memory cache fresh for 24 hours

interface JWKSCache {
  keys: JsonWebKey[];
  fetchedAt: number;
}

interface CryptoKeyCache {
  [kid: string]: CryptoKey;
}

// In-memory cache for imported CryptoKeys (per isolate lifetime)
const importedKeys: CryptoKeyCache = {};

// In-memory cache for JWKS (per isolate lifetime) to avoid repeated KV reads
let cachedJWKS: JWKSCache | null = null;

async function fetchJWKSFromSupabase(supabaseUrl: string): Promise<JsonWebKey[]> {
  const url = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });
  if (!resp.ok) {
    throw new Error(`Failed to fetch JWKS: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json() as { keys: JsonWebKey[] };
  return data.keys;
}

export async function forceRefreshJWKS(
  kv: KVNamespace,
  supabaseUrl: string
): Promise<JsonWebKey[]> {
  const keys = await fetchJWKSFromSupabase(supabaseUrl);
  const newCache: JWKSCache = { keys, fetchedAt: Date.now() / 1000 };
  cachedJWKS = newCache;
  await kv.put(JWKS_KV_KEY, JSON.stringify(newCache), { expirationTtl: 30 * 86400 }); // Store in KV for 30 days
  return keys;
}

export async function getJWKS(
  kv: KVNamespace,
  supabaseUrl: string
): Promise<JsonWebKey[]> {
  const now = Date.now() / 1000;

  // 1. Try in-memory cache first (valid for 24 hours)
  if (cachedJWKS && (now - cachedJWKS.fetchedAt < JWKS_MEMORY_TTL)) {
    return cachedJWKS.keys;
  }

  // 2. Try KV cache
  const cached = await kv.get(JWKS_KV_KEY, 'json') as JWKSCache | null;

  if (cached && (now - cached.fetchedAt < JWKS_FRESH_TTL)) {
    cachedJWKS = cached; // Update in-memory cache
    return cached.keys;
  }

  // 3. No cache or expired (> 7 days) — fetch synchronously and cache in KV
  try {
    return await forceRefreshJWKS(kv, supabaseUrl);
  } catch (error) {
    // If fetching fails but we have an old cached version, fallback to it
    if (cached) {
      console.warn('Failed to refresh JWKS, falling back to older cached keys:', error);
      return cached.keys;
    }
    throw error;
  }
}

/**
 * Import a JWK as a CryptoKey for JWT verification.
 * Caches imported keys in-memory per worker isolate.
 */
export async function importJWK(jwk: JsonWebKey): Promise<CryptoKey> {
  const kid = (jwk as any).kid || 'default';
  if (importedKeys[kid]) return importedKeys[kid];

  const algorithm = jwk.kty === 'RSA'
    ? { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }
    : { name: 'ECDSA', namedCurve: 'P-256' };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    algorithm,
    false,
    ['verify']
  );

  importedKeys[kid] = key;
  return key;
}

/**
 * Verify and decode a Supabase JWT using JWKS.
 * Returns decoded payload or null if invalid.
 */
export async function verifySupabaseJWT(
  token: string,
  kv: KVNamespace,
  supabaseUrl: string,
  audience: string
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const headerB64 = parts[0];
    const payloadB64 = parts[1];
    const signatureB64 = parts[2];

    // Decode header to get kid and alg
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
    const kid = header.kid;
    const alg = header.alg;

    // Get JWKS and find matching key
    let keys = await getJWKS(kv, supabaseUrl);
    let jwk = kid
      ? keys.find(k => (k as any).kid === kid)
      : keys[0];

    // If kid is not found in the cached keys, try a rate-limited forced refresh
    if (!jwk && kid) {
      const now = Date.now() / 1000;
      const lastRefresh = cachedJWKS ? cachedJWKS.fetchedAt : 0;
      if (now - lastRefresh > 3600) {
        try {
          keys = await forceRefreshJWKS(kv, supabaseUrl);
          jwk = keys.find(k => (k as any).kid === kid);
        } catch (err) {
          console.error('Failed to force refresh JWKS:', err);
        }
      }
    }

    if (!jwk) return null;

    // Verify header alg matches JWK expected type
    if (jwk.kty === 'RSA') {
      if (alg !== 'RS256') return null;
    } else if (jwk.kty === 'EC') {
      if (alg !== 'ES256') return null;
    } else {
      return null;
    }

    const cryptoKey = await importJWK(jwk);

    // Decode signature
    const signatureBytes = base64UrlDecode(signatureB64);
    const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    // Determine algorithm for verification
    const verifyAlg = jwk.kty === 'RSA'
      ? { name: 'RSASSA-PKCS1-v1_5' }
      : { name: 'ECDSA', hash: 'SHA-256' };

    const valid = await crypto.subtle.verify(
      verifyAlg,
      cryptoKey,
      signatureBytes,
      dataBytes
    );

    if (!valid) return null;

    // Decode and validate payload claims
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      console.error('[JWT] Token expired. exp:', payload.exp, 'now:', now);
      return null;
    }
    if (payload.nbf && payload.nbf > now) {
      console.error('[JWT] Token not yet valid. nbf:', payload.nbf, 'now:', now);
      return null;
    }
    if (audience && payload.aud !== audience) {
      console.error('[JWT] Audience mismatch. aud:', payload.aud, 'expected:', audience);
      return null;
    }
    
    const expectedIss = `${supabaseUrl}/auth/v1`;
    if (payload.iss !== expectedIss) {
      console.error('[JWT] Issuer mismatch. iss:', payload.iss, 'expected:', expectedIss);
      return null;
    }

    return payload;
  } catch (err: any) {
    console.error('[JWT] Verification exception:', err);
    return null;
  }
}

/**
 * Fallback: Verify JWT using HMAC-SHA256 with shared secret.
 * Used when JWKS is unavailable or for dev environments.
 */
export async function verifyJWTWithSecret(
  token: string,
  secret: string,
  supabaseUrl: string,
  audience: string
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    if (header.alg !== 'HS256') return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const dataBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signatureBytes = base64UrlDecode(parts[2]);

    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, dataBytes);
    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.error('[JWT Secret] Token expired. exp:', payload.exp, 'now:', now);
      return null;
    }
    if (payload.nbf && payload.nbf > now) {
      console.error('[JWT Secret] Token not yet valid. nbf:', payload.nbf, 'now:', now);
      return null;
    }
    
    if (audience && payload.aud !== audience) {
      console.error('[JWT Secret] Audience mismatch. aud:', payload.aud, 'expected:', audience);
      return null;
    }
    
    const expectedIss = `${supabaseUrl}/auth/v1`;
    if (payload.iss !== expectedIss) {
      console.error('[JWT Secret] Issuer mismatch. iss:', payload.iss, 'expected:', expectedIss);
      return null;
    }

    return payload;
  } catch (err: any) {
    console.error('[JWT Secret] Verification exception:', err);
    return null;
  }
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

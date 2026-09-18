/**
 * الرموز (Tokens) — Cloudflare-native
 * Access tokens: JWT مُوقَّع بـ HMAC-SHA256 (HS256) عبر Web Crypto.
 * Refresh tokens: سلاسل عشوائية معتمة تُخزَّن مُجزَّأة (SHA-256) في D1 لتكون قابلة للإلغاء.
 *
 * Access tokens are HS256 JWTs. Refresh tokens are opaque random strings whose
 * SHA-256 hash is stored in D1 so they can be revoked and rotated.
 */

import { sign, verify } from 'hono/jwt';
import type { Env } from '../types';

/** مدة صلاحية رمز الوصول — ساعة واحدة. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
/** مدة صلاحية رمز التجديد — 30 يوماً. */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
/** مدة صلاحية رابط إعادة تعيين كلمة المرور — ساعة واحدة. */
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60;

export const JWT_ISSUER = 'fusha-api';
export const JWT_AUDIENCE = 'fusha-client';

export type AuthRole = 'admin' | 'assistant' | 'student';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: AuthRole;
  token_use: 'access';
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

/** المفتاح السري للمصادقة — يُضبط عبر `wrangler secret put AUTH_SECRET`. */
export function getAuthSecret(env: Env): string | null {
  const secret = env.AUTH_SECRET?.trim();
  return secret ? secret : null;
}

/** توقيع رمز وصول جديد. يرمي استثناءً إذا لم يُضبط AUTH_SECRET. */
export async function signAccessToken(
  env: Env,
  user: { id: string; email: string; role: AuthRole }
): Promise<string> {
  const secret = getAuthSecret(env);
  if (!secret) throw new Error('AUTH_SECRET is not configured');

  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      token_use: 'access',
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      iat: now,
      exp: now + ACCESS_TOKEN_TTL_SECONDS,
    },
    secret,
    'HS256'
  );
}

/**
 * التحقق من رمز الوصول: التوقيع + الصلاحية + المُصدِر + الجمهور + نوع الرمز.
 * يعيد null لأي رمز غير صالح (لا يرمي استثناءً).
 */
export async function verifyAccessToken(
  token: string,
  secret: string | null | undefined
): Promise<AccessTokenClaims | null> {
  if (!secret?.trim()) return null;
  try {
    const payload = (await verify(token, secret.trim(), 'HS256')) as Record<string, unknown>;
    if (payload.token_use !== 'access') return null;
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return null;
    if (payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) return null;
    return payload as unknown as AccessTokenClaims;
  } catch {
    return null;
  }
}

/** رمز معتم عشوائي (32 بايت، base64url) — يُستخدم لرموز التجديد والاستعادة. */
export function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

/** بصمة SHA-256 بصيغة hex — تُخزَّن في D1 بدلاً من الرمز نفسه. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const bytes = new Uint8Array(digest);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

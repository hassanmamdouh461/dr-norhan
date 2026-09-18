/**
 * كلمات المرور — Cloudflare Workers (Web Crypto فقط)
 * Password hashing — Cloudflare Workers (Web Crypto only)
 *
 * نستخدم PBKDF2-HMAC-SHA256 من Web Crypto لأن وحدات bcrypt/argon2 الأصلية
 * لا تعمل على بيئة Workers. التخزين بالصيغة: `<saltHex>:<hashHex>`.
 *
 * Uses PBKDF2-HMAC-SHA256 via Web Crypto. Native modules (bcrypt / argon2)
 * cannot run on the Workers runtime, and `nodejs_compat` gives no stable
 * `crypto.pbkdf2` contract, so Web Crypto is the supported path.
 */

/**
 * عدد التكرارات — يزيد الكلفة على المهاجم.
 *
 * ⚠️ سقف Cloudflare Workers: `crypto.subtle.deriveBits` يرفض أي
 * `iterations > 100_000` بخطأ «iteration counts above 100000 are not supported».
 * تجاوز هذا الحد يُسقط تسجيل الدخول والتسجيل في الإنتاج بـ 500.
 * لا ترفعه دون التأكد من رفع السقف على المنصة أولاً.
 */
export const PBKDF2_ITERATIONS = 100_000;

const PBKDF2_HASH = 'SHA-256';
const KEY_LENGTH_BITS = 256;
const SALT_BYTES = 16;

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return new Uint8Array(bits);
}

/** مقارنة ثابتة الزمن لمنع تسريب المعلومات عبر التوقيت. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * يُنتج بصمة كلمة المرور بصيغة `<saltHex>:<hashHex>`.
 * Produces `<saltHex>:<hashHex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `${toHex(salt)}:${toHex(hash)}`;
}

/**
 * يتحقق من كلمة المرور مقابل البصمة المخزّنة.
 * Returns false (never throws) for malformed or missing stored values.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const separator = stored.indexOf(':');
  if (separator <= 0) return false;

  const salt = fromHex(stored.slice(0, separator));
  const expected = fromHex(stored.slice(separator + 1));
  if (!salt || !expected) return false;

  const actual = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return timingSafeEqual(actual, expected);
}

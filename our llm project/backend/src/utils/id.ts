/** Generate a UUID v4 using Web Crypto API (available in Workers) */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Get current timestamp in ISO-8601 UTC format */
export function nowISO(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Generate a human-readable activation code like PHY-7Q9K-23MN */
export function generateActivationCode(): string {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1/l
  const segment = (len: number) => {
    const arr = new Uint8Array(len);
    let result = '';
    const limit = 256 - (256 % CHARS.length);
    while (result.length < len) {
      crypto.getRandomValues(arr);
      for (let i = 0; i < arr.length && result.length < len; i++) {
        if (arr[i] < limit) {
          result += CHARS[arr[i] % CHARS.length];
        }
      }
    }
    return result;
  };
  return `PHY-${segment(4)}-${segment(4)}`;
}

/** Normalize activation code: uppercase, trim, remove extra spaces */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** Slugify text (simple latin+arabic support) */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

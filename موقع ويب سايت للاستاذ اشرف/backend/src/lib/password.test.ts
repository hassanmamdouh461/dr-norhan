/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs';
import { pbkdf2Sync } from 'node:crypto';
import { URL } from 'node:url';
import { PBKDF2_ITERATIONS, hashPassword, verifyPassword } from './password';

/**
 * سقف Cloudflare Workers: `crypto.subtle.deriveBits` يرفض أي `iterations > 100000`
 * بخطأ «Pbkdf2 failed: iteration counts above 100000 are not supported».
 * تجاوزه أسقط تسجيل الدخول والتسجيل في الإنتاج بـ 500، لذا نُثبّت السقف هنا.
 */
const WORKERS_PBKDF2_MAX_ITERATIONS = 100_000;

describe('PBKDF2 password hashing', () => {
  it('يبقى عدد التكرارات داخل سقف Cloudflare Workers', () => {
    expect(PBKDF2_ITERATIONS).toBeLessThanOrEqual(WORKERS_PBKDF2_MAX_ITERATIONS);
  });

  it('يُنتج بصمة بالصيغة <saltHex>:<hashHex> ويتحقق منها', async () => {
    const stored = await hashPassword('كلمة-مرور-قوية-123');
    const [salt, hash] = stored.split(':');

    expect(salt).toMatch(/^[0-9a-f]{32}$/);   // 16 بايت ملح
    expect(hash).toMatch(/^[0-9a-f]{64}$/);   // 256 بت
    expect(await verifyPassword('كلمة-مرور-قوية-123', stored)).toBe(true);
  });

  it('يرفض كلمة المرور الخاطئة والبصمات المشوّهة دون أن يرمي استثناءً', async () => {
    const stored = await hashPassword('correct-horse');

    expect(await verifyPassword('wrong-horse', stored)).toBe(false);
    expect(await verifyPassword('correct-horse', null)).toBe(false);
    expect(await verifyPassword('correct-horse', '')).toBe(false);
    expect(await verifyPassword('correct-horse', 'no-separator')).toBe(false);
    expect(await verifyPassword('correct-horse', 'zz:zz')).toBe(false);
    expect(await verifyPassword('correct-horse', ':')).toBe(false);
  });

  it('يُنتج ملحاً مختلفاً لكل بصمة', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');
    expect(first).not.toBe(second);
    expect(await verifyPassword('same-password', first)).toBe(true);
    expect(await verifyPassword('same-password', second)).toBe(true);
  });

  it('يطابق مخرَج Node pbkdf2Sync الذي يستخدمه سكربت إنشاء المدير', async () => {
    // نفس المعاملات: SHA-256، 256 بت، 16 بايت ملح — وإلا لن تُقبل كلمة مرور المدير.
    const stored = await hashPassword('admin-seed-password');
    const [saltHex, hashHex] = stored.split(':');

    const nodeHash = pbkdf2Sync(
      'admin-seed-password',
      Buffer.from(saltHex, 'hex'),
      PBKDF2_ITERATIONS,
      32,
      'sha256'
    ).toString('hex');

    expect(nodeHash).toBe(hashHex);
  });

  it('يبقى عدد التكرارات في سكربت إنشاء المدير مطابقاً للمكتبة', () => {
    // انحراف هذا الثابت يعني أن كلمة مرور المدير المُولَّدة لن تُقبل عند تسجيل الدخول.
    const script = readFileSync(new URL('../../scripts/create-admin.ts', import.meta.url), 'utf8');
    const match = script.match(/const PBKDF2_ITERATIONS = ([\d_]+);/);

    expect(match).not.toBeNull();
    expect(Number(match![1].replace(/_/g, ''))).toBe(PBKDF2_ITERATIONS);
  });
});

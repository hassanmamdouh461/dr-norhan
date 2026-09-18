import { describe, it, expect } from 'vitest';
import { generateDirectUploadUrl, verifyDirectUploadSignature, getPresignedPutUrl } from './s3';
import type { Env } from '../types';

describe('R2 Direct Upload & Presigned URL Fallback', () => {
  const mockEnv: Partial<Env> = {
    AUTH_SECRET: 'test_super_secret_key_1234567890_abcdef',
    PUBLIC_API_ORIGIN: 'https://api.fusha.site',
  };

  it('generates a signed direct upload URL with expiry and signature', async () => {
    const objectKey = 'covers/test_image.jpg';
    const uploadUrl = await generateDirectUploadUrl(mockEnv as Env, objectKey, 3600);

    const url = new URL(uploadUrl);
    expect(url.origin).toBe('https://api.fusha.site');
    expect(url.pathname).toBe('/uploads/direct');
    expect(url.searchParams.get('key')).toBe(objectKey);
    expect(url.searchParams.has('expires')).toBe(true);
    expect(url.searchParams.has('sig')).toBe(true);
  });

  it('verifies a valid signature correctly', async () => {
    const objectKey = 'covers/valid_cover.png';
    const expires = Math.floor(Date.now() / 1000) + 1800;
    const uploadUrl = await generateDirectUploadUrl(mockEnv as Env, objectKey, 1800);

    const url = new URL(uploadUrl);
    const sig = url.searchParams.get('sig')!;
    const exp = parseInt(url.searchParams.get('expires')!, 10);

    const isValid = await verifyDirectUploadSignature(mockEnv.AUTH_SECRET!, objectKey, exp, sig);
    expect(isValid).toBe(true);
  });

  it('rejects an expired upload signature', async () => {
    const objectKey = 'covers/expired.png';
    const pastExpires = Math.floor(Date.now() / 1000) - 100; // Expired 100s ago

    const isValid = await verifyDirectUploadSignature(mockEnv.AUTH_SECRET!, objectKey, pastExpires, 'fakesig');
    expect(isValid).toBe(false);
  });

  it('rejects a forged or tampered signature', async () => {
    const objectKey = 'covers/tampered.png';
    const expires = Math.floor(Date.now() / 1000) + 1800;

    const isValid = await verifyDirectUploadSignature(mockEnv.AUTH_SECRET!, objectKey, expires, 'bad_signature_value');
    expect(isValid).toBe(false);
  });

  it('falls back to direct upload URL when S3 credentials are not set', async () => {
    const objectKey = 'covers/fallback.png';
    const uploadUrl = await getPresignedPutUrl(
      mockEnv as Env,
      'fusha-ashraf-files',
      objectKey,
      'image/png',
      3600,
      'https://api.fusha.site'
    );

    expect(uploadUrl).toContain('/uploads/direct?key=covers%2Ffallback.png');
    expect(uploadUrl).toContain('sig=');
  });
});

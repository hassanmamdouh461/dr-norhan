import { Env } from '../types';

export async function getPresignedUrl(
  env: Env,
  bucketName: string,
  objectKey: string,
  contentType: string,
  isDownloadable: boolean,
  fileName: string,
  expiresSeconds: number = 3600
): Promise<string> {
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const accountId = env.CF_ACCOUNT_ID;

  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error('R2 S3 credentials or Account ID are not configured');
  }

  const host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const method = 'GET';
  const region = 'auto';
  const service = 's3';

  const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = datetime.slice(0, 8);

  const scope = `${date}/${region}/${service}/aws4_request`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': datetime,
    'X-Amz-Expires': expiresSeconds.toString(),
    'X-Amz-SignedHeaders': 'host',
  };

  // Add override response headers
  const contentDisposition = isDownloadable ? `attachment; filename="${fileName}"` : 'inline';
  queryParams['response-content-type'] = contentType;
  queryParams['response-content-disposition'] = contentDisposition;
  queryParams['response-cache-control'] = 'private, no-store, max-age=0';

  // Sort query parameters
  const sortedQueryKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedQueryKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const encodedKey = objectKey.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const cleanKey = encodedKey.startsWith('/') ? encodedKey : `/${encodedKey}`;
  const canonicalRequest = `${method}\n${cleanKey}\n${canonicalQueryString}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;

  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${datetime}\n${scope}\n${canonicalRequestHash}`;

  // Calculate signature keys
  const dateKey = await hmacSign(utf8Encode(`AWS4${secretAccessKey}`), date);
  const dateRegionKey = await hmacSign(dateKey, region);
  const dateRegionServiceKey = await hmacSign(dateRegionKey, service);
  const signingKey = await hmacSign(dateRegionServiceKey, 'aws4_request');

  const signature = await hmacSignHex(signingKey, stringToSign);

  return `${endpoint}${cleanKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

async function sha256Hex(message: string): Promise<string> {
  const msgBuffer = utf8Encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return hexEncode(new Uint8Array(hashBuffer));
}

async function hmacSign(key: Uint8Array, message: string): Promise<Uint8Array> {
  const msgBuffer = utf8Encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer);
  return new Uint8Array(sigBuffer);
}

async function hmacSignHex(key: Uint8Array, message: string): Promise<string> {
  const signature = await hmacSign(key, message);
  return hexEncode(signature);
}

function utf8Encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getPresignedPutUrl(
  env: Env,
  bucketName: string,
  objectKey: string,
  contentType: string,
  expiresSeconds: number = 3600
): Promise<string> {
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const accountId = env.CF_ACCOUNT_ID;

  if (!accessKeyId || !secretAccessKey || !accountId) {
    throw new Error('R2 S3 credentials or Account ID are not configured');
  }

  const host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${host}`;
  const method = 'PUT';
  const region = 'auto';
  const service = 's3';

  const datetime = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = datetime.slice(0, 8);

  const scope = `${date}/${region}/${service}/aws4_request`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${scope}`,
    'X-Amz-Date': datetime,
    'X-Amz-Expires': expiresSeconds.toString(),
    'X-Amz-SignedHeaders': 'host',
  };

  // Sort query parameters
  const sortedQueryKeys = Object.keys(queryParams).sort();
  const canonicalQueryString = sortedQueryKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
    .join('&');

  const encodedKey = objectKey.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const cleanKey = encodedKey.startsWith('/') ? encodedKey : `/${encodedKey}`;
  const canonicalRequest = `${method}\n${cleanKey}\n${canonicalQueryString}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;

  const canonicalRequestHash = await sha256Hex(canonicalRequest);
  const stringToSign = `AWS4-HMAC-SHA256\n${datetime}\n${scope}\n${canonicalRequestHash}`;

  // Calculate signature keys
  const dateKey = await hmacSign(utf8Encode(`AWS4${secretAccessKey}`), date);
  const dateRegionKey = await hmacSign(dateKey, region);
  const dateRegionServiceKey = await hmacSign(dateRegionKey, service);
  const signingKey = await hmacSign(dateRegionServiceKey, 'aws4_request');

  const signature = await hmacSignHex(signingKey, stringToSign);

  return `${endpoint}${cleanKey}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

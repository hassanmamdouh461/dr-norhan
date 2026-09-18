/**
 * Cloudflare Queue Consumer for processing push notifications via FCM HTTP v1 API.
 *
 * This runs separately from the API, consuming messages from the 'dr-physics-notifications' queue.
 * Each message contains target tokens and notification payload.
 */

import type { Env, NotificationMessage } from '../types';

interface GoogleAccessToken {
  access_token: string;
  expires_at: number;
}

/**
 * Get Google OAuth2 access token from service account credentials.
 * Caches the token in KV to avoid repeated token generation.
 */
async function getGoogleAccessToken(env: Env): Promise<string> {
  // Check KV cache first
  const cached = await env.KV.get('google:access_token', 'json') as GoogleAccessToken | null;
  if (cached && cached.expires_at > Date.now() / 1000 + 300) {
    return cached.access_token;
  }

  // Parse service account JSON
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as {
    client_email: string;
    private_key: string;
    token_uri: string;
    project_id: string;
  };

  // Create JWT for Google OAuth2
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const signingInput = `${encodedHeader}.${encodedClaim}`;

  // Import RSA private key
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBuffer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const signature = base64UrlEncode(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  const jwt = `${signingInput}.${signature}`;

  // Exchange JWT for access token
  const tokenResp = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResp.ok) {
    throw new Error(`Failed to get access token: ${tokenResp.status} ${await tokenResp.text()}`);
  }

  const tokenData = await tokenResp.json() as { access_token: string; expires_in: number };

  // Cache in KV
  const tokenCache: GoogleAccessToken = {
    access_token: tokenData.access_token,
    expires_at: now + tokenData.expires_in,
  };
  await env.KV.put('google:access_token', JSON.stringify(tokenCache), {
    expirationTtl: tokenData.expires_in - 300,
  });

  return tokenData.access_token;
}

/**
 * Send a single FCM notification via HTTP v1 API.
 */
async function sendFCMNotification(
  projectId: string,
  accessToken: string,
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message: Record<string, unknown> = {
    message: {
      token,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: { sound: 'default', click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
      data: data || {},
    },
  };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, error: err };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Queue consumer handler — processes batches of notification messages.
 */
export async function handleNotificationQueue(
  batch: MessageBatch<NotificationMessage>,
  env: Env
): Promise<void> {
  // Get service account project ID
  let projectId: string;
  try {
    const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    projectId = sa.project_id;
  } catch {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON');
    batch.ackAll();
    return;
  }

  // Get access token
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (e) {
    console.error('Failed to get Google access token:', e);
    batch.retryAll();
    return;
  }

  for (const message of batch.messages) {
    const payload = message.body;

    try {
      const tokens = payload.tokens || [];

      if (tokens.length === 0 && payload.type !== 'topic') {
        message.ack();
        continue;
      }

      // Send to each token (FCM v1 doesn't support true multicast)
      const results = await Promise.allSettled(
        tokens.map(token =>
          sendFCMNotification(projectId, accessToken, token, payload.title, payload.body, payload.data)
        )
      );

      // Check for invalid tokens (remove from DB)
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && !result.value.success) {
          const errorStr = result.value.error || '';
          if (errorStr.includes('NOT_FOUND') || errorStr.includes('UNREGISTERED')) {
            // Remove invalid token from BOTH token stores
            await env.DB.prepare('UPDATE devices SET push_token = NULL WHERE push_token = ?')
              .bind(tokens[i]).run();
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE push_token = ?')
              .bind(tokens[i]).run();
          }
        }
      }

      message.ack();
    } catch (e) {
      console.error('Error processing notification message:', e);
      message.retry();
    }
  }
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendNotificationDirectly(
  env: Env,
  payload: NotificationMessage
): Promise<void> {
  let projectId: string;
  try {
    const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    projectId = sa.project_id;
  } catch {
    console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON');
    return;
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (e) {
    console.error('Failed to get Google access token:', e);
    return;
  }

  const tokens = payload.tokens || [];
  if (tokens.length === 0) return;

  const results = await Promise.allSettled(
    tokens.map(token =>
      sendFCMNotification(projectId, accessToken, token, payload.title, payload.body, payload.data)
    )
  );

  // Clean invalid tokens from DB
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && !result.value.success) {
      const errorStr = result.value.error || '';
      if (errorStr.includes('NOT_FOUND') || errorStr.includes('UNREGISTERED')) {
        await env.DB.prepare('UPDATE devices SET push_token = NULL WHERE push_token = ?')
          .bind(tokens[i]).run();
      }
    }
  }
}


import type { D1Database, KVNamespace, R2Bucket, Queue } from '@cloudflare/workers-types';

// ── Cloudflare Bindings ──
export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  R2_VIDEO?: R2Bucket;
  VIDEO_QUEUE: Queue;
  // Variables
  ENVIRONMENT: string;
  CF_PAGES?: string;
  CORS_ORIGIN: string;
  CF_ACCOUNT_ID: string;
  PLATFORM_KEY: string;
  BUNNY_LIBRARY_ID?: string;
  BUNNY_CDN_HOST?: string;
  MAX_SUBREQUESTS?: string;
  VIDEO_CDN_HOST?: string;
  // النطاق العام للـ API — يُستخدم كـ Referer عند جلب الفيديوهات من Bunny CDN.
  // يُضبط بعد النشر، وعند تركه فارغاً يُحذف هيدر الـ Referer.
  PUBLIC_API_ORIGIN?: string;
  // Secrets (set via wrangler secret put)
  // AUTH_SECRET — مفتاح HMAC لتوقيع رموز الوصول (HS256) ولرموز تشغيل الفيديو.
  // لم يعد هناك أي اعتماد على Supabase.
  AUTH_SECRET: string;
  FIREBASE_SERVICE_ACCOUNT_JSON: string;
  // API_SIGNING_SECRET intentionally removed: the HMAC request-signing middleware was
  // deleted because the shared secret was shipped in the web client bundle and the
  // server failed open when the secret was unset, providing no real protection.
  // Authenticity is enforced solely by our own HS256 access tokens (AUTH_SECRET).
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_NAME?: string;
  BUNNY_API_KEY?: string;
}

// ── Video Transfer Queue Message ──
export type VideoTransferMessage =
  | { type: 'check_encoding'; lessonId: string; videoId: string; bunnyGuid: string; attempt: number }
  | { 
      type: 'transfer_quality'; 
      lessonId: string; 
      videoId: string; 
      bunnyGuid: string; 
      quality: string; 
      playlistUrl: string;
      segmentStartIndex?: number;
    }
  | {
      type: 'finalize';
      lessonId: string;
      videoId: string;
      bunnyGuid: string;
      qualities: string[];
      // Bounded retry counter for the R2-verification-before-delete step in
      // handleFinalize: incremented each time verification finds a quality
      // still missing from R2 and re-queues transfer + finalize. Undefined/0
      // on the first attempt.
      verifyAttempt?: number;
    };


// ── Auth Context ──
export interface AuthUser {
  id: string;
  /**
   * @deprecated أثر تاريخي من Supabase — لم يعد المصادقة تعتمد عليه.
   * يبقى الحقل محمولاً حتى لا تتغيّر واجهة requireAuth التي تعتمد عليها بقية المسارات.
   */
  supabaseUserId: string;
  email: string;
  role: 'admin' | 'assistant' | 'student';
  status: 'active' | 'blocked';
  fullName: string;
  maxDevices: number;
  grade?: string | null;
  branch?: string | null;
}

// ── Pagination ──
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

// ── API Error ──
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ── Notification Queue Message ──
export interface NotificationMessage {
  type: 'single' | 'multicast' | 'topic';
  tokens?: string[];
  topic?: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  notificationId?: string;
}

// ── Hono Variables (context) ──
export type HonoBindings = {
  Bindings: Env;
  Variables: {
    user: AuthUser;
    deviceId?: string;
    appVersion?: string;
    platform?: string;
    clientIp?: string;
    auditTargetType?: string;
    auditTargetId?: string;
    auditMeta?: Record<string, any>;
  };
};

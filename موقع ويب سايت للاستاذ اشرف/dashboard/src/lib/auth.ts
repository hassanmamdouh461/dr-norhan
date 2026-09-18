/**
 * عميل مصادقة لوحة التحكم — Cloudflare Worker أصلي (لا مزوّد هوية خارجي).
 *
 * العقد (نفس عقد تطبيق الطالب):
 *   POST /auth/login     { email | phone, password } -> { access_token, refresh_token, user }
 *   POST /auth/refresh   { refresh_token }           -> { access_token, refresh_token }
 *   POST /auth/logout    (auth)                      -> { ok }
 *   GET  /auth/me        (auth)                      -> { user }
 *   POST /auth/forgot-password { email }             -> { ok }
 *   POST /auth/reset-password  { token, password }   -> { ok }
 *
 * كل طلب محمي يحمل ترويستين إلزاميتين يفرضهما حارس CSRF في الـ Worker:
 *   Authorization: Bearer <access_token>
 *   X-Requested-With: XMLHttpRequest
 */
import { API_BASE } from './config';

const ACCESS_TOKEN_KEY = 'fusha_dashboard_access_token';
const REFRESH_TOKEN_KEY = 'fusha_dashboard_refresh_token';

/** يُطلق عند انتهاء الجلسة فعلاً (فشل تجديد الرمز) أو عند تسجيل الخروج. */
export const AUTH_STATUS_EVENT = 'fusha-dashboard-auth-status-change';

export interface DashboardUser {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

const REQUEST_TIMEOUT_MS = 20000;

// ── مخزن الرموز ───────────────────────────────────────────────────────────
// القرار: localStorage حتى تبقى جلسة المشرف بعد إعادة تحميل الصفحة.
// المقايضة: أي XSS على نفس الأصل يستطيع قراءة رمز الوصول؛ تُخفَّف المخاطرة
// بعمر الرمز القصير + تجديده عبر /auth/refresh + رأس X-Requested-With الذي
// يمنع طلبات النماذج المتقاطعة. لا يوجد حقن HTML غير موثوق في اللوحة.
let accessToken: string | null = null;
let refreshToken: string | null = null;
let hydrated = false;

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === 'undefined') return;
  try {
    accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    accessToken = null;
    refreshToken = null;
  }
}

export function getAccessToken(): string | null {
  hydrate();
  return accessToken;
}

export function setTokens(tokens: AuthTokens): void {
  hydrate();
  accessToken = tokens.access_token || null;
  refreshToken = tokens.refresh_token || null;
  if (typeof window === 'undefined') return;
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* الذاكرة كافية */
  }
}

export function clearSession(): void {
  hydrate();
  accessToken = null;
  refreshToken = null;
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('fusha_dashboard_session');
  } catch {
    /* تجاهل */
  }
}

function broadcastAuthStatusChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_STATUS_EVENT));
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ── HTTP ──────────────────────────────────────────────────────────────────

async function requestJson<T>(
  path: string,
  options: RequestInit & { withAuth?: boolean } = {},
): Promise<T> {
  const { withAuth = false, ...init } = options;

  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('X-Platform', 'web');
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw { code: 'TIMEOUT', message: 'استغرق الطلب وقتًا أطول من المعتاد. يرجى المحاولة مرة أخرى.', status: 0 } as ApiError;
    }
    throw { code: 'NETWORK_ERROR', message: 'تعذر الاتصال بالخدمة. تحقق من اتصال الإنترنت ثم أعد المحاولة.', status: 0 } as ApiError;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as any));
    throw {
      code: body?.error?.code || 'UNKNOWN_ERROR',
      message: body?.error?.message || `API error (${response.status})`,
      status: response.status,
    } as ApiError;
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

// ── تجديد الرمز (طلب واحد فقط في أي لحظة) ────────────────────────────────
let refreshInFlight: Promise<AuthTokens | null> | null = null;

export function refreshSession(): Promise<AuthTokens | null> {
  if (refreshInFlight) return refreshInFlight;

  hydrate();
  const token = refreshToken;
  if (!token) return Promise.resolve(null);

  refreshInFlight = (async () => {
    try {
      const data = await requestJson<{ access_token: string; refresh_token: string }>(
        '/auth/refresh',
        { method: 'POST', body: JSON.stringify({ refresh_token: token }) },
      );
      const tokens = { access_token: data.access_token, refresh_token: data.refresh_token };
      setTokens(tokens);
      return tokens;
    } catch {
      // رمز التجديد منتهٍ أو مُبطَل — الجلسة انتهت فعلاً.
      clearSession();
      broadcastAuthStatusChange();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * طلب محمي مع تجديد تلقائي مرة واحدة عند 401.
 * إن فشل التجديد نُطلق حدث انتهاء الجلسة ونعيد رمي الخطأ الأصلي.
 */
export async function authorizedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  try {
    return await requestJson<T>(path, { ...options, withAuth: true });
  } catch (err) {
    const apiErr = err as ApiError;
    if (apiErr.status !== 401) throw err;

    const refreshed = await refreshSession();
    if (!refreshed) throw err;

    return requestJson<T>(path, { ...options, withAuth: true });
  }
}

// ── نقاط النهاية ──────────────────────────────────────────────────────────

/** تسجيل دخول المشرف/المساعد. يرمي ApiError بـ 401 عند بيانات خاطئة. */
export async function login(email: string, password: string): Promise<DashboardUser> {
  const data = await requestJson<{ access_token: string; refresh_token: string; user: DashboardUser }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), password }) },
  );
  setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await authorizedRequest('/auth/logout', { method: 'POST' });
  } catch {
    // حتى لو فشل إبلاغ الخادم، نُنهي الجلسة محلياً.
  } finally {
    clearSession();
  }
}

/** يُعيد ملف المستخدم الحالي (يفكّ غلاف { user }). */
export async function getMe(): Promise<DashboardUser> {
  const data = await authorizedRequest<{ user: DashboardUser } | DashboardUser>('/auth/me');
  return (data as { user?: DashboardUser }).user ?? (data as DashboardUser);
}

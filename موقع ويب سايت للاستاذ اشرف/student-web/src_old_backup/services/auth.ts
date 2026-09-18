/**
 * عميل المصادقة — Cloudflare Worker أصلي (لا مزوّد هوية خارجي).
 *
 * العقد:
 *   POST /auth/register  { email, password, full_name, phone?, grade?, branch? } -> { access_token, refresh_token, user }
 *   POST /auth/login     { email | phone, password }                             -> { access_token, refresh_token, user }
 *   POST /auth/refresh   { refresh_token }                                       -> { access_token, refresh_token }
 *   POST /auth/logout    (auth)                                                  -> { ok }
 *   GET  /auth/me        (auth)                                                  -> { user }
 *   PATCH /auth/me       (auth)                                                  -> { user }
 *   POST /auth/forgot-password { email }                                         -> { ok }
 *   POST /auth/reset-password  { token, password }                               -> { ok }
 *
 * كل طلب محمي يحمل ترويستين إلزاميتين:
 *   Authorization: Bearer <access_token>
 *   X-Requested-With: XMLHttpRequest   ← حارس CSRF في الـ Worker يرفض الطلب بدونهما.
 */
import { apiUrl } from './config';

// ── تخزين الرموز ──────────────────────────────────────────────────────────
// القرار: localStorage (لا الذاكرة فقط) حتى تبقى الجلسة بعد إعادة تحميل الصفحة
// أو فتح تبويب جديد — وهو سلوك التطبيق الحالي.
// المقايضة الأمنية: localStorage مقروء من أي سكربت يعمل على نفس الأصل، لذا فإن
// أي XSS يسمح بسرقة رمز الوصول. تُخفَّف المخاطرة بأن:
//   1) عمر رمز الوصول قصير، ويُجدَّد عبر /auth/refresh؛
//   2) الـ Worker يفرض رأس X-Requested-With فيرفض طلبات النماذج المتقاطعة (CSRF)؛
//   3) لا يوجد أي حقن HTML غير موثوق في التطبيق (React يهرّب النصوص تلقائياً).
// الترقية المستقبلية إن لزم تشديد أعلى: تخزين رمز التجديد في كوكي HttpOnly
// من جهة الـ Worker، وإبقاء رمز الوصول في الذاكرة فقط.
const ACCESS_TOKEN_KEY = 'fusha_access_token';
const REFRESH_TOKEN_KEY = 'fusha_refresh_token';

export const AUTH_STATUS_EVENT = 'auth-status-change';

export interface AuthUser {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  parent_phone?: string | null;
  grade?: string | null;
  branch?: string | null;
  governorate?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  streak_count?: number | null;
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

const REQUEST_TIMEOUT_MS = 15000;

// ── مخزن الرموز ───────────────────────────────────────────────────────────
let accessToken: string | null = null;
let refreshToken: string | null = null;
let hydrated = false;

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    // التخزين محجوب (وضع التصفح الخاص/سياسة الكوكيز) — نكتفي بالذاكرة.
    accessToken = null;
    refreshToken = null;
  }
}

export function getAccessToken(): string | null {
  hydrate();
  return accessToken;
}

export function getRefreshToken(): string | null {
  hydrate();
  return refreshToken;
}

export function setTokens(tokens: AuthTokens): void {
  hydrate();
  accessToken = tokens.access_token || null;
  refreshToken = tokens.refresh_token || null;
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    else localStorage.removeItem(ACCESS_TOKEN_KEY);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    else localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    /* الذاكرة كافية */
  }
}

export function clearTokens(): void {
  hydrate();
  accessToken = null;
  refreshToken = null;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('student_profile');
  } catch {
    /* تجاهل */
  }
}

/** يُبلّغ بقية التطبيق (AuthContext) بأن الجلسة انتهت. */
function broadcastAuthStatusChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_STATUS_EVENT));
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

// ── أدوات HTTP ────────────────────────────────────────────────────────────

function toApiError(err: unknown, fallbackMessage: string): ApiError {
  const anyErr = err as Partial<ApiError> & { name?: string };
  if (anyErr?.name === 'AbortError') {
    return { code: 'TIMEOUT', message: 'انتهت مهلة الاتصال بالخادم. يرجى المحاولة مرة أخرى.', status: 0 };
  }
  if (typeof anyErr?.status === 'number') {
    return { code: anyErr.code || 'UNKNOWN_ERROR', message: anyErr.message || fallbackMessage, status: anyErr.status };
  }
  return { code: 'NETWORK_ERROR', message: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.', status: 0 };
}

/**
 * طلب JSON خام إلى الـ Worker مع مهلة زمنية وتوحيد شكل الخطأ.
 * `withAuth` يضيف ترويسة Bearer + حارس CSRF.
 */
async function requestJson<T>(
  path: string,
  options: RequestInit & { withAuth?: boolean } = {},
): Promise<T> {
  const { withAuth = false, ...init } = options;

  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    throw toApiError(err, 'فشل الاتصال بالخادم');
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

// ── تجديد الرمز ───────────────────────────────────────────────────────────
// طلب واحد فقط يجري في أي لحظة: لو أطلق 5 طلبات متزامنة تجديداً، ننتظر جميعها
// على نفس الوعد بدل إغراق الخادم بـ 5 عمليات تدوير رموز.
let refreshInFlight: Promise<AuthTokens | null> | null = null;

export function refreshSession(): Promise<AuthTokens | null> {
  if (refreshInFlight) return refreshInFlight;

  const token = getRefreshToken();
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
      // رمز التجديد نفسه منتهٍ أو مُبطَل — الجلسة انتهت فعلاً.
      clearTokens();
      broadcastAuthStatusChange();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * تنفيذ طلب محمي مع تجديد تلقائي مرة واحدة عند 401.
 * إن فشل التجديد نُطلق حدث انتهاء الجلسة ونُعيد الخطأ الأصلي.
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

// ── نقاط النهاية العامة ───────────────────────────────────────────────────

export async function login(payload: { email?: string; phone?: string; password: string }) {
  const body: Record<string, string> = { password: payload.password };
  if (payload.email) body.email = payload.email;
  if (payload.phone) body.phone = payload.phone;

  const data = await requestJson<{ access_token: string; refresh_token: string; user: AuthUser }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify(body) },
  );
  setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
  return data.user;
}

export async function register(payload: {
  email?: string;
  password: string;
  full_name: string;
  phone?: string;
  grade?: string;
  branch?: string;
  parent_phone?: string;
  governorate?: string;
}) {
  const data = await requestJson<{ access_token: string; refresh_token: string; user: AuthUser }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  setTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await authorizedRequest('/auth/logout', { method: 'POST' });
  } catch {
    // حتى لو فشل إبلاغ الخادم، نُنهي الجلسة محلياً — لا نُبقي الطالب عالقاً.
  } finally {
    clearTokens();
  }
}

export async function getMe(): Promise<AuthUser> {
  const data = await authorizedRequest<{ user: AuthUser } | AuthUser>('/auth/me');
  // الـ Worker يُعيد { user }؛ نتحمّل الشكلين حتى لا ننكسر لو رجع الكائن مسطّحاً.
  return (data as { user?: AuthUser }).user ?? (data as AuthUser);
}

export async function updateMe(updates: Record<string, unknown>): Promise<AuthUser> {
  const data = await authorizedRequest<{ user: AuthUser } | AuthUser>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return (data as { user?: AuthUser }).user ?? (data as AuthUser);
}

export async function forgotPassword(email: string): Promise<void> {
  await requestJson('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await requestJson('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

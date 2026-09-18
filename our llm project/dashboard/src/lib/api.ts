import { supabase } from './supabase';
import { isMockMode } from './mock-mode';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://alhadaba-chemistry-api.lolelarap.workers.dev';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

const networkMessage = 'تعذر الاتصال بالخدمة. تحقق من اتصال الإنترنت ثم أعد المحاولة.';

function getReadableErrorMessage(status: number, message?: string) {
  const normalized = (message || '').trim();

  if (status === 401) return 'انتهت جلسة الدخول. يرجى تسجيل الدخول مرة أخرى.';
  if (status === 403) return 'ليس لديك صلاحية لتنفيذ هذا الإجراء.';
  if (status === 404) return 'لم يتم العثور على البيانات المطلوبة.';
  if (status === 409) return 'لا يمكن إكمال الإجراء بسبب تعارض في البيانات. حدّث الصفحة ثم أعد المحاولة.';
  if (status === 429) return 'تم إرسال طلبات كثيرة بسرعة. انتظر قليلًا ثم حاول مرة أخرى.';
  if (status >= 500) return 'حدثت مشكلة مؤقتة في الخدمة. حاول مرة أخرى بعد قليل.';

  if (!normalized || /network error|failed to fetch|fetch failed/i.test(normalized)) {
    return networkMessage;
  }

  if (!/[\u0600-\u06FF]/.test(normalized)) {
    return 'تعذر تنفيذ الطلب. راجع البيانات ثم أعد المحاولة.';
  }

  return normalized;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return session.access_token;
  }

  // Fallback to localStorage session (for Mock Mode)
  if (typeof window !== 'undefined') {
    const localSession = localStorage.getItem('chemistry_dashboard_session');
    if (localSession) {
      try {
        const parsed = JSON.parse(localSession);
        return parsed.token || null;
      } catch {
        return null;
      }
    }
  }

  return null;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  if (isMockMode()) {
    if (options.method && options.method !== 'GET') {
      if (path === '/admin/notifications/send') {
        return { ok: true, tokens_count: 125 } as unknown as T;
      }
      return { ok: true } as unknown as T;
    }
    throw new Error('هذه نسخة عرض محلية ولا توجد بيانات متصلة حاليًا.');
  }

  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Platform': 'web',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Read and inject CSRF token from cookies
  const csrfCookie = typeof document !== 'undefined'
    ? document.cookie.split('; ').find(row => row.startsWith('csrf_token='))?.split('=')[1]
    : null;
  if (csrfCookie) {
    headers['X-CSRF-Token'] = csrfCookie;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('استغرق الطلب وقتًا أطول من المعتاد. يرجى المحاولة مرة أخرى.');
    }
    throw new Error(networkMessage);
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chemistry_dashboard_session');
      await supabase.auth.signOut().catch(() => {});
      window.location.href = '/login';
    }
    throw new Error('التوكن غير صالح أو منتهي الصلاحية. يرجى تسجيل الدخول مرة أخرى.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Network error' } }));
    throw new Error(getReadableErrorMessage(res.status, (err as any).error?.message));
  }

  return res.json() as Promise<T>;
}

// Convenience methods
export const apiGet = <T = unknown>(path: string) => api<T>(path);
export const apiPost = <T = unknown>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const apiPatch = <T = unknown>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T = unknown>(path: string) => api<T>(path, { method: 'DELETE' });

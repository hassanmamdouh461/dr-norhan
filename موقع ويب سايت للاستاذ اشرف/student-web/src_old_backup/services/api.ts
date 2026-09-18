import { API_BASE_URL, apiUrl } from './config';
import { getAccessToken, refreshSession, clearTokens } from './auth';

// المسارات التي يجوز أن تفشل بـ 401 دون إنهاء الجلسة (خطأ بيانات دخول، لا جلسة منتهية).
const AUTH_ENTRY_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

const REQUEST_TIMEOUT_MS = 15000;

// ── Unique Browser/Device ID ──
export function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      deviceId = 'web-client-' + crypto.randomUUID();
    } else {
      deviceId = 'web-client-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

// ── Generic Fetch API Wrapper ──
/**
 * طلب واحد إلى الـ Worker يحمل:
 *   Authorization: Bearer <access_token>   (إن وُجدت جلسة)
 *   X-Requested-With: XMLHttpRequest        (حارس CSRF)
 *   X-Device-Id / X-Platform / X-App-Version
 * ويُجدِّد الجلسة تلقائياً مرة واحدة عند 401 ثم يُعيد المحاولة.
 */
async function rawRequest<T>(
  path: string,
  options: RequestInit,
  includeAuth: boolean,
): Promise<T> {
  const url = apiUrl(path);
  const deviceId = getDeviceId();

  const headers = new Headers(options.headers || {});
  // طلبات تحميل الملفات (ArrayBuffer) تحمل نوع محتواها الخاص — لا ندهسه بـ JSON.
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('X-Device-Id', deviceId);
  headers.set('X-Platform', 'web');
  headers.set('X-App-Version', '1.0.0');

  // رمز CSRF من الكوكي إن وُجد (يكمّل حارس X-Requested-With).
  const csrfCookie = typeof document !== 'undefined'
    ? document.cookie.split('; ').find(row => row.startsWith('csrf_token='))?.split('=')[1]
    : null;
  if (csrfCookie) headers.set('X-CSRF-Token', csrfCookie);

  if (includeAuth) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw { code: 'TIMEOUT', message: 'انتهت مهلة الاتصال بالخادم. يرجى المحاولة مرة أخرى.', status: 0 };
    }
    throw { code: 'NETWORK_ERROR', message: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.', status: 0 };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `API error (${response.status})`;
    const code = errorData.error?.code || 'UNKNOWN_ERROR';
    throw { code, message, status: response.status };
  }

  // Handle redirects (e.g. file download presigned URLs)
  if (response.redirected) {
    return response.url as any;
  }

  if (response.status === 204) return {} as T;

  return response.json();
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    return await rawRequest<T>(path, options, true);
  } catch (err: any) {
    // 401 على مسار دخول = بيانات خاطئة، لا جلسة منتهية.
    if (err?.status !== 401 || AUTH_ENTRY_PATHS.has(path)) {
      throw err;
    }

    // جلسة منتهية أو رمز مُبطَل → جدّد مرة واحدة ثم أعد المحاولة.
    const refreshed = await refreshSession();
    if (!refreshed) {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth-status-change'));
      }
      throw err;
    }

    return rawRequest<T>(path, options, true);
  }
}

// ── API Services Endpoints ──
export const ApiService = {
  // ── Public settings (بيانات وصفية للقوائم: السنوات الدراسية والفروع) ──
  // لا تُعيد رمي الخطأ: الشاشات التي تستهلكها لديها قيم افتراضية، وفشل هذا
  // الطلب يجب ألا يمنع تحميل صفحة الملف الشخصي.
  async getPublicSettings(): Promise<{ academic_years: string[]; branches: string[] }> {
    try {
      return await apiRequest<{ academic_years: string[]; branches: string[] }>('/auth/public-settings');
    } catch {
      return { academic_years: [], branches: [] };
    }
  },

  // ── Profile ──
  // ملاحظة: قراءة الملف الشخصي تتم عبر getMe() في services/auth.ts (تُفكّ
  // غلاف { user } وتتعامل مع تجديد الرمز). أما الكتابة فتظل هنا.
  async updateProfile(updates: Record<string, any>) {
    return apiRequest('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async uploadAvatar(file: File): Promise<{ ok: boolean; avatar_url: string }> {
    // Read file as ArrayBuffer and send as body
    const buffer = await file.arrayBuffer();
    return apiRequest('/auth/me/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
      },
      body: buffer as any, // fetch supports arraybuffer body
    });
  },

  async registerDevice(deviceInfo: {
    device_id: string;
    platform: string;
    model?: string;
    push_token?: string;
    is_rooted?: boolean;
  }) {
    return apiRequest('/auth/me/devices', {
      method: 'POST',
      body: JSON.stringify(deviceInfo),
    });
  },

  async getMyDevices() {
    return apiRequest('/auth/me/devices');
  },

  async deleteDevice(id: string) {
    return apiRequest(`/auth/me/devices/${id}`, {
      method: 'DELETE',
    });
  },

  async getMyFinancials() {
    return apiRequest('/auth/me/financials');
  },

  async getMyPlaybackLogs() {
    return apiRequest('/auth/me/playback-logs');
  },

  async getMyQuizAttempts() {
    return apiRequest('/auth/me/quizzes/attempts');
  },

  async submitDeviceResetRequest(data: {
    device_id: string;
    platform: string;
    model?: string;
    reason: string;
    proof_image_url?: string;
  }) {
    return apiRequest('/auth/me/devices/reset-request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getMyDeviceResetRequests() {
    return apiRequest('/auth/me/devices/reset-requests');
  },

  // ── Courses ──
  async getCourses(page = 1, grade?: string) {
    let url = `/courses?page=${page}`;
    if (grade) url += `&grade=${encodeURIComponent(grade)}`;
    return apiRequest(url);
  },

  async getMyCourses() {
    return apiRequest('/courses/me');
  },

  async getCourseDetails(courseId: string) {
    return apiRequest(`/courses/${courseId}`);
  },

  async getLessonDetails(lessonId: string) {
    return apiRequest(`/courses/lessons/${lessonId}`);
  },

  async getCourseProgress(courseId: string) {
    return apiRequest(`/courses/${courseId}/progress`);
  },

  // ── Playback & Heartbeats ──
  async getPlaybackUrl(lessonId: string) {
    return apiRequest(`/lessons/${lessonId}/playback`, {
      method: 'POST',
    });
  },

  async sendHeartbeat(data: {
    lesson_id: string;
    position: number;
    watched_seconds?: number;
  }) {
    return apiRequest('/playback/heartbeat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async sendPlaybackLog(lessonId: string, action: 'open' | 'close', positionSeconds: number) {
    return apiRequest(`/lessons/${lessonId}/playback/logs`, {
      method: 'POST',
      body: JSON.stringify({ action, position_seconds: positionSeconds }),
    });
  },

  // Helper to fetch file bytes (like PDF downloads)
  async getFileBlob(url: string): Promise<Blob> {
    const cleanUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const token = getAccessToken();

    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      'X-Device-Id': getDeviceId(),
      'X-Platform': 'web',
      'X-App-Version': '1.0.0',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Since file downloads are redirected to presigned R2 URLs, we handle this
    const response = await fetch(cleanUrl, { headers, redirect: 'follow' });
    if (!response.ok) {
      throw new Error('فشل تحميل الملف');
    }
    return response.blob();
  },

  // ── Codes ──
  async redeemCode(code: string, courseId?: string) {
    return apiRequest('/codes/redeem', {
      method: 'POST',
      body: JSON.stringify({ code, course_id: courseId }),
    });
  },

  async verifyCode(code: string) {
    return apiRequest(`/codes/verify/${encodeURIComponent(code)}`);
  },

  // ── Questions (Q&A) ──
  async getQuestions(params: { lessonId?: string; courseId?: string; page?: number } = {}) {
    let url = '/questions?';
    if (params.page) url += `page=${params.page}&`;
    if (params.lessonId) url += `lesson_id=${params.lessonId}&`;
    if (params.courseId) url += `course_id=${params.courseId}&`;
    return apiRequest(url.slice(0, -1));
  },

  async getQuestionDetails(questionId: string) {
    return apiRequest(`/questions/${questionId}`);
  },

  async askQuestion(data: { body: string; lesson_id?: string; course_id?: string }) {
    return apiRequest('/questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ── Quizzes / Homework ──
  async getLessonQuiz(lessonId: string) {
    return apiRequest(`/courses/lessons/${lessonId}/quiz`);
  },

  async submitQuizAnswers(lessonId: string, answers: Record<string, string>) {
    return apiRequest(`/courses/lessons/${lessonId}/quiz/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  // ── Standalone Exams ──
  async getExams() {
    return apiRequest('/courses/exams');
  },

  async getExamDetails(examId: string) {
    return apiRequest(`/courses/exams/${examId}`);
  },

  async submitExamAnswers(examId: string, answers: Record<string, string>) {
    return apiRequest(`/courses/exams/${examId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  // ── Public Non-Auth Exams ──
  async getPublicExams() {
    return apiRequest('/courses/public-exams');
  },

  async getPublicExamDetails(examId: string) {
    return apiRequest(`/courses/public-exams/${examId}`);
  },

  async submitPublicExamAnswers(examId: string, answers: Record<string, string>) {
    return apiRequest(`/courses/public-exams/${examId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  // ── Dictionary (معجم فُصحى) ──
  async searchDictionary(q: string, opts: { type?: string; tag?: string; limit?: number } = {}) {
    const params = new URLSearchParams({ q });
    if (opts.type) params.set('type', opts.type);
    if (opts.tag) params.set('tag', opts.tag);
    if (opts.limit) params.set('limit', String(opts.limit));
    return apiRequest(`/dictionary?${params.toString()}`);
  },

  async suggestDictionary(q: string, limit = 8) {
    return apiRequest(`/dictionary/suggest?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  async getPopularDictionary(limit = 12) {
    return apiRequest(`/dictionary/popular?limit=${limit}`);
  },

  async getDictionaryEntry(id: string) {
    return apiRequest(`/dictionary/${id}`);
  },

  async getDictionaryWord(word: string) {
    return apiRequest(`/dictionary/word/${encodeURIComponent(word)}`);
  },

  // ── بنك الأسئلة (Question Bank) ──
  async getQuestionBank(params: {
    q?: string;
    type?: string;
    difficulty?: string;
    tag?: string;
    course_id?: string;
    lesson_id?: string;
    unit_id?: string;
    bloom_level?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  } = {}) {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.type) search.set('type', params.type);
    if (params.difficulty) search.set('difficulty', params.difficulty);
    if (params.tag) search.set('tag', params.tag);
    if (params.course_id) search.set('course_id', params.course_id);
    if (params.lesson_id) search.set('lesson_id', params.lesson_id);
    if (params.unit_id) search.set('unit_id', params.unit_id);
    if (params.bloom_level) search.set('bloom_level', params.bloom_level);
    if (params.sort) search.set('sort', params.sort);
    if (params.order) search.set('order', params.order);
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiRequest(`/question-bank${qs ? `?${qs}` : ''}`);
  },

  async getQuestionBankTags() {
    return apiRequest('/question-bank/tags');
  },

  async getRandomQuestions(body: {
    count: number;
    type?: string;
    difficulty?: string;
    tags?: string[];
    course_id?: string;
    lesson_id?: string;
    exclude_ids?: string[];
  }) {
    return apiRequest('/question-bank/random', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getQuestionBankQuestion(id: string) {
    return apiRequest(`/question-bank/${encodeURIComponent(id)}`);
  },

  // ── بنك الأسئلة — واجهة الطالب (إجابات مخفية) ──
  // هذه المسارات لا تُعيد correct_answer ولا explanation أبداً؛
  // كشف الإجابة يتم فقط عبر checkPublicAnswer بعد محاولة.
  async getPublicQuestionBank(params: {
    q?: string;
    type?: string;
    difficulty?: string;
    tag?: string;
    course_id?: string;
    lesson_id?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  } = {}) {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (params.type) search.set('type', params.type);
    if (params.difficulty) search.set('difficulty', params.difficulty);
    if (params.tag) search.set('tag', params.tag);
    if (params.course_id) search.set('course_id', params.course_id);
    if (params.lesson_id) search.set('lesson_id', params.lesson_id);
    if (params.sort) search.set('sort', params.sort);
    if (params.order) search.set('order', params.order);
    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    const qs = search.toString();
    return apiRequest(`/question-bank/public${qs ? `?${qs}` : ''}`);
  },

  async getPublicQuestionBankTags() {
    return apiRequest('/question-bank/public/tags');
  },

  async getPublicRandomQuestions(body: {
    count: number;
    type?: string;
    difficulty?: string;
    tags?: string[];
    course_id?: string;
    lesson_id?: string;
    exclude_ids?: string[];
  }) {
    return apiRequest('/question-bank/public/random', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /**
   * تصحيح سؤال واحد على الخادم. هذا هو الموضع الوحيد الذي يستلم فيه
   * الطالب مفتاح الإجابة والشرح.
   */
  async checkPublicAnswer(questionId: string, answer: unknown) {
    return apiRequest('/question-bank/public/check', {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId, answer }),
    });
  },

  // ── Notifications ──
  async getNotifications() {
    return apiRequest('/courses/notifications/list');
  },

  async markNotificationRead(id: string) {
    return apiRequest(`/courses/notifications/${id}/read`, {
      method: 'POST',
    });
  },
};

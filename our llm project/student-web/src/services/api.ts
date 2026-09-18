import supabase from './supabase';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'https://api.alhadaba-chemistry.synapticstudio.tech';

const REQUEST_TIMEOUT_MS = 15000;
const SESSION_TIMEOUT_MS = 8000;

// Races a promise against a timeout, resolving to `fallback` instead of hanging
// forever if the underlying call (network/Supabase) never settles.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); }
    );
  });
}

// Wraps supabase.auth.getSession() so a stalled network/token-refresh call
// can't block the whole app's loading state indefinitely.
export function getSessionSafe() {
  return withTimeout(
    supabase.auth.getSession(),
    SESSION_TIMEOUT_MS,
    { data: { session: null }, error: null } as Awaited<ReturnType<typeof supabase.auth.getSession>>
  );
}

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
export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${apiBaseUrl}${path}`;
  const deviceId = getDeviceId();

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('X-Device-Id', deviceId);
  headers.set('X-Platform', 'web');
  headers.set('X-App-Version', '1.0.0');

  // Read and inject CSRF token from cookies
  const csrfCookie = typeof document !== 'undefined' 
    ? document.cookie.split('; ').find(row => row.startsWith('csrf_token='))?.split('=')[1]
    : null;
  if (csrfCookie) {
    headers.set('X-CSRF-Token', csrfCookie);
  }

  // Inject Supabase JWT token if session exists
  const { data: { session } } = await getSessionSafe();
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
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
    
    // Auto signout on 401 Unauthorized (unless it's during login check)
    if (response.status === 401 && path !== '/auth/sync-first') {
      await supabase.auth.signOut();
      localStorage.removeItem('student_profile');
      window.dispatchEvent(new Event('auth-status-change'));
    }

    throw { code, message, status: response.status };
  }

  // Handle redirects (e.g. file download presigned URLs)
  if (response.redirected) {
    return response.url as any;
  }

  return response.json();
}

// ── API Services Endpoints ──
export const ApiService = {
  // ── Auth & Profile ──

  async checkEmailExists(email: string) {
    return apiRequest<{ exists: boolean }>(`/auth/check-email?email=${encodeURIComponent(email)}`);
  },

  async getPublicSettings() {
    return apiRequest<{ academic_years: string[]; branches: string[] }>('/auth/public-settings');
  },

  async syncProfile(profileData: {
    full_name?: string;
    phone?: string;
    parent_phone?: string;
    grade?: string;
    branch?: string;
    governorate?: string;
  }, token?: string) {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    return apiRequest('/auth/sync-first', {
      method: 'POST',
      body: JSON.stringify(profileData),
      headers,
    });
  },

  async getProfile(token?: string) {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    return apiRequest('/auth/me', { headers });
  },

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
  }, token?: string) {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : undefined;
    return apiRequest('/auth/me/devices', {
      method: 'POST',
      body: JSON.stringify(deviceInfo),
      headers,
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
    const cleanUrl = url.startsWith('http') ? url : `${apiBaseUrl}${url}`;
    const token = (await getSessionSafe()).data.session?.access_token;
    
    const headers: Record<string, string> = {
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

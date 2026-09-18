/**
 * فُصْحَى | عميل الـ API الموحد للمنصة التعليمية
 * متصل بخادم Cloudflare Worker المكتمل: fusha-ashraf-api
 */

const API_BASE = window.FUSHA_API_URL || (typeof window !== 'undefined' && window.location.hostname.includes('localhost') ? 'http://localhost:8787' : 'https://api.fusha.site');

class FushaApi {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  getToken() {
    return localStorage.getItem('fusha_token') || null;
  }

  setTokens(access_token, refresh_token, user) {
    if (access_token) localStorage.setItem('fusha_token', access_token);
    if (refresh_token) localStorage.setItem('fusha_refresh_token', refresh_token);
    if (user) localStorage.setItem('fusha_user', JSON.stringify(user));
  }

  getUser() {
    try {
      const u = localStorage.getItem('fusha_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  clearAuth() {
    localStorage.removeItem('fusha_token');
    localStorage.removeItem('fusha_refresh_token');
    localStorage.removeItem('fusha_user');
  }

  isLoggedIn() {
    return !!this.getToken();
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Platform': 'web',
      ...options.headers,
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Attach device ID for device binding and trusted checks
    let deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('fusha_device_id') : null;
    if (!deviceId && typeof localStorage !== 'undefined') {
      deviceId = 'web_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
      localStorage.setItem('fusha_device_id', deviceId);
    }
    if (deviceId && !headers['X-Device-Id']) {
      headers['X-Device-Id'] = deviceId;
    }

    // Attach CSRF token if cookie is present
    const csrfMatch = typeof document !== 'undefined' && document.cookie.match(/csrf_token=([^;]+)/);
    if (csrfMatch && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = csrfMatch[1];
    }

    try {
      const res = await fetch(url, {
        ...options,
        credentials: options.credentials || 'include',
        headers,
      });

      // Handle 401 Unauthorized
      if (res.status === 401 && !options._retry && this.getToken()) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          options._retry = true;
          return this.request(endpoint, options);
        } else {
          this.clearAuth();
          if (window.location.pathname !== '/login.html' && !window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = 'login.html';
          }
        }
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorMsg = data?.error?.message || data?.message || `خطأ في الخادم (${res.status})`;
        throw new Error(errorMsg);
      }
      return data;
    } catch (err) {
      console.error(`[Fusha API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('fusha_refresh_token');
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Platform': 'web',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem('fusha_token', data.access_token);
          if (data.refresh_token) localStorage.setItem('fusha_refresh_token', data.refresh_token);
          return true;
        }
      }
    } catch {
      // Refresh failed
    }
    return false;
  }

  // ══════════════════════════════════
  // المصادقة والحساب (Auth)
  // ══════════════════════════════════
  auth = {
    login: async (credentials) => {
      // credentials: { email or phone, password }
      const data = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (data.access_token && data.user) {
        this.setTokens(data.access_token, data.refresh_token, data.user);
      }
      return data;
    },

    register: async (studentData) => {
      // studentData: { email, password, full_name, phone, grade, branch, referral_code }
      const data = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(studentData),
      });
      if (data.access_token && data.user) {
        this.setTokens(data.access_token, data.refresh_token, data.user);
      }
      return data;
    },

    me: async () => {
      const data = await this.request('/auth/me');
      if (data.user) {
        localStorage.setItem('fusha_user', JSON.stringify(data.user));
      }
      return data;
    },

    updateProfile: (profileData) => {
      return this.request('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(profileData),
      });
    },

    publicSettings: () => {
      return this.request('/auth/public-settings');
    },

    resetPassword: (payload) => {
      return this.request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    logout: () => {
      this.clearAuth();
      window.location.href = 'index.html';
    }
  };

  // ══════════════════════════════════
  // المناهج والمحاضرات (Courses & Lessons)
  // ══════════════════════════════════
  courses = {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return this.request(`/courses${query ? `?${query}` : ''}`);
    },

    myCourses: () => {
      return this.request('/courses/me');
    },

    get: (courseId) => {
      return this.request(`/courses/${courseId}`);
    },

    enroll: (courseId) => {
      return this.request(`/courses/${courseId}/enroll`, { method: 'POST' });
    },

    lesson: (courseId, lessonId) => {
      return this.request(`/courses/${courseId}/lessons/${lessonId}`);
    },

    publicExams: () => {
      return this.request('/courses/public-exams');
    },

    publicExamDetails: (examId) => {
      return this.request(`/courses/public-exams/${examId}`);
    },

    submitPublicExam: (examId, answers) => {
      return this.request(`/courses/public-exams/${examId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
    }
  };

  // ══════════════════════════════════
  // الاختبارات المعتمدة (Exams)
  // ══════════════════════════════════
  exams = {
    get: (examId) => {
      return this.request(`/exam-builds/${examId}`);
    },

    submit: (examId, answers, durationSeconds) => {
      return this.request(`/exam-builds/${examId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers, duration_seconds: durationSeconds }),
      });
    },

    mistakes: () => {
      return this.request('/mistakes');
    }
  };

  // ══════════════════════════════════
  // تشغيل وحماية الفيديو (Playback & Watermark)
  // ══════════════════════════════════
  playback = {
    getPlayback: (lessonId) => {
      return this.request(`/lessons/${lessonId}/playback`, {
        method: 'POST',
      });
    },

    getToken: (lessonId) => {
      return this.request(`/lessons/${lessonId}/playback`, {
        method: 'POST',
      });
    },

    heartbeat: (lessonId, positionSeconds) => {
      return this.request('/playback/heartbeat', {
        method: 'POST',
        body: JSON.stringify({ lesson_id: lessonId, position_seconds: positionSeconds }),
      });
    }
  };

  // ══════════════════════════════════
  // معجم فُصْحَى اللغوي (Dictionary)
  // ══════════════════════════════════
  dictionary = {
    search: (query, limit = 20) => {
      const q = encodeURIComponent(query || '');
      return this.request(`/dictionary?q=${q}&limit=${limit}`);
    },

    word: (word) => {
      return this.request(`/dictionary/word/${encodeURIComponent(word)}`);
    },

    suggest: (query) => {
      return this.request(`/dictionary/suggest?q=${encodeURIComponent(query)}`);
    },

    popular: () => {
      return this.request('/dictionary/popular');
    },

    details: (id) => {
      return this.request(`/dictionary/${id}`);
    }
  };

  // ══════════════════════════════════
  // بنك الأسئلة والتدريبات (Question Bank)
  // ══════════════════════════════════
  bank = {
    listPublic: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return this.request(`/question-bank/public${q ? `?${q}` : ''}`);
    },

    tags: () => {
      return this.request('/question-bank/public/tags');
    },

    randomQuiz: (filter = {}) => {
      return this.request('/question-bank/public/random', {
        method: 'POST',
        body: JSON.stringify(filter),
      });
    },

    checkAnswer: (questionId, selectedOption, rawAnswer) => {
      return this.request('/question-bank/public/check', {
        method: 'POST',
        body: JSON.stringify({
          question_id: questionId,
          selected_option: selectedOption,
          raw_answer: rawAnswer,
        }),
      });
    }
  };

  // ══════════════════════════════════
  // محفظة الطالب وشحن الكروت (Wallet & Codes)
  // ══════════════════════════════════
  wallet = {
    get: async () => {
      try {
        const [financials, points, wallets] = await Promise.all([
          this.request('/auth/me/financials').catch(() => null),
          this.request('/me/points').catch(() => null),
          this.request('/payment-wallets').catch(() => null),
        ]);
        return {
          balance: financials?.wallet_balance ?? 0,
          points: points?.total_points ?? 0,
          payment_wallets: wallets?.payment_wallets ?? [],
          financials: financials?.financials || [],
        };
      } catch {
        return { balance: 0, points: 0, payment_wallets: [], financials: [] };
      }
    },

    paymentWallets: () => {
      return this.request('/payment-wallets');
    },

    redeemCode: (code) => {
      return this.request('/codes/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });
    },

    purchase: (itemType, itemId) => {
      return this.request('/purchases', {
        method: 'POST',
        body: JSON.stringify({ item_type: itemType, item_id: itemId }),
      });
    }
  };

  // ══════════════════════════════════
  // بوابة ولي الأمر (Parent Portal)
  // ══════════════════════════════════
  parent = {
    getReport: (studentPhone) => {
      return this.request(`/parent/report/${encodeURIComponent(studentPhone)}`);
    },

    linkStudent: (studentPhone, parentPhone) => {
      return this.request('/parent/link', {
        method: 'POST',
        body: JSON.stringify({ student_phone: studentPhone, parent_phone: parentPhone }),
      });
    }
  };

  // ══════════════════════════════════
  // الأخبار والتحديات (News & Gamification)
  // ══════════════════════════════════
  news = {
    list: () => this.request('/news'),
  };

  challenges = {
    list: () => this.request('/challenges'),
  };
}

// إنشاء نسخة عامة واحدة
window.api = new FushaApi(API_BASE);

// Toast Notification Manager
window.showToast = function (message, type = 'info', duration = 4000) {
  let container = document.getElementById('fusha-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'fusha-toast-container';
    container.className = 'fixed bottom-5 start-5 z-[99999] flex flex-col gap-2 max-w-sm pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const typeStyles = {
    success: 'bg-emerald-800 text-white border-emerald-600',
    error: 'bg-red-800 text-white border-red-600',
    warning: 'bg-amber-700 text-white border-amber-500',
    info: 'bg-fusha-forest text-white border-fusha-khaki',
  };

  const icons = {
    success: 'check-circle-2',
    error: 'alert-triangle',
    warning: 'alert-circle',
    info: 'info',
  };

  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium transition-all duration-300 transform translate-y-4 opacity-0 ${
    typeStyles[type] || typeStyles.info
  }`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 flex-shrink-0 text-fusha-sun"></i>
    <span class="flex-1 leading-relaxed">${message}</span>
    <button type="button" class="text-white/70 hover:text-white transition" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

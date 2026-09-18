import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { ApiService, getDeviceId } from '../services/api';
import {
  AUTH_STATUS_EVENT,
  clearTokens,
  getAccessToken,
  getMe,
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  updateMe,
} from '../services/auth';
import type { AuthUser } from '../services/auth';
import { requestPushPermission, subscribeToForegroundMessages } from '../services/firebase';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: AuthUser | null;
  profile: any | null;
  loading: boolean;
  needsProfileSetup: boolean;
  login: (phoneOrEmail: string, password: string) => Promise<void>;
  register: (data: {
    phone: string;
    email?: string;
    fullName: string;
    parentPhone: string;
    grade: string;
    branch?: string;
    governorate: string;
    password: string;
  }) => Promise<void>;
  completeProfileSetup: (data: {
    fullName: string;
    phone: string;
    parentPhone: string;
    grade: string;
    branch?: string;
    governorate: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ⚠️ النطاق القديم: كان يُبنى بريد وهمي `<phone>@fusha.edu.eg` لأن مزوّد الهوية
// السابق كان يشترط بريداً. الآن يقبل الخادم `phone` مباشرة في /auth/login
// و /auth/register، لذا لم تعد هناك حاجة لأي تحويل.
// أي حساب قديم ما زال بهذا النطاق يحتاج ترحيلاً إلى بريد حقيقي.
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRegisteringRef = useRef(false);
  const { showToast } = useToast();

  // Clear error
  const clearError = () => setError(null);

  // Registers the current browser as a device (attaches an FCM push token
  // when available) in the background. Runs fire-and-forget so a stalled
  // notification-permission prompt or push token fetch can never block the
  // app's loading state — only a hard failure (e.g. device limit) surfaces
  // to the user, asynchronously, once it resolves.
  const registerDeviceInBackground = () => {
    (async () => {
      try {
        const pushToken = await requestPushPermission();
        await ApiService.registerDevice({
          device_id: getDeviceId(),
          platform: 'web',
          model: navigator.userAgent.substring(0, 50),
          ...(pushToken ? { push_token: pushToken } : {}),
        });
      } catch (deviceErr: any) {
        console.error('Failed to register device:', deviceErr);
        if (deviceErr.code === 'DEVICE_LIMIT_EXCEEDED' || (deviceErr.message && deviceErr.message.includes('الأجهزة'))) {
          setError(deviceErr.message || 'تم تجاوز الحد الأقصى لعدد الأجهزة المسموح بها.');
        }
      }
    })();
  };

  // Fetch the student profile from the Worker and register this browser.
  const fetchProfileAndRegisterDevice = async () => {
    try {
      const me = await getMe();
      setUser(me);
      setProfile(me);
      setNeedsProfileSetup(false);
      registerDeviceInBackground();
    } catch (err: any) {
      if (err.status === 404 || err.code === 'NOT_FOUND' || err.code === 'PROFILE_NOT_FOUND') {
        // حساب قائم بلا ملف شخصي مكتمل — نطلب إكمال البيانات.
        setNeedsProfileSetup(true);
      } else if (err.status === 401) {
        // الجلسة منتهية بالفعل؛ auth.ts نظّف الرموز وأطلق حدث التغيير.
        setUser(null);
        setProfile(null);
        setNeedsProfileSetup(false);
      } else {
        console.error('Failed to fetch profile:', err);
        setError(err.message || 'فشل مزامنة الملف الشخصي مع الخادم الرئيسي');
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      if (getAccessToken()) {
        await fetchProfileAndRegisterDevice();
      }
      setLoading(false);
    };

    initAuth();

    // يُطلقه services/auth.ts عند فشل تجديد الرمز (جلسة منتهية فعلاً)
    // أو عند تسجيل الخروج.
    const handleAuthStatusChange = () => {
      setUser(null);
      setProfile(null);
      setNeedsProfileSetup(false);
    };
    window.addEventListener(AUTH_STATUS_EVENT, handleAuthStatusChange);

    return () => {
      window.removeEventListener(AUTH_STATUS_EVENT, handleAuthStatusChange);
    };
  }, []);

  // Show a toast for push notifications that arrive while the app tab is
  // open/focused (background pushes are handled by public/sw.js instead).
  // Only subscribed for authenticated users — guests never trigger this.
  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    subscribeToForegroundMessages(({ title, body }) => {
      showToast('info', title || 'إشعار جديد', body);
    }).then((unsub) => {
      if (cancelled) {
        unsub();
      } else {
        unsubscribe = unsub;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user, showToast]);

  const login = async (phoneOrEmail: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const identifier = phoneOrEmail.trim();
      // الخادم يقبل `email` أو `phone`؛ نرسل الحقل الصحيح فقط.
      const isPhone = /^[0-9]+$/.test(identifier);
      const me = await authLogin(
        isPhone ? { phone: identifier, password } : { email: identifier, password },
      );
      setUser(me);
      setProfile(me);
      setNeedsProfileSetup(false);
      registerDeviceInBackground();
    } catch (err: any) {
      console.error(err);
      const message =
        err.status === 401 || err.status === 400
          ? 'بيانات الدخول غير صحيحة. يرجى التأكد من رقم الهاتف/البريد وكلمة المرور.'
          : err.message || 'فشل تسجيل الدخول. يرجى التحقق من البيانات.';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: {
    phone: string;
    email?: string;
    fullName: string;
    parentPhone: string;
    grade: string;
    branch?: string;
    governorate: string;
    password: string;
  }) => {
    setLoading(true);
    setError(null);
    isRegisteringRef.current = true;
    try {
      // 1. إنشاء الحساب — العقد يقبل: email, password, full_name, phone?, grade?, branch?
      const me = await authRegister({
        email: data.email,
        phone: data.phone,
        password: data.password,
        full_name: data.fullName,
        grade: data.grade,
        branch: data.branch,
      });

      setUser(me);

      // 2. الحقول خارج عقد التسجيل (هاتف وليّ الأمر والمحافظة) تُحفظ عبر PATCH /auth/me
      const extras: Record<string, unknown> = {};
      if (data.parentPhone) extras.parent_phone = data.parentPhone;
      if (data.governorate) extras.governorate = data.governorate;

      let finalProfile: any = me;
      if (Object.keys(extras).length > 0) {
        try {
          finalProfile = await updateMe(extras);
        } catch (patchErr) {
          // الحساب أُنشئ بنجاح — لا نُفشل التسجيل بسبب حقل إضافي.
          console.warn('Failed to persist extra profile fields:', patchErr);
        }
      }

      setProfile(finalProfile);
      setNeedsProfileSetup(false);

      // 3. Register device (best-effort push token; never blocks signup)
      registerDeviceInBackground();
    } catch (err: any) {
      console.error(err);
      // EMAIL_ALREADY_EXISTS هو الرمز الفعلي من POST /auth/register (409).
      const message =
        err.status === 409 || err.code === 'EMAIL_ALREADY_EXISTS'
          ? 'هذا البريد الإلكتروني مسجَّل بالفعل. يمكنك تسجيل الدخول أو استعادة كلمة المرور.'
          : err.message || 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.';
      setError(message);
      throw new Error(message);
    } finally {
      isRegisteringRef.current = false;
      setLoading(false);
    }
  };

  const completeProfileSetup = async (data: {
    fullName: string;
    phone: string;
    parentPhone: string;
    grade: string;
    branch?: string;
    governorate: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateMe({
        full_name: data.fullName,
        phone: data.phone,
        parent_phone: data.parentPhone,
        grade: data.grade,
        branch: data.branch,
        governorate: data.governorate,
      });
      setUser(updated);
      setProfile(updated);
      setNeedsProfileSetup(false);
      registerDeviceInBackground();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'فشل إكمال إعداد الحساب.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await authLogout();
      setUser(null);
      setProfile(null);
      setNeedsProfileSetup(false);
    } catch (err: any) {
      console.error(err);
      // حتى مع فشل غير متوقع، لا نُبقي الرموز على الجهاز.
      clearTokens();
      setUser(null);
      setProfile(null);
      setNeedsProfileSetup(false);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndRegisterDevice();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        needsProfileSetup,
        login,
        register,
        completeProfileSetup,
        logout,
        refreshProfile,
        clearError,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

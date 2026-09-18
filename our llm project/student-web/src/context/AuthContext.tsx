import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import supabase from '../services/supabase';
import { ApiService, getDeviceId, getSessionSafe } from '../services/api';
import { requestPushPermission, subscribeToForegroundMessages } from '../services/firebase';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  needsProfileSetup: boolean;
  login: (phoneOrEmail: string, password: string) => Promise<void>;
  register: (data: {
    phone: string;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
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
  const registerDeviceInBackground = (token?: string) => {
    (async () => {
      try {
        const pushToken = await requestPushPermission();
        await ApiService.registerDevice({
          device_id: getDeviceId(),
          platform: 'web',
          model: navigator.userAgent.substring(0, 50),
          ...(pushToken ? { push_token: pushToken } : {}),
        }, token);
      } catch (deviceErr: any) {
        console.error('Failed to register device:', deviceErr);
        if (deviceErr.code === 'DEVICE_LIMIT_EXCEEDED' || (deviceErr.message && deviceErr.message.includes('الأجهزة'))) {
          setError(deviceErr.message || 'تم تجاوز الحد الأقصى لعدد الأجهزة المسموح بها.');
        }
      }
    })();
  };

  // Fetch student profile from Worker backend
  const fetchProfileAndRegisterDevice = async (_currentUser: User, token?: string) => {
    try {
      // 1. Get profile from D1 backend
      const profileData = await ApiService.getProfile(token);
      if (profileData && (profileData.error?.code === 'PROFILE_NOT_FOUND' || profileData.code === 'PROFILE_NOT_FOUND')) {
        setNeedsProfileSetup(true);
        return;
      }
      setProfile(profileData);
      setNeedsProfileSetup(false);

      // 2. Register current browser as a device — non-blocking (see above).
      registerDeviceInBackground(token);
    } catch (err: any) {
      if (err.status === 404 || err.code === 'NOT_FOUND' || err.code === 'PROFILE_NOT_FOUND') {
        // User authenticated in Supabase but doesn't exist in Worker D1 (handled redirect)
        setNeedsProfileSetup(true);
      } else {
        console.error('Failed to fetch profile:', err);
        setError(err.message || 'فشل مزامنة الملف الشخصي مع الخادم الرئيسي');
      }
    }
  };

  useEffect(() => {
    // Check active session on mount
    const initAuth = async () => {
      setLoading(true);
      const { data: { session } } = await getSessionSafe();
      if (session?.user) {
        setUser(session.user);
        await fetchProfileAndRegisterDevice(session.user, session.access_token);
      }
      setLoading(false);
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isRegisteringRef.current) return;
      setLoading(true);
      if (session?.user) {
        setUser(session.user);
        await fetchProfileAndRegisterDevice(session.user, session.access_token);
      } else {
        setUser(null);
        setProfile(null);
        setNeedsProfileSetup(false);
      }
      setLoading(false);
    });

    // Custom listener for api-driven signout events
    const handleAuthStatusChange = () => {
      setUser(null);
      setProfile(null);
      setNeedsProfileSetup(false);
    };
    window.addEventListener('auth-status-change', handleAuthStatusChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('auth-status-change', handleAuthStatusChange);
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
      // Map numeric input (phone number) to email format
      const isPhone = /^[0-9]+$/.test(phoneOrEmail.trim());
      const email = isPhone ? `${phoneOrEmail.trim()}@alhadaba-chemistry.com` : phoneOrEmail.trim();

      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authErr) throw authErr;
      if (data.user) {
        setUser(data.user);
        await fetchProfileAndRegisterDevice(data.user, data.session?.access_token);
      }
    } catch (err: any) {
      console.error(err);
      
      const isInvalidCredentials = 
        err.status === 400 || 
        err.message === 'Invalid login credentials' || 
        (err.message && err.message.toLowerCase().includes('credentials'));
        
      if (isInvalidCredentials) {
        try {
          const isPhone = /^[0-9]+$/.test(phoneOrEmail.trim());
          const email = isPhone ? `${phoneOrEmail.trim()}@alhadaba-chemistry.com` : phoneOrEmail.trim();
          const checkRes = await ApiService.checkEmailExists(email);
          if (checkRes && !checkRes.exists) {
            const displayError = isPhone 
              ? 'رقم الهاتف هذا غير مسجل لدينا. يرجى إنشاء حساب جديد أولاً.' 
              : 'هذا البريد الإلكتروني غير مسجل لدينا. يرجى إنشاء حساب جديد أولاً.';
            setError(displayError);
            throw new Error(displayError);
          } else {
            const displayError = 'كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.';
            setError(displayError);
            throw new Error(displayError);
          }
        } catch (checkErr: any) {
          if (checkErr.message.includes('غير مسجل') || checkErr.message.includes('كلمة المرور')) {
            throw checkErr;
          }
        }
      }

      setError(err.message || 'فشل تسجيل الدخول. يرجى التحقق من البيانات.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: {
    phone: string;
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
      const email = `${data.phone.trim()}@alhadaba-chemistry.com`;
      
      // 1. Sign up user in Supabase
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password: data.password,
      });

      if (authErr) throw authErr;
      if (!authData.user) throw new Error('فشلت عملية إنشاء الحساب');
      
      if (!authData.session) {
        console.error('[SUPABASE] SignUp succeeded but session is null. This usually means "Confirm email" is enabled in Supabase Authentication settings.');
        throw new Error('لم يتم بدء جلسة تسجيل الدخول تلقائياً. يرجى الانتقال إلى لوحة تحكم Supabase وتعطيل خيار "Confirm email" (تأكيد البريد الإلكتروني) تحت إعدادات Authentication لكي يعمل تسجيل الطلاب الجدد بشكل فوري.');
      }

      setUser(authData.user);

      // 2. Sync profile details with Worker D1 immediately using sync-first endpoint
      const syncResult = await ApiService.syncProfile({
        full_name: data.fullName,
        phone: data.phone,
        parent_phone: data.parentPhone,
        grade: data.grade,
        branch: data.branch,
        governorate: data.governorate,
      }, authData.session?.access_token);

      if (syncResult.profile) {
        setProfile(syncResult.profile);
        setNeedsProfileSetup(false);

        // 3. Register device (best-effort push token; never blocks signup)
        const pushToken = await requestPushPermission();
        await ApiService.registerDevice({
          device_id: getDeviceId(),
          platform: 'web',
          model: navigator.userAgent.substring(0, 50),
          ...(pushToken ? { push_token: pushToken } : {}),
        }, authData.session?.access_token);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'فشل إنشاء الحساب. يرجى المحاولة مرة أخرى.');
      throw err;
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
      const { data: { session } } = await getSessionSafe();
      const syncResult = await ApiService.syncProfile({
        full_name: data.fullName,
        phone: data.phone,
        parent_phone: data.parentPhone,
        grade: data.grade,
        branch: data.branch,
        governorate: data.governorate,
      }, session?.access_token);

      if (syncResult.profile) {
        setProfile(syncResult.profile);
        setNeedsProfileSetup(false);

        // Register device (best-effort push token; never blocks profile setup)
        const pushToken = await requestPushPermission();
        await ApiService.registerDevice({
          device_id: getDeviceId(),
          platform: 'web',
          model: navigator.userAgent.substring(0, 50),
          ...(pushToken ? { push_token: pushToken } : {}),
        }, session?.access_token);
      }
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
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setNeedsProfileSetup(false);
      localStorage.removeItem('student_profile');
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndRegisterDevice(user);
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

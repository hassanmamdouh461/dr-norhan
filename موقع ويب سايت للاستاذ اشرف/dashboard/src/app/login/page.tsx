'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, KeyRound, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { getAccessToken, login as authLogin, logout as authLogout } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (getAccessToken()) router.replace('/dashboard');
  }, [router]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور للمتابعة.');
      return;
    }

    setLoading(true);
    try {
      const user = await authLogin(email, password);

      // لوحة التحكم مقصورة على فريق الإدارة — الطالب لا يملك صلاحية الدخول.
      // الفحص يعتمد على دور الحساب القادم من الخادم، لا على أي شيء من العميل.
      const role = String(user.role || '');
      if (!['admin', 'assistant'].includes(role)) {
        await authLogout();
        throw new Error('هذا الحساب لا يملك صلاحية الدخول إلى لوحة التحكم.');
      }

      localStorage.setItem('fusha_dashboard_session', JSON.stringify({
        user: {
          email: user.email || email.trim(),
          role,
          full_name: user.full_name || 'الأستاذ المشرف',
        },
        token: getAccessToken(),
      }));

      router.replace('/dashboard');
    } catch (loginError: any) {
      // الخادم يُعيد 401 INVALID_CREDENTIALS لبيانات الدخول الخاطئة.
      const message = loginError?.message || '';
      const isBadCredentials =
        loginError?.status === 401 ||
        loginError?.code === 'INVALID_CREDENTIALS' ||
        /invalid login credentials/i.test(message);

      setError(
        isBadCredentials
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
          : message || 'تعذر تسجيل الدخول. أعد المحاولة بعد قليل.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-canvas text-on-surface">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
        className="fixed top-4 end-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface shadow-sm transition hover:bg-surface-container"
      >
        <span className={`material-symbols-outlined text-lg ${isDark ? 'animate-sun-beam' : 'animate-moon-swing'}`}>{isDark ? 'light_mode' : 'dark_mode'}</span>
      </button>
      <div className="grid w-full min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden border-e border-outline-variant/20 bg-sidebar p-12 lg:flex lg:flex-col lg:justify-between text-white" aria-label="هوية المنصة">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgb(var(--primary)/0.15),transparent_50%)]" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 to-amber-300 font-extrabold text-teal-900 text-xl shadow-lg border border-amber-200/20 tracking-wider"
                aria-hidden="true"
              >
                فُ
              </div>
              <div>
                <p className="text-lg font-bold text-white">فُصْحَى</p>
                <p className="mt-0.5 text-xs text-emerald-100/80">لوحة الإدارة التعليمية</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <p className="text-sm font-semibold text-amber-200">مساحة العمل</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-white">لوحة تحكم واضحة، وقرارات أسرع.</h1>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="border border-white/10 bg-white/[0.05] p-5 rounded-lg"><p className="text-2xl font-bold text-amber-200">24/7</p><p className="mt-1 text-xs text-emerald-50/80">متابعة المنصة</p></div>
              <div className="border border-white/10 bg-white/[0.05] p-5 rounded-lg"><p className="text-2xl font-bold text-amber-200">RTL</p><p className="mt-1 text-xs text-emerald-50/80">واجهة عربية مريحة</p></div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-emerald-50/70">
            <ShieldCheck size={16} className="text-emerald-300" />
            <span>دخول مخصص للمشرفين والمساعدين</span>
          </div>
        </section>

        <section className="flex min-h-screen min-w-0 items-center justify-center bg-canvas px-6 py-12 text-on-surface sm:px-12 lg:px-20">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary-container font-extrabold text-on-primary text-xl shadow-lg border border-primary/20 tracking-wider"
                  aria-hidden="true"
                >
                  فُ
                </div>
                <div>
                  <p className="text-lg font-bold text-on-surface">فُصْحَى</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">لوحة الإدارة التعليمية</p>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-primary">مرحبًا بعودتك</p>
              <h2 className="mt-2 text-3xl font-bold tracking-normal text-on-surface">تسجيل الدخول</h2>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">استخدم بيانات حساب المشرف أو المساعد للوصول إلى لوحة التحكم.</p>
            </div>

            {error && (
              <div role="alert" className="mt-6 flex items-start gap-3 border border-error/30 bg-error-container/30 p-4 text-sm leading-6 text-error rounded-lg">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <label htmlFor="email" className="block">
                <span className="mb-2 block text-sm font-bold text-on-surface">البريد الإلكتروني</span>
                <span className="relative block">
                  <Mail size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input id="email" type="email" autoComplete="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="h-12 w-full rounded-lg border border-outline-variant bg-surface py-2 ps-4 pe-11 text-start text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20" required />
                </span>
              </label>

              <label htmlFor="password" className="block">
                <span className="mb-2 block text-sm font-bold text-on-surface">كلمة المرور</span>
                <span className="relative block">
                  <KeyRound size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="h-12 w-full rounded-lg border border-outline-variant bg-surface py-2 ps-11 pe-11 text-start text-sm text-on-surface outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20" required />
                  <button type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShowPassword((value) => !value)} className="absolute end-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </span>
              </label>

              <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary transition hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 shadow-md">
                <LogIn size={18} />
                {loading ? 'جارٍ تسجيل الدخول...' : 'دخول لوحة التحكم'}
              </button>
            </form>

            <div className="mt-8 border-t border-outline-variant pt-5 text-center text-xs text-on-surface-variant">الدخول محمي ومخصص لأعضاء فريق الإدارة.</div>
          </div>
        </section>
      </div>
    </main>
  );
}

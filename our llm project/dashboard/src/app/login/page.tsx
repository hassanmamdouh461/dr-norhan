'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, KeyRound, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard');
    });
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
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;

      const role = data.session?.user.app_metadata?.role || 'admin';
      if (!data.session || !['admin', 'assistant'].includes(role)) {
        await supabase.auth.signOut();
        throw new Error('هذا الحساب لا يملك صلاحية الدخول إلى لوحة التحكم.');
      }

      localStorage.setItem('chemistry_dashboard_session', JSON.stringify({
        user: {
          email: data.session.user.email,
          role,
          full_name: data.session.user.user_metadata?.full_name || 'الأستاذ المشرف',
        },
        token: data.session.access_token,
      }));

      router.replace('/dashboard');
    } catch (loginError: any) {
      const message = loginError?.message || '';
      setError(/invalid login credentials/i.test(message) ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : message || 'تعذر تسجيل الدخول. أعد المحاولة بعد قليل.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0c1718] text-white">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
        className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white backdrop-blur-sm transition hover:bg-white/[0.12]"
      >
        <span className={`material-symbols-outlined text-lg ${isDark ? 'animate-sun-beam' : 'animate-moon-swing'}`}>{isDark ? 'light_mode' : 'dark_mode'}</span>
      </button>
      <div className="grid w-full min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden border-l border-white/10 bg-[#0c2020] p-12 lg:flex lg:flex-col lg:justify-between" aria-label="هوية المنصة">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgb(var(--primary)/0.1),transparent_50%)]" />
          <div className="relative z-10 flex items-center gap-3">
            <a 
              href="https://www.synapticstudio.tech/ar" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-3 group cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 to-amber-300 font-extrabold text-[#0c2020] text-xl shadow-lg border border-amber-200/20 tracking-wider">
                SS
              </div>
              <div>
                <p className="text-lg font-bold text-white group-hover:text-amber-200 transition-colors">الهضبة</p>
                <p className="mt-0.5 text-xs text-emerald-100/70">لوحة الإدارة التعليمية</p>
              </div>
            </a>
          </div>

          <div className="relative z-10 max-w-md">
            <p className="text-sm font-semibold text-amber-200">مساحة العمل</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-white">لوحة تحكم واضحة، وقرارات أسرع.</h1>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="border border-white/10 bg-white/[0.03] p-5 rounded-lg"><p className="text-2xl font-bold text-amber-200">24/7</p><p className="mt-1 text-xs text-emerald-50/70">متابعة المنصة</p></div>
              <div className="border border-white/10 bg-white/[0.03] p-5 rounded-lg"><p className="text-2xl font-bold text-amber-200">RTL</p><p className="mt-1 text-xs text-emerald-50/70">واجهة عربية مريحة</p></div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-emerald-50/60">
            <ShieldCheck size={16} className="text-emerald-300" />
            <span>دخول مخصص للمشرفين والمساعدين</span>
          </div>
        </section>

        <section className="flex min-h-screen min-w-0 items-center justify-center bg-[#f8fbfa] px-6 py-12 text-[#152123] sm:px-12 lg:px-20">
          <div className="w-full max-w-md">
            <div className="mb-9 lg:hidden">
              <a 
                href="https://www.synapticstudio.tech/ar" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-3 group cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-primary-container font-extrabold text-white text-xl shadow-lg border border-primary/20 tracking-wider">
                  SS
                </div>
                <div>
                  <p className="text-lg font-bold text-[#152123] group-hover:text-primary transition-colors">الهضبة</p>
                  <p className="mt-0.5 text-xs text-slate-500">لوحة الإدارة التعليمية</p>
                </div>
              </a>
            </div>

            <div>
              <p className="text-xs font-bold text-primary">مرحبًا بعودتك</p>
              <h2 className="mt-2 text-3xl font-bold tracking-normal text-[#152123]">تسجيل الدخول</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">استخدم بيانات حساب المشرف أو المساعد للوصول إلى لوحة التحكم.</p>
            </div>

            {error && (
              <div role="alert" className="mt-6 flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800 rounded-lg">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-8 space-y-5">
              <label htmlFor="email" className="block">
                <span className="mb-2 block text-sm font-bold text-[#152123]">البريد الإلكتروني</span>
                <span className="relative block">
                  <Mail size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="email" type="email" autoComplete="email" dir="ltr" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="h-12 w-full rounded-lg border border-slate-300 bg-white py-2 pl-4 pr-11 text-left text-sm text-[#152123] outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10" required />
                </span>
              </label>

              <label htmlFor="password" className="block">
                <span className="mb-2 block text-sm font-bold text-[#152123]">كلمة المرور</span>
                <span className="relative block">
                  <KeyRound size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" dir="ltr" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="h-12 w-full rounded-lg border border-slate-300 bg-white py-2 pl-11 pr-11 text-left text-sm text-[#152123] outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10" required />
                  <button type="button" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShowPassword((value) => !value)} className="absolute left-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-[#152123]">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </span>
              </label>

              <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60 shadow-md">
                <LogIn size={18} />
                {loading ? 'جارٍ تسجيل الدخول...' : 'دخول لوحة التحكم'}
              </button>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-5 text-center text-xs text-slate-500">الدخول محمي ومخصص لأعضاء فريق الإدارة.</div>
          </div>
        </section>
      </div>
    </main>
  );
}
